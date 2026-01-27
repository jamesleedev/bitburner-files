import { COLORS } from 'utils/colors';
import { type Node, getNodes } from '../utils/neighbours';
import type { Flags } from '../utils/flags';

const FLAGS: Flags = [
  ['d', 0],
  ['depth', 1],
  ['base', ''],
  ['external', false],
  ['watch', -1],
  ['legend', false],
];

interface HostWithDepth {
  host: string;
  depth: number;
}

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
  data.flags(FLAGS);

  return [];
}

export async function main(ns: NS) {
  const cmdFlags = ns.flags(FLAGS);

  const depth = Math.max(cmdFlags.depth as number, cmdFlags.d as number);
  const base = cmdFlags.base === '' ? 'home' : (cmdFlags.base as string);
  const external = cmdFlags.external as boolean;
  const watch = cmdFlags.watch as number;
  const watchEnabled = watch > 0;
  const legend = cmdFlags.legend as boolean;

  if (watchEnabled) {
    ns.ui.openTail(ns.pid);
    ns.atExit(() => ns.ui.closeTail(ns.pid));
    ns.disableLog('ALL');
    ns.enableLog('sleep');
  }

  const nodes = getNodes(ns, depth + 1, base).filter((node) =>
    external ? !ns.getPurchasedServers().includes(node.host) : true
  );
  const baseNode = nodes[0];

  let hosts: HostWithDepth[] = [{ host: base, depth: 0 }];

  let queue: Node[] = nodes.filter((node) => baseNode?.children?.includes(node.host));

  while (queue.length > 0) {
    const currentNode = queue.shift()!;
    const host = currentNode.host;
    const parent = currentNode.parent;
    const nodeDepth = hosts.find((host) => host.host === parent)!.depth + 1;
    const children = currentNode.children;

    if (children === null) {
      hosts.push({ host, depth: nodeDepth });
    } else {
      if (nodeDepth <= depth) {
        const childNodes = nodes.filter((node) => node.parent === host);

        queue.unshift(...childNodes);

        hosts.push({ host, depth: nodeDepth });
      }
    }
  }

  if (legend) {
    printHeader(ns, watchEnabled);
  }

  while (true) {
    for (const host of hosts) {
      printHostInfo(ns, host.host, host.depth, watch > 0);
    }

    if (!watchEnabled) {
      break;
    }

    await ns.sleep(watch * 1_000);
  }
}

function printHostInfo(ns: NS, host: string, depth: number, watch: boolean) {
  const server = {
    root: ns.hasRootAccess(host),
    ramMax: ns.getServerMaxRam(host),
    ramUsed: ns.getServerUsedRam(host),
    moneyMax: ns.getServerMaxMoney(host),
    moneyAvail: ns.getServerMoneyAvailable(host),
    growTime: ns.getGrowTime(host),
    securityMin: ns.getServerMinSecurityLevel(host),
    securityCurr: ns.getServerSecurityLevel(host),
    weakenTime: ns.getWeakenTime(host),
    hackingLevel: ns.getServerRequiredHackingLevel(host),
    portsNeeded: ns.getServerNumPortsRequired(host),
  };

  const moneyPercent = ns.formatPercent(server.moneyAvail !== 0 ? server.moneyAvail / server.moneyMax : 0);
  const moneyMax = ns.formatNumber(server.moneyMax);
  const securityDiff = server.securityCurr - server.securityMin;

  const prefix = depth + '-'.repeat(Math.max(depth * 2 - 2, 0)) + '-> ';

  const hackingSuffix = server.root
    ? ''
    : ` | ${COLORS.RED}${server.hackingLevel} | ${server.portsNeeded}${COLORS.RESET}`;

  const output =
    `${depth > 0 ? prefix : ''}` +
    `${server.root ? COLORS.GREEN : COLORS.RED}${host}${COLORS.RESET}` +
    ` | ${COLORS.CYAN}${ns.formatRam(server.ramMax)}${COLORS.RESET}` +
    ` | ${COLORS.YELLOW}$${moneyMax}` +
    ` | ${server.moneyMax - server.moneyAvail > 0 ? COLORS.RED : COLORS.GREEN}${moneyPercent}%${COLORS.RESET}${COLORS.YELLOW}` +
    ` | ${ns.tFormat(server.growTime)}${COLORS.RESET}` +
    ` | ${COLORS.MAGENTA}${ns.formatNumber(server.securityMin, 2, 1000, true)}` +
    ` | ${ns.formatNumber(server.securityCurr, 2, 1000, true)}` +
    ` | ${securityDiff === 0 ? COLORS.GREEN : COLORS.YELLOW}${ns.formatNumber(securityDiff, 2, 1000, true)}${COLORS.RESET}${COLORS.MAGENTA}` +
    ` | ${ns.tFormat(server.weakenTime)}${COLORS.RESET}` +
    hackingSuffix;

  watch ? ns.printf(output) : ns.tprintf(output);
}

function printHeader(ns: NS, watch: boolean) {
  const header =
    `${COLORS.CYAN}Host${COLORS.RESET}` +
    ` ${COLORS.WHITE}|${COLORS.RESET} ${COLORS.CYAN}RAM${COLORS.RESET}` +
    ` ${COLORS.WHITE}|${COLORS.RESET} ${COLORS.YELLOW}Money${COLORS.RESET}` +
    ` ${COLORS.WHITE}|${COLORS.RESET} ${COLORS.YELLOW}Money%%${COLORS.RESET}` +
    ` ${COLORS.WHITE}|${COLORS.RESET} ${COLORS.YELLOW}Grow Time${COLORS.RESET}` +
    ` ${COLORS.WHITE}|${COLORS.RESET} ${COLORS.MAGENTA}Min Sec${COLORS.RESET}` +
    ` ${COLORS.WHITE}|${COLORS.RESET} ${COLORS.MAGENTA}Curr Sec${COLORS.RESET}` +
    ` ${COLORS.WHITE}|${COLORS.RESET} ${COLORS.MAGENTA}Diff Sec${COLORS.RESET}` +
    ` ${COLORS.WHITE}|${COLORS.RESET} ${COLORS.MAGENTA}Weaken Time${COLORS.RESET}` +
    ` ${COLORS.WHITE}|${COLORS.RESET} ${COLORS.RED}[Hacking Lvl]${COLORS.RESET}` +
    ` ${COLORS.WHITE}|${COLORS.RESET} ${COLORS.RED}[Ports]${COLORS.RESET}\n\n`;

  watch ? ns.printf(header) : ns.tprintf(header);
}
