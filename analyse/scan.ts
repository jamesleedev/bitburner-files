import { COLORS } from 'utils/colors';
import { type Node, getNodes } from '../utils/neighbours';
import type { Flags } from '../utils/flags';

const FLAGS: Flags = [
  ['d', 0],
  ['depth', 1],
  ['base', ''],
];

interface HostWithDepth {
  host: string;
  depth: number;
}

export async function main(ns: NS) {
  const cmdFlags = ns.flags(FLAGS);

  const depth = Math.max(cmdFlags.depth as number, cmdFlags.d as number);
  const base = cmdFlags.base === '' ? 'home' : (cmdFlags.base as string);

  const nodes = getNodes(ns, depth + 1, base);
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

  for (const host of hosts) {
    printHostInfo(ns, host.host, host.depth);
  }
}

function printHostInfo(ns: NS, host: string, depth: number) {
  const server = {
    root: ns.hasRootAccess(host),
    ramMax: ns.getServerMaxRam(host),
    ramUsed: ns.getServerUsedRam(host),
    moneyMax: ns.getServerMaxMoney(host),
    moneyAvail: ns.getServerMoneyAvailable(host),
    securityMin: ns.getServerMinSecurityLevel(host),
    securityCurr: ns.getServerSecurityLevel(host),
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

  ns.tprintf(
    `${depth > 0 ? prefix : ''}` +
      `${server.root ? COLORS.GREEN : COLORS.RED}${host}${COLORS.RESET}` +
      ` | ${COLORS.CYAN}${ns.formatRam(server.ramMax)}${COLORS.RESET}` +
      ` | ${COLORS.YELLOW}$${moneyMax}` +
      ` | ${moneyPercent}%${COLORS.RESET}` +
      ` | ${COLORS.MAGENTA}${server.securityMin}` +
      ` | ${server.securityCurr}` +
      ` | ${securityDiff}${COLORS.RESET}` +
      hackingSuffix
  );
}
