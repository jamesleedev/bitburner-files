import { getNodes } from 'utils/neighbours';
import type { Flags } from 'utils/flags';

const FLAGS: Flags = [
  ['script', ''],
  ['target', ''],
  ['depth', 1],
  ['host', ''],
  ['kill', false],
];

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
  const servers = data.servers;
  const scripts = data.scripts;
  data.flags(FLAGS);

  if (args.length === 0) {
    return [];
  }

  return [...servers, ...scripts];
}

export async function main(ns: NS) {
  const cmdFlags = ns.flags(FLAGS);
  const scriptName = cmdFlags.script as string;
  const target = cmdFlags.target as string;
  const depth = cmdFlags.depth as number;
  const singleHost = cmdFlags.host as string;
  const killAll = cmdFlags.kill as boolean;

  const nodes =
    singleHost && singleHost !== ''
      ? [singleHost]
      : getNodes(ns, depth).map((n) => {
          return n.host;
        });

  if (!scriptName) {
    ns.tprint('ERROR missing script name to propogate');
  }

  if (!target) {
    ns.tprint('ERROR missing target server to hack');
  }

  if (!depth) {
    ns.tprint('ERROR parsing depth');
  }

  let totalThreads = 0;

  for (const host of nodes) {
    if (ns.hasRootAccess(host) && host !== 'home') {
      let instances: number = 0;
      const scriptRam = ns.getScriptRam(scriptName);
      const server: Record<string, any> = {
        maxRam: ns.getServerMaxRam(host),
        usedRam: ns.getServerUsedRam(host),
      };
      server.freeRam = server.maxRam - server.usedRam;

      //ns.tprint(`INFO Host: ${host}`)
      //ns.tprint(`INFO Instances: ${instances}`)
      //ns.tprint(`INFO Host Max RAM: ${ns.getServerMaxRam(host)}`)
      //ns.tprint(`INFO Script RAM: ${ns.getScriptRam(scriptName)}`)

      if (killAll) {
        ns.killall(host);
        ns.tprint(`SUCCESS ${host}: killing all scripts`);
        instances = Math.floor(server.maxRam / scriptRam);
      } else {
        instances = Math.floor(server.freeRam / scriptRam);
      }

      ns.scp(scriptName, host);
      ns.tprint(`SUCCESS ${host}: copying latest script`);

      if (instances > 0) {
        ns.exec(scriptName, host, instances, target);
        ns.tprint(`SUCCESS ${host}: Started ${instances} thread(s) of script ${scriptName} with args of [${target}].`);
        totalThreads += instances;
      }
    }
  }

  ns.tprint(`INFO: Started a total of ${totalThreads} threads.`);
}
