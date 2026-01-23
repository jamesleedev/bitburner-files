import { COLORS } from 'utils/colors';

interface Node {
  host: string;
  parent: string | null;
  children: string[] | null;
}

export async function main(ns: NS) {
  const depth: number = (ns?.args[0] as number) > 1 ? (ns.args[0] as number) : 1;
  const nodes = getTree(ns, depth);

  ns.tprint(nodes);

  nodes.map((node) => {
    ns.tprint(`INFO node.host: `, node.host);
  });
}

function getChildren(ns: NS, host: string = 'home', parent: string | null = null): string[] | null {
  const children = ns.scan(host).filter((n) => n !== parent);

  return children.length === 0 ? null : children;
}

function getTree(ns: NS, depth: number = 1, start: string = 'home'): Node[] {
  const tree: Node[] = [];

  let currentQueue: Node[] = [
    {
      host: start,
      children: null,
      parent: null,
    },
  ];

  for (let i = 0; i < depth; i++) {
    ns.tprint(`INFO depth: `, i);
    let nextQueue: Node[] = [];

    while (currentQueue.length > 0) {
      const curr = currentQueue.shift() as Node;
      const children = getChildren(ns, curr.host, curr.parent);

      tree.push({ ...curr, children });

      if (children) {
        nextQueue = nextQueue.concat(
          children.map((c) => {
            return {
              host: c,
              parent: curr.host,
              children: null,
            };
          })
        );
      }
    }

    currentQueue = nextQueue;
  }

  return tree;
}

function printHostInfo(ns: NS, host: string) {
  const hasRoot = ns.hasRootAccess(host);

  ns.tprintf(`${COLORS.CYAN}# ${host}${COLORS.RESET}`);
  ns.tprintf(`* Max money: ${ns.formatNumber(ns.getServerMaxMoney(host))}`);
  ns.tprintf(`* RAM: ${ns.formatRam(ns.getServerMaxRam(host))}`);
  ns.tprintf(`${hasRoot ? COLORS.GREEN : COLORS.RED}* Root: ${hasRoot}${COLORS.RESET}`);
  ns.tprintf('\n');
}
