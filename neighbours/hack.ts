const COLORS = {
  RED: '\u001b[31m',
  GREEN: '\u001b[32m',
  YELLOW: '\u001b[33m',
  CYAN: '\u001b[36m',
  RESET: '\u001b[0m',
}

interface Cracks {
  [key: string]: {
    available: boolean;
    func: (host: string) => boolean;
  }
}

export async function main(ns: NS) {
  const mock = ns.args.length >= 2 && ns.args[1] === 'mock';

  const base = ns.args.length >= 1 && typeof ns.args[0] === "string" ? ns.args[0] : 'home';

  const cracks = getPortCracks(ns);
  const cracksAvail = Object.entries(cracks).filter((crack) => {
    return crack[1].available;
  });

  const neighbors = ns.scan(base);
  const hackingLevel = ns.getHackingLevel();
  const portsAvailable = Object.values(cracks).reduce((prev, curr) => {
    return prev + (curr.available ? 1 : 0);
  }, 0);

  ns.tprintf(`${COLORS.CYAN}Hacking level: ${hackingLevel}, ports hackable: ${portsAvailable}${COLORS.RESET}\n\n`);

  for (const host of neighbors) {
    const hasRoot = ns.hasRootAccess(host);
    const portsRequired = ns.getServerNumPortsRequired(host);
    const hackingLevelRequired = ns.getServerRequiredHackingLevel(host);
    const serverMaxMoney = ns.getServerMaxMoney(host);

    ns.tprintf(`${COLORS.CYAN}= ${host}`);
    ns.tprintf(`${ns.formatNumber(serverMaxMoney)}${COLORS.RESET}`);

    if (hasRoot) {
      ns.tprintf(`${COLORS.GREEN}# Already root${COLORS.RESET}`);
      ns.tprintf('\n++++++++++\n\n');
      continue;
    }

    const needPorts = portsRequired > portsAvailable;
    const canHack = hackingLevelRequired <= hackingLevel;

    ns.tprintf(needPorts ? `${COLORS.YELLOW}- ports: %v${COLORS.RESET}` : `${COLORS.GREEN}- ports: %v${COLORS.RESET}`, portsRequired);
    ns.tprintf(canHack ? `${COLORS.GREEN}- level: %v${COLORS.RESET}` : `${COLORS.YELLOW}- level: %v${COLORS.RESET}`, hackingLevelRequired);


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
      ns.tprintf(`${COLORS.RED}# Missing requirements${COLORS.RESET}`)
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
  }
}