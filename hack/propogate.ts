import { getTree } from 'neighbours/utils';

export async function main(ns: NS) {
  const cmdFlags = ns.flags([
    ['script', ''],
    ['target', ''],
    ['depth', 1],
    ['base', '']
  ])
  const scriptName = cmdFlags.script as string;
  const target = cmdFlags.target as string;
  const depth = cmdFlags.depth as number;
  const base = cmdFlags.base as string;

  const nodes = base && base !== '' ? [base] : getTree(ns, depth).map((n) => {
    return n.host
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
      const instances = Math.floor(ns.getServerMaxRam(host) / ns.getScriptRam(scriptName));
      //ns.tprint(`INFO Host: ${host}`)
      //ns.tprint(`INFO Instances: ${instances}`)
      //ns.tprint(`INFO Host Max RAM: ${ns.getServerMaxRam(host)}`)
      //ns.tprint(`INFO Script RAM: ${ns.getScriptRam(scriptName)}`)

      ns.killall(host);
      ns.tprint(`SUCCESS ${host}: killing all scripts`);

      ns.scp(scriptName, host);
      ns.tprint(`SUCCESS ${host}: copying latest script`);

      if (instances > 0) {
        ns.exec(scriptName, host, instances, target);
        ns.tprint(`SUCCESS ${host}: Started ${instances} thread(s) of script ${scriptName} with args of [${target}].`)
        totalThreads += instances;
      }
    }
  }

  ns.tprint(`INFO: Started a total of ${totalThreads} threads.`)
}