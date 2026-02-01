import { RAM_VALUES, type Flags } from 'utils/flags';
import { getHostsWithRoot } from 'utils/neighbours';
import { getGrowThreads, getMaxScriptThreads, getWeakenThreads } from 'utils/hack';
import {
  TARGET_STATUS,
  type ServerPooled,
  type ServerWithFreeThreads,
  type Target,
  type RunOperationOpts,
  type Batch,
} from 'types/orchestrate';

const DELAY = 500;
const OFFSET = 200;
const HACK_PERCENTAGE = 0.2;

const SCRIPTS = {
  WEAKEN: 'orchestrate/weaken.ts',
  GROW: 'orchestrate/grow.ts',
  HACK: 'orchestrate/hack.ts',
} as const;

const FLAGS: Flags = [
  ['depth-pool', 1],
  ['depth-target', 1],
  ['home-ram', 2],
  ['exclude', []],
  ['target', []],
  ['prep', false],
  ['dry-run', false],
];

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
  const flags = data.flags(FLAGS);

  const ramFlags = ['--home-ram'];

  const lastArg = args.slice(-1)[0];

  if (lastArg && (ramFlags.includes(lastArg) || Number.isInteger(parseInt(lastArg)))) {
    return RAM_VALUES.map((n) => n.toString());
  }

  return data.servers;
}

export async function main(ns: NS) {
  setupLogs(ns);
  ns.ui.openTail(ns.pid);

  const cmdFlags = ns.flags(FLAGS);

  const depthPool = cmdFlags['depth-pool'] as number;
  const depthTarget = cmdFlags['depth-target'] as number;
  const homeRamAllocated = cmdFlags['home-ram'] as number;
  const excludes = cmdFlags['exclude'] as string[];
  const cmdTargets = cmdFlags['target'] as string[];
  const mock = cmdFlags['dry-run'] as boolean;
  const prep = cmdFlags['prep'] as boolean;

  let serverPool: ServerPooled[] = getHostsWithRoot(ns, depthPool)
    .filter((host) => ns.getServerMaxRam(host) > 0)
    .map((host) => ({
      host,
      ram: host === 'home' ? homeRamAllocated : ns.getServerMaxRam(host),
    }));

  serverPool.forEach((server) => {
    ns.scp(SCRIPTS.WEAKEN, server.host);
    ns.scp(SCRIPTS.GROW, server.host);
    ns.scp(SCRIPTS.HACK, server.host);
  });

  const totalRam = serverPool.reduce((acc, server) => acc + server.ram, 0);

  let targets: Target[] = getHostsWithRoot(ns, depthTarget)
    .filter((host) => {
      const condition = host !== 'home' && !excludes.includes(host) && ns.getServerMaxMoney(host) > 0;

      return cmdTargets.length > 0 ? cmdTargets.includes(host) && condition : condition;
    })
    .map(
      (host): Target => ({
        host,
        status: TARGET_STATUS.WEAKEN,
        active: false,
        activePids: [],
        ramMax: ns.getServerMaxRam(host),
        ramUsed: ns.getServerUsedRam(host),
        moneyMax: ns.getServerMaxMoney(host),
        moneyAvail: ns.getServerMoneyAvailable(host),
        securityMin: ns.getServerMinSecurityLevel(host),
        securityCurr: ns.getServerSecurityLevel(host),
      })
    );

  ns.print(
    `INFO: === Total RAM: ${ns.formatRam(totalRam)}, Home RAM Total: ${ns.formatRam(ns.getServerMaxRam('home'))}, Home RAM Allocated: ${ns.formatRam(homeRamAllocated)} ===`
  );

  while (true) {
    // for (let i = 0; i < 1; i++) {

    serverPool = getHostsWithRoot(ns, depthPool)
      .filter((host) => ns.getServerMaxRam(host) > 0)
      .map((host) => ({
        host,
        ram: host === 'home' ? homeRamAllocated : ns.getServerMaxRam(host),
      }));

    serverPool.forEach((server) => {
      if (!ns.fileExists(SCRIPTS.WEAKEN)) {
        ns.scp(SCRIPTS.WEAKEN, server.host);
      }
      if (!ns.fileExists(SCRIPTS.GROW)) {
        ns.scp(SCRIPTS.GROW, server.host);
      }
      if (!ns.fileExists(SCRIPTS.HACK)) {
        ns.scp(SCRIPTS.HACK, server.host);
      }
    });

    const currentRam = serverPool
      .map(({ host, ram }) => Math.max(ram - ns.getServerUsedRam(host), 0))
      .reduce((acc, ram) => acc + ram, 0);

    targets = targets.sort((a, b) => {
      const scores = {
        [TARGET_STATUS.HACK]: 4,
        [TARGET_STATUS.WEAKEN]: 2,
        [TARGET_STATUS.GROW]: 1,
      };

      const aScore = scores[a.status];
      const bScore = scores[b.status];

      return bScore - aScore;
    });

    for (const target of targets) {
      if (isInactive(ns, target)) {
        target.active = false;
        target.activePids = [];
      }

      updateTargetMeta(ns, target);
      updateStatus(ns, target);

      if (!target.active) {
        if (target.status === TARGET_STATUS.WEAKEN || target.status === TARGET_STATUS.GROW) {
          ns.print(`INFO: ### ${target.host} ${target.status}`);
          planSetupOperation(ns, target, currentRam, serverPool, mock);
        } else if (!prep) {
          planHWGW(ns, target, serverPool, mock);
        }
      } else {
        ns.print(`INFO: ### ${target.host} ${target.status} active`);
      }
    }

    await ns.sleep(DELAY);
  }
}

function planHWGW(ns: NS, target: Target, serverPool: ServerPooled[], mock: boolean = false) {
  const hasFormulas = ns.fileExists('Formulas.exe', 'home');

  const weakenPerThread = ns.weakenAnalyze(1);
  const securityIncreasePerHack = ns.hackAnalyzeSecurity(1, target.host);
  const securityIncreasePerGrow = ns.growthAnalyzeSecurity(1, target.host);

  const hackTime = ns.getHackTime(target.host);
  const growTime = ns.getGrowTime(target.host);
  const weakenTime = ns.getWeakenTime(target.host);

  const batch: Batch = {
    hack: {
      threads: Math.max(Math.ceil(ns.hackAnalyzeThreads(target.host, target.moneyMax * HACK_PERCENTAGE)), 1),
      delay: weakenTime - hackTime,
    },
    weakenHack: {
      threads: 1,
      delay: OFFSET,
    },
    grow: {
      threads: Math.max(Math.ceil(ns.growthAnalyze(target.host, 1 / (1 - HACK_PERCENTAGE - 0.05))), 1),
      delay: weakenTime - growTime + OFFSET * 2,
    },
    weakenGrow: {
      threads: 1,
      delay: OFFSET * 3,
    },
  };

  if (hasFormulas) {
    const targetServer = ns.getServer(target.host);
    const player = ns.getPlayer();

    batch.hack.threads = Math.max(
      Math.ceil(HACK_PERCENTAGE / ns.formulas.hacking.hackPercent(targetServer, player)),
      1
    );
    batch.hack.delay =
      ns.formulas.hacking.weakenTime(
        {
          ...targetServer,
          hackDifficulty: target.securityMin + securityIncreasePerHack * batch.hack.threads,
        },
        player
      ) - ns.formulas.hacking.hackTime(targetServer, player);

    batch.weakenHack.threads = Math.max(
      Math.ceil(ns.hackAnalyzeSecurity(batch.hack.threads, target.host) / weakenPerThread),
      1
    );

    batch.grow.threads = Math.max(
      ns.formulas.hacking.growThreads(
        {
          ...targetServer,
          moneyAvailable:
            (1 - ns.formulas.hacking.hackPercent(targetServer, player) * batch.hack.threads) * target.moneyMax,
        },
        player,
        target.moneyMax
      ),
      1
    );
    batch.grow.delay =
      ns.formulas.hacking.weakenTime(
        {
          ...targetServer,
          hackDifficulty: target.securityMin + securityIncreasePerGrow * batch.grow.threads,
        },
        player
      ) -
      ns.formulas.hacking.growTime(
        {
          ...targetServer,
          moneyAvailable:
            (1 - ns.formulas.hacking.hackPercent(targetServer, player) * batch.hack.threads) * target.moneyMax,
        },
        player
      ) +
      OFFSET * 2;

    batch.weakenGrow.threads = Math.max(Math.ceil(ns.growthAnalyzeSecurity(batch.grow.threads) / weakenPerThread), 1);
  } else {
    batch.weakenHack.threads = Math.max(
      Math.ceil(ns.hackAnalyzeSecurity(batch.hack.threads, target.host) / weakenPerThread),
      1
    );
    batch.weakenGrow.threads = Math.max(Math.ceil(ns.growthAnalyzeSecurity(batch.grow.threads) / weakenPerThread), 1);
  }

  const totalThreadsNeeded = Object.values(batch).reduce((acc, batchDetails) => acc + batchDetails.threads, 0);

  // ns.print(`Host: ${target.host}`);
  // ns.print(`Weaken Per Thread: ${weakenPerThread}`);
  // ns.print(`Hack Threads: ${batch.hack.threads}`);
  // const securityIncreaseAfterHack = ns.hackAnalyzeSecurity(batch.hack.threads, target.host);
  // ns.print(`Security Increase After Hack: ${securityIncreaseAfterHack}`);
  // ns.print(`Weaken Threads After Hack: ${batch.weakenHack.threads}`);
  // ns.print(`Grow Threads: ${batch.grow.threads}`);
  // const securityIncreaseAfterGrow = ns.growthAnalyzeSecurity(batch.grow.threads);
  // ns.print(`Security Increase After Grow: ${securityIncreaseAfterGrow}`);
  // ns.print(`Weaken Threads After Grow: ${batch.weakenGrow.threads}`);
  // ns.print(`${hackTime} (${ns.tFormat(hackTime)})`);
  // ns.print(`${growTime} (${ns.tFormat(growTime)})`);
  // ns.print(`${weakenTime} (${ns.tFormat(weakenTime)})`);

  if (mock) {
    return;
  }

  const servers = getServerWithFreeThreads(ns, SCRIPTS.GROW, serverPool);
  const totalAvailable = servers.reduce((acc, server) => acc + server.threadsAvailable, 0);

  if (totalAvailable < totalThreadsNeeded) {
    ns.print(`ERROR: ${target.host} ${target.status} insufficient threads ${totalAvailable}/${totalThreadsNeeded}.`);
    return;
  }

  const hackRes = runOperation(ns, SCRIPTS.HACK, target.host, batch.hack.threads, serverPool, {
    delay: batch.hack.delay,
  });
  const weaken1Res = runOperation(ns, SCRIPTS.WEAKEN, target.host, batch.weakenHack.threads, serverPool, {
    delay: batch.weakenHack.delay,
  });
  const growRes = runOperation(ns, SCRIPTS.GROW, target.host, batch.grow.threads, serverPool, {
    delay: batch.grow.delay,
  });
  const weaken2Res = runOperation(ns, SCRIPTS.WEAKEN, target.host, batch.weakenGrow.threads, serverPool, {
    delay: batch.weakenGrow.delay,
  });

  target.activePids = [...hackRes.pids, ...weaken1Res.pids, ...growRes.pids, ...weaken2Res.pids];
  target.active = true;
  target.last = {
    type: TARGET_STATUS.HACK,
    threads: hackRes.threads + weaken1Res.threads + growRes.threads + weaken2Res.threads,
  };

  ns.print(`SUCCESS: ### ${target.host} ${target.status}`);
}

function planSetupOperation(
  ns: NS,
  target: Target,
  currentRam: number,
  serverPool: ServerPooled[],
  mock: boolean = false
) {
  let threadsNeeded = 0;
  if (target.status === TARGET_STATUS.WEAKEN) {
    threadsNeeded = getWeakenThreads(ns, target.securityMin, target.securityCurr);
  } else if (target.status === TARGET_STATUS.GROW) {
    threadsNeeded = getGrowThreads(ns, target.host);
  }

  const script = SCRIPTS[target.status];
  const scriptRam = ns.getScriptRam(script);
  const threadedRam = threadsNeeded * scriptRam;

  ns.print(
    `INFO: ### ${target.host} ${target.status} ${threadsNeeded} threads needed at ${ns.formatRam(scriptRam)} ea, ${ns.formatRam(threadedRam)} total`
  );

  if (threadedRam < currentRam) {
    if (mock) {
      ns.print(`SUCCESS: ${target.host} ${target.status} ${threadsNeeded}(?) threads started`);
      return;
    }

    const res = runOperation(ns, script, target.host, threadsNeeded, serverPool, { spreadEvenly: true });
    target.activePids = res.pids;
    target.active = true;
    target.last = {
      type: target.status,
      threads: res.threads,
    };
    ns.print(`SUCCESS: ${target.host} ${target.status} ${res.threads} threads started`);
  } else if (currentRam > 0) {
    ns.print(`WARN: ${target.host} ${target.status} started with insufficient RAM for full number of threads`);

    if (mock) {
      return;
    }

    const res = runOperation(ns, script, target.host, threadsNeeded, serverPool, { log: true });

    target.activePids = res.pids;
    target.last = {
      type: target.status,
      threads: res.threads,
    };

    if (target.activePids.length > 0) {
      target.active = true;
    }
  } else {
    ns.print(
      `ERROR: Not enough RAM (${ns.formatRam(currentRam)}/${ns.formatRam(threadedRam)}) in server pool to start weaken operation for ${target.host}`
    );
  }
}

function runOperation(
  ns: NS,
  script: (typeof SCRIPTS)[TARGET_STATUS],
  target: string,
  threads: number,
  serverPool: ServerPooled[],
  opts: RunOperationOpts = {
    log: false,
    spreadEvenly: false,
    delay: 0,
  }
) {
  const { log, spreadEvenly, delay } = opts;
  const sleep = delay ? delay : 0;

  const servers: ServerWithFreeThreads[] = getServerWithFreeThreads(ns, script, serverPool);
  const availableServers = servers.filter((server) => server.threadsAvailable > 0);

  let counter = 0;
  const pids = [];

  if (spreadEvenly) {
    while (counter <= threads) {
      if (availableServers.length === 0) {
        break;
      }

      for (const server of availableServers) {
        const pid = ns.exec(script, server.host, 1, '--target', target, '--sleep-during', sleep);
        server.threadsAvailable -= 1;
        if (server.threadsAvailable === 0) {
          availableServers.splice(availableServers.indexOf(server), 1);
        }
        counter += 1;
        pids.push(pid);
      }
    }
  } else {
    for (const server of servers) {
      if (server.threadsAvailable !== 0) {
        const threadsToCreate = Math.max(Math.min(server.threadsAvailable, threads - counter), 1);

        // ns.print(`target: ${target}`);
        // ns.print(`host: ${server.host}`);
        // ns.print(`threadsToCreate: ${threadsToCreate}`);
        // ns.print(`server.threadsAvailable: ${server.threadsAvailable}`);
        // ns.print(`threads - counter: ${threads - counter}`);

        const pid = ns.exec(script, server.host, threadsToCreate, '--target', target, '--sleep-during', sleep);
        counter += threadsToCreate;
        pids.push(pid);

        if (counter >= threads) {
          break;
        }
      }
    }
  }

  if (log) {
    ns.print(`INFO: ${counter} / ${threads} threads (started / requested)`);
  }

  return { threads: counter, pids };
}

function getServerWithFreeThreads(ns: NS, script: string, serverPool: ServerPooled[]): ServerWithFreeThreads[] {
  const scriptRam = ns.getScriptRam(script);

  const servers: ServerWithFreeThreads[] = serverPool.map((server) => {
    const free = server.ram - ns.getServerUsedRam(server.host);

    return {
      host: server.host,
      threadsAvailable: Math.floor(free / scriptRam),
    };
  });

  return servers;
}

function isInactive(ns: NS, target: Target): boolean {
  const activeProcesses = target.activePids.map((pid) => ns.getRunningScript(pid)).filter((script) => script !== null);

  return activeProcesses.length === 0;
}

function updateStatus(ns: NS, target: Target): void {
  const meetsSecurityTarget = target.securityCurr === target.securityMin;
  const meetsMoneyTarget = target.moneyAvail === target.moneyMax;

  if (target.status === TARGET_STATUS.WEAKEN && meetsSecurityTarget && !meetsMoneyTarget) {
    target.status = TARGET_STATUS.GROW;
  } else if (target.status === TARGET_STATUS.GROW && meetsMoneyTarget && !meetsSecurityTarget) {
    target.status = TARGET_STATUS.WEAKEN;
  } else if (meetsMoneyTarget && meetsSecurityTarget) {
    target.status = TARGET_STATUS.HACK;
  }
}

function updateTargetMeta(ns: NS, target: Target): void {
  const { host } = target;

  target.ramMax = ns.getServerMaxRam(host);
  target.ramUsed = ns.getServerUsedRam(host);
  target.moneyMax = ns.getServerMaxMoney(host);
  target.moneyAvail = ns.getServerMoneyAvailable(host);
  target.securityMin = ns.getServerMinSecurityLevel(host);
  target.securityCurr = ns.getServerSecurityLevel(host);
}

function setupLogs(ns: NS) {
  ns.clearLog();
  ns.disableLog('ALL');
  ns.enableLog('sleep');
}
