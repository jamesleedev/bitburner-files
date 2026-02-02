import { RAM_VALUES, type Flags } from 'utils/flags';
import { getHostsWithRoot } from 'utils/neighbours';
import { getServerWithFreeThreads, isInactive, syncFiles } from 'utils/orchestrate';
import {
  TARGET_STATUS,
  type ServerPooled,
  type ServerWithFreeThreads,
  type Target,
  type RunOperationOpts,
  type Batch,
} from 'types/orchestrate';

const CYCLE = 500;
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
  ['debug', false],
  ['disable-log', false],
];

const globalFlags = {
  mock: false,
  log: true,
  debug: false,
};

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
  data.flags(FLAGS);

  const ramFlags = ['--home-ram'];

  const lastArg = args.slice(-1)[0];

  if (lastArg && (ramFlags.includes(lastArg) || Number.isInteger(parseInt(lastArg)))) {
    return RAM_VALUES.map((n) => n.toString());
  }

  return data.servers;
}

export async function main(ns: NS) {
  const cmdFlags = ns.flags(FLAGS);

  const depthPool = cmdFlags['depth-pool'] as number;
  const depthTarget = cmdFlags['depth-target'] as number;
  const homeRamAllocated = cmdFlags['home-ram'] as number;
  const excludes = cmdFlags['exclude'] as string[];
  const cmdTargets = cmdFlags['target'] as string[];

  globalFlags.mock = cmdFlags['dry-run'] as boolean;
  globalFlags.debug = cmdFlags['debug'] as boolean;
  globalFlags.log = !cmdFlags['disable-log'] as boolean;

  setupLogs(ns);

  if (homeRamAllocated > ns.getServerMaxRam('home')) {
    ns.tprint(`ERROR: Home RAM allocation (${homeRamAllocated}) exceeds maximum (${ns.getServerMaxRam('home')})`);
    ns.exit();
  }

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
        status: TARGET_STATUS.PREP,
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

  if (globalFlags.log) {
    ns.print(
      `INFO: === Total RAM: ${ns.formatRam(totalRam)}, Home RAM Total: ${ns.formatRam(ns.getServerMaxRam('home'))}, Home RAM Allocated: ${ns.formatRam(homeRamAllocated)} ===`
    );
  }

  while (true) {
    // for (let i = 0; i < 1; i++) {

    serverPool = getHostsWithRoot(ns, depthPool)
      .filter((host) => ns.getServerMaxRam(host) > 0)
      .map((host) => ({
        host,
        ram: host === 'home' ? homeRamAllocated : ns.getServerMaxRam(host),
      }));

    serverPool.forEach((server) => {
      syncFiles(ns, SCRIPTS.WEAKEN, server.host);
      syncFiles(ns, SCRIPTS.GROW, server.host);
      syncFiles(ns, SCRIPTS.HACK, server.host);
    });

    const currentRam = serverPool
      .map(({ host, ram }) => Math.max(ram - ns.getServerUsedRam(host), 0))
      .reduce((acc, ram) => acc + ram, 0);

    targets.sort((a, b) => {
      const scores = {
        [TARGET_STATUS.HACK]: 2,
        [TARGET_STATUS.PREP]: 1,
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

      if (!target.active) {
        updateTargetMeta(ns, target);
        updateStatus(ns, target);

        planHWGW(ns, target, serverPool, target.status === TARGET_STATUS.PREP);
      } else {
        if (globalFlags.log) {
          ns.print(`INFO: ### ${target.host} ${target.status} ${target.active ? 'active' : ''}`);
        }
      }
    }

    await ns.sleep(CYCLE);
  }
}

function planHWGW(ns: NS, target: Target, serverPool: ServerPooled[], prep: boolean) {
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
      threads: 1,
      delay: weakenTime - growTime + OFFSET * 2,
    },
    weakenGrow: {
      threads: 1,
      delay: OFFSET * 3,
    },
  };

  if (hasFormulas) {
    const hacking = ns.formulas.hacking;
    const targetServer = ns.getServer(target.host);
    const player = ns.getPlayer();

    batch.hack.threads = Math.max(Math.ceil(HACK_PERCENTAGE / hacking.hackPercent(targetServer, player)), 1);

    const targetServerAfterHack = {
      ...targetServer,
      hackDifficulty: target.securityMin + securityIncreasePerHack * batch.hack.threads,
    };

    const weakenRequired = prep
      ? ns.getServerSecurityLevel(target.host) - target.securityMin
      : ns.hackAnalyzeSecurity(batch.hack.threads, target.host);

    batch.weakenHack.threads = Math.max(Math.ceil(weakenRequired / weakenPerThread), 1);

    const targetServerAfterWeaken = {
      ...targetServer,
      moneyAvailable: prep
        ? target.moneyAvail
        : (1 - ns.formulas.hacking.hackPercent(targetServer, player) * batch.hack.threads) * target.moneyMax,
    };

    batch.grow.threads = Math.max(ns.formulas.hacking.growThreads(targetServerAfterWeaken, player, target.moneyMax), 1);

    batch.weakenGrow.threads = Math.max(Math.ceil(ns.growthAnalyzeSecurity(batch.grow.threads) / weakenPerThread), 1);
  } else {
    const weakenRequired = prep
      ? ns.getServerSecurityLevel(target.host) - target.securityMin
      : ns.hackAnalyzeSecurity(batch.hack.threads, target.host);

    const growMult = prep ? 1 / (target.moneyAvail / target.moneyMax) : 1 / (1 - HACK_PERCENTAGE - 0.05);

    batch.weakenHack.threads = Math.max(Math.ceil(weakenRequired / weakenPerThread), 1);
    batch.grow.threads = Math.max(Math.ceil(ns.growthAnalyze(target.host, growMult)), 1);
    batch.weakenGrow.threads = Math.max(Math.ceil(ns.growthAnalyzeSecurity(batch.grow.threads) / weakenPerThread), 1);
  }

  const totalThreadsNeeded = Object.values(batch).reduce((acc, batchDetails) => acc + batchDetails.threads, 0);

  if (globalFlags.debug) {
    ns.print(`Host: ${target.host}`);
    ns.print(`Weaken Per Thread: ${weakenPerThread}`);
    ns.print(`Hack Threads: ${batch.hack.threads}`);
    const securityIncreaseAfterHack = ns.hackAnalyzeSecurity(batch.hack.threads, target.host);
    ns.print(`Security Increase After Hack: ${securityIncreaseAfterHack}`);
    ns.print(`Weaken Threads After Hack: ${batch.weakenHack.threads}`);
    ns.print(`Grow Threads: ${batch.grow.threads}`);
    const securityIncreaseAfterGrow = ns.growthAnalyzeSecurity(batch.grow.threads);
    ns.print(`Security Increase After Grow: ${securityIncreaseAfterGrow}`);
    ns.print(`Weaken Threads After Grow: ${batch.weakenGrow.threads}`);
    ns.print(`${hackTime} (${ns.tFormat(hackTime)})`);
    ns.print(`${growTime} (${ns.tFormat(growTime)})`);
    ns.print(`${weakenTime} (${ns.tFormat(weakenTime)})`);
  }

  if (globalFlags.mock) {
    return;
  }

  const servers = getServerWithFreeThreads(ns, SCRIPTS.GROW, serverPool);
  const totalAvailable = servers.reduce((acc, server) => acc + server.threadsAvailable, 0);

  if (totalAvailable < totalThreadsNeeded) {
    if (globalFlags.log) {
      ns.print(
        `ERROR: ### ${target.host} ${target.status} insufficient threads ${totalAvailable}/${totalThreadsNeeded}.`
      );
    }
    return;
  }

  if (!prep) {
    const hackRes = runOperation(ns, SCRIPTS.HACK, target.host, batch.hack.threads, serverPool, {
      delay: batch.hack.delay,
    });
    target.activePids = hackRes.pids;
  }
  const weakenHackRes = runOperation(ns, SCRIPTS.WEAKEN, target.host, batch.weakenHack.threads, serverPool, {
    delay: batch.weakenHack.delay,
  });
  const growRes = runOperation(ns, SCRIPTS.GROW, target.host, batch.grow.threads, serverPool, {
    delay: batch.grow.delay,
  });
  const weakenGrowRes = runOperation(ns, SCRIPTS.WEAKEN, target.host, batch.weakenGrow.threads, serverPool, {
    delay: batch.weakenGrow.delay,
  });

  target.activePids = target.activePids.concat([...weakenHackRes.pids, ...growRes.pids, ...weakenGrowRes.pids]);
  target.active = true;

  if (globalFlags.log) {
    ns.print(`SUCCESS: ### ${target.host} ${target.status}`);
  }
}

function runOperation(
  ns: NS,
  script: typeof SCRIPTS.WEAKEN | typeof SCRIPTS.GROW | typeof SCRIPTS.HACK,
  target: string,
  threads: number,
  serverPool: ServerPooled[],
  opts: RunOperationOpts = {
    spreadEvenly: false,
    delay: 0,
  }
) {
  const { spreadEvenly, delay } = opts;
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

        const pid = ns.exec(script, server.host, threadsToCreate, '--target', target, '--sleep-during', sleep);
        counter += threadsToCreate;
        pids.push(pid);

        if (counter >= threads) {
          break;
        }
      }
    }
  }

  if (globalFlags.debug) {
    ns.print(`INFO: ${counter} / ${threads} threads (started / requested)`);
  }

  return { threads: counter, pids };
}

function updateStatus(ns: NS, target: Target): void {
  const meetsSecurityTarget = target.securityCurr === target.securityMin;
  const meetsMoneyTarget = target.moneyAvail === target.moneyMax;

  target.status = meetsMoneyTarget && meetsSecurityTarget ? TARGET_STATUS.HACK : TARGET_STATUS.PREP;
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
  if (globalFlags.log) {
    ns.clearLog();
    ns.disableLog('ALL');
    ns.enableLog('sleep');
    ns.ui.openTail(ns.pid);
  }
}
