import { getHostsWithRoot } from 'utils/neighbours';

export async function main(ns: NS) {
  const hosts = getHostsWithRoot(ns, 30);

  for (const host of hosts) {
    ns.killall(host);
  }
}
