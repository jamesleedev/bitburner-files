import { getHosts } from 'utils/neighbours';
import { COLORS } from 'utils/colors';
import type { Flags } from 'utils/flags';

interface Cracks {
  [key: string]: {
    available: boolean;
    func: (host: string) => boolean;
  };
}

const FLAGS: Flags = [
  ['mock', false],
  ['d', -1],
  ['depth', 1],
  ['verbose', false],
  ['v', false],
];

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
  data.flags(FLAGS);

  return [];
}

export async function main(ns: NS) {
  const cmdFlags = ns.flags(FLAGS);

  const mock = cmdFlags.mock;
  const depth = Math.max(cmdFlags.d as number, cmdFlags.depth as number);
  const verbose = (cmdFlags.verbose as boolean) || (cmdFlags.v as boolean);

  const cracks = getPortCracks(ns);
  const cracksAvail = Object.entries(cracks).filter((crack) => {
    return crack[1].available;
  });

  const nodes = getHosts(ns, depth);
  const hackingLevel = ns.getHackingLevel();
  const portsAvailable = Object.values(cracks).reduce((prev, curr) => {
    return prev + (curr.available ? 1 : 0);
  }, 0);

  ns.tprintf(`${COLORS.CYAN}Hacking level: ${hackingLevel}, ports hackable: ${portsAvailable}${COLORS.RESET}\n\n`);

  for (const host of nodes) {
    if (host === 'home') {
      continue;
    }

    const hasRoot = ns.hasRootAccess(host);
    const portsRequired = ns.getServerNumPortsRequired(host);
    const hackingLevelRequired = ns.getServerRequiredHackingLevel(host);
    const serverMaxMoney = ns.getServerMaxMoney(host);
    const serverCurrentMoney = ns.getServerMoneyAvailable(host);
    const serverMoneyRatio = serverCurrentMoney / serverMaxMoney;
    const serverMoneyPercent =
      Number.isFinite(serverMoneyRatio) && !Number.isNaN(serverMoneyRatio) ? serverMoneyRatio : 0;
    const serverMaxRam = ns.getServerMaxRam(host);
    const securityMin = ns.getServerMinSecurityLevel(host);
    const securityCurr = ns.getServerSecurityLevel(host);

    ns.tprintf(`${COLORS.CYAN}= ${host}${COLORS.RESET}`);
    if (verbose) {
      ns.tprintf(`* Money Max: ${ns.formatNumber(serverMaxMoney)}`);
      ns.tprintf(`* Money Avail: ${ns.formatNumber(serverCurrentMoney)}`);
      ns.tprintf(`* Money Percent: %v`, ns.formatPercent(serverMoneyPercent));
      ns.tprintf(`* Security Min: ${securityMin}`);
      ns.tprintf(`* Security Current: ${securityCurr}`);
      ns.tprintf(`* RAM: ${ns.formatRam(serverMaxRam)}`);
    }

    if (hasRoot) {
      ns.tprintf(`${COLORS.GREEN}# Already root${COLORS.RESET}`);
      ns.tprintf('\n++++++++++\n\n');
      continue;
    }

    const needPorts = portsRequired > portsAvailable;
    const canHack = hackingLevelRequired <= hackingLevel;

    ns.tprintf(
      needPorts ? `${COLORS.YELLOW}- ports: %v${COLORS.RESET}` : `${COLORS.GREEN}- ports: %v${COLORS.RESET}`,
      portsRequired
    );
    ns.tprintf(
      canHack ? `${COLORS.GREEN}- level: %v${COLORS.RESET}` : `${COLORS.YELLOW}- level: %v${COLORS.RESET}`,
      hackingLevelRequired
    );

    if (!hasRoot && !needPorts && canHack) {
      if (mock) {
        ns.tprintf('mocking nuke');
      } else {
        ns.scp('hack-neighbours.ts', host);
        for (const crack of cracksAvail) {
          crack[1].func(host);
          ns.tprintf(`${COLORS.GREEN}# Opening ${crack[0]}${COLORS.RESET}`);
        }

        ns.nuke(host);
        ns.tprintf(`${COLORS.GREEN}# Nuking${COLORS.RESET}`);
      }
    } else {
      ns.tprintf(`${COLORS.RED}# Missing requirements${COLORS.RESET}`);
    }

    ns.tprintf('\n++++++++++\n\n');
  }
}

function getPortCracks(ns: NS): Cracks {
  return {
    ssh: {
      available: ns.fileExists('BruteSSH.exe', 'home'),
      func: ns.brutessh,
    },
    ftp: {
      available: ns.fileExists('FTPCrack.exe', 'home'),
      func: ns.ftpcrack,
    },
    smtp: {
      available: ns.fileExists('relaySMTP.exe', 'home'),
      func: ns.relaysmtp,
    },
    http: {
      available: ns.fileExists('HTTPWorm.exe', 'home'),
      func: ns.httpworm,
    },
    sql: {
      available: ns.fileExists('SQLInject.exe', 'home'),
      func: ns.sqlinject,
    },
  };
}
