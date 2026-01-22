export async function main(ns: NS) {
  const scriptName = ns.args[0] as string ?? '';
  const target = ns.args[1] as string ?? '';
  const base = ns.args.length >= 3 && typeof ns.args[2] === "string" ? ns.args[2] : 'home';

  if (!scriptName) {
    ns.tprint('ERROR missing script name to propogate');
  }

  if (!target) {
    ns.tprint('ERROR missing target server to hack');
  }

  for (const host of ns.scan(base)) {
    if (ns.hasRootAccess(host) && host !== 'home') {
      const instances = Math.floor(ns.getServerMaxRam(host) / ns.getScriptRam(scriptName));
      //ns.tprint(`INFO Host: ${host}`)
      //ns.tprint(`INFO Instances: ${instances}`)
      //ns.tprint(`INFO Host Max RAM: ${ns.getServerMaxRam(host)}`)
      //ns.tprint(`INFO Script RAM: ${ns.getScriptRam(scriptName)}`)

      ns.killall(host);
      ns.scp(scriptName, host);
      if (instances > 0) {
        ns.exec(scriptName, host, instances, target);
        ns.tprint(`SUCCESS: Started ${instances} thread(s) of script ${scriptName} with args of [${target}] on ${host}.`)
      }
    }
  }
}