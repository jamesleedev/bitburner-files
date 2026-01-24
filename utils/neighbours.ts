export async function main(ns: NS) {
  ns.tprint('ERROR: this is a util library.');
}

export interface Node {
  host: string;
  parent: string | null;
  children: string[] | null;
}

export type FlatNode = Record<Node['host'], Omit<Node, 'host'>>;

export function getChildren(ns: NS, host: string = 'home', parent: string | null = null): string[] | null {
  const children = ns.scan(host).filter((n) => n !== parent);

  return children.length === 0 ? null : children;
}

export function getNodes(ns: NS, depth: number = 1, start: string = 'home'): Node[] {
  const nodes: Node[] = [];

  let currentQueue: Node[] = [
    {
      host: start,
      children: null,
      parent: null,
    },
  ];

  for (let i = 0; i < depth; i++) {
    let nextQueue: Node[] = [];

    while (currentQueue.length > 0) {
      const curr = currentQueue.shift() as Node;
      const children = getChildren(ns, curr.host, curr.parent);

      nodes.push({ ...curr, children });

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

  return nodes;
}

export function getHost(ns: NS, depth: number = 1, start: string = 'home'): string[] {
  return getNodes(ns, depth, start).map((n) => n.host);
}

export function getFlatNodes(ns: NS, depth: number = 1, start: string = 'home'): FlatNode {
  const nodes = getNodes(ns, depth, start);

  const flatNodes: FlatNode = {};

  for (const node of nodes) {
    flatNodes[node.host] = {
      parent: node.parent,
      children: node.children,
    };
  }

  return flatNodes;
}
