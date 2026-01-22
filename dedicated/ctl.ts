import { COLORS } from "../utils/colors";
import {
  getHostFlag,
  printMissingHostError,
  isPowerOfTwo,
} from "../utils/flags";

export async function main(ns: NS) {
  const cmdFlags = ns.flags([
    ["rename", false],
    ["buy", false],
    ["info", false],
    ["upgrade", false],
    ["old", ""],
    ["new", ""],
    ["h", ""],
    ["host", ""],
    ["count", -1],
    ["all", false],
    ["ram", -1],
    ["original", -1],
    ["dry-run", false],
  ]);

  const host = getHostFlag(ns, cmdFlags);
  const count = cmdFlags.count as number;
  const all = cmdFlags.all as boolean;
  const mock = cmdFlags["dry-run"] as boolean;
  const ram = cmdFlags.ram as number;

  if (cmdFlags.rename) {
    rename(ns, cmdFlags.old as string, cmdFlags.new as string);
  } else if (cmdFlags.info) {
    info(ns);
  } else if (cmdFlags.buy) {
    if (!isPowerOfTwo(ram)) {
      ns.tprint("ERROR: RAM must be > 2 and a power of 2");
      return;
    }

    buy(ns, ram, count > 0 ? count : 1, all, mock);
  } else if (cmdFlags.upgrade) {
    if (!isPowerOfTwo(ram)) {
      ns.tprint("ERROR: RAM must be > 2 and a power of 2");
      return;
    }

    let original = cmdFlags.original as number;

    if (original > 0 && !isPowerOfTwo(original) && original >= ram) {
      ns.tprint(
        "ERROR: Original RAM must be > 2, a power of 2, and smaller than upgrade target",
      );
      return;
    } else {
      original = 0;
    }

    if (!all && !host) {
      printMissingHostError(ns);
      return;
    }

    upgrade(ns, ram, host === null ? "" : host, all, original, mock);
  }
}

function rename(ns: NS, o: string, n: string) {
  if (o === "" || n === "") {
    ns.tprint("ERROR: Missing old or new hostname");
    return;
  }

  ns.renamePurchasedServer(o, n);
  ns.tprint(`INFO: Successfully renamed ${o} to ${n}`);
}

function buy(
  ns: NS,
  ram: number,
  count: number = 1,
  all: boolean = false,
  mock: boolean = false,
) {
  const servers = ns.getPurchasedServers();
  const limit = ns.getPurchasedServerLimit();
  const avail = limit - servers.length;
  const cost = ns.getPurchasedServerCost(ram);
  const balance = ns.getServerMoneyAvailable("home");
  let hostnameCounter = servers.length;

  if (all) {
    const afford = Math.floor(balance / cost);
    const budget = Math.min(avail, afford);

    for (let i = 0; i < budget; i++) {
      let newHost = "";

      if (mock) {
        newHost = `server-${hostnameCounter++}`;
      } else {
        newHost = ns.purchaseServer(`server-${hostnameCounter++}`, ram);
      }

      ns.tprint(
        `INFO: Bought new server ${newHost} with ${ns.formatRam(ram)} of ram for ${ns.formatNumber(cost)}`,
      );
    }

    ns.tprint(
      `SUCCESS: Bought ${budget} servers for ${ns.formatNumber(budget * cost)}`,
    );
  } else {
    const afford = Math.floor((balance / cost) * count);
    if (afford === 0) {
      ns.tprint(
        `ERROR: Insufficient balance. Current: ${balance}, Cost(count/single): ${ns.formatNumber(cost * count)}/${ns.formatNumber(cost)}`,
      );
    }

    const budget = Math.min(avail, count);

    for (let i = 0; i < budget; i++) {
      let newHost = "";

      if (mock) {
        newHost = `server-${hostnameCounter++}`;
      } else {
        newHost = ns.purchaseServer(`server-${hostnameCounter++}`, ram);
      }

      ns.tprint(
        `INFO: Bought new server ${newHost} with ${ns.formatRam(ram)} of ram for ${ns.formatNumber(cost)}`,
      );
    }

    ns.tprint(
      `SUCCESS: Bought ${budget} servers for ${ns.formatNumber(budget * cost)}`,
    );
  }
}

function info(ns: NS) {
  const servers = ns.getPurchasedServers();
  const limit = ns.getPurchasedServerLimit();

  ns.tprintf(
    `# ${COLORS.CYAN}Currently owned: ${servers.length}/${limit}${COLORS.RESET}`,
  );

  for (const host of servers) {
    const server: Record<string, any> = {
      root: ns.hasRootAccess(host),
      ramMax: ns.getServerMaxRam(host),
      ramUsed: ns.getServerUsedRam(host),
    };

    server.upgradeCost = ns.getPurchasedServerUpgradeCost(
      host,
      server.ramMax * 2,
    );

    ns.tprintf(`${COLORS.MAGENTA}* ${host}${COLORS.RESET}`);

    ns.tprintf(`- RAM Max: ${ns.formatRam(server.ramMax)}`);
    ns.tprintf(`- RAM Used: ${ns.formatRam(server.ramUsed)}`);
    ns.tprintf(`- RAM Free: ${ns.formatRam(server.ramMax - server.ramUsed)}`);
    ns.tprintf(`- RAM Upgrade Cost: $${ns.formatNumber(server.upgradeCost)}`);
  }
}

function upgrade(
  ns: NS,
  to: number,
  host: string = "",
  all: boolean = false,
  original: number = 0,
  mock: boolean = false,
) {
  if (all) {
    const eligibleServers = ns
      .getPurchasedServers()
      .map((server) => {
        return {
          server,
          existingRam: ns.getServerMaxRam(server),
          upgradePrice: ns.getPurchasedServerUpgradeCost(server, to),
        };
      })
      .filter((server) => {
        if (original > 0) {
          return server.existingRam === original;
        } else {
          return server.existingRam < to;
        }
      });

    const totalPrice = eligibleServers.reduce((prev, curr) => {
      return prev + curr.upgradePrice;
    }, 0);

    for (const server of eligibleServers) {
      ns.tprint(
        `INFO: Upgrading ${server.server} from ${ns.formatRam(server.existingRam)} to ${ns.formatRam(to)} costing ${ns.formatNumber(server.upgradePrice)}.`,
      );

      if (!mock) {
        ns.upgradePurchasedServer(server.server, to);
      }
    }

    ns.tprint(
      `SUCCESS: Upgraded ${eligibleServers.length} servers for ${ns.formatNumber(totalPrice)} in total.`,
    );
  } else if (host) {
    const existingRam = ns.getServerMaxRam(host);

    if (existingRam >= to) {
      ns.tprint(`ERROR: Host has more RAM than specified upgrade`);
      return;
    }

    const upgradePrice = ns.getPurchasedServerUpgradeCost(host, to);

    ns.tprint(
      `SUCCESS: Upgrading ${host} from ${ns.formatRam(existingRam)} to ${ns.formatRam(to)} costing ${ns.formatNumber(upgradePrice)}.`,
    );

    if (!mock) {
      ns.upgradePurchasedServer(host, to);
    }
  }
}
