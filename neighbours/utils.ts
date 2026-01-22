export async function main(ns: NS) {
  ns.tprint("ERROR: this is a util library.")
}

export interface Node {
  host: string;
  parent: string | null;
  children: string [] | null;
}

export type FlatNode = Record<Node['host'], Omit<Node, 'host'>>

export function getChildren(
  ns: NS,
  host: string = 'home',
  parent: string | null = null
): string[] | null {
  const children = ns.scan(host).filter((n) => n !== parent);

  return children.length === 0 ? null : children;
}

export function getTree(
  ns: NS,
  depth: number = 1,
  start: string = 'home',
): Node[] {
  const tree: Node[] = [];
  
  let currentQueue: Node[] = [
    {
      host: start,
      children: null,
      parent: null,
    }
  ];

  for (let i = 0; i < depth; i++) {
    //ns.tprint(`INFO depth: `, i);
    let nextQueue: Node[] = [];

    while (currentQueue.length > 0) {
      const curr = currentQueue.shift() as Node;
      const children = getChildren(ns, curr.host, curr.parent);

      tree.push({...curr, children});
      

      if (children) {
        nextQueue = nextQueue.concat(children.map((c) => {
          return {
            host: c,
            parent: curr.host,
            children: null,
          }
        }));
      }
    }

    currentQueue = nextQueue;
  }

  return tree;
}

