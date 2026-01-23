export async function main(ns: NS) {
  const cmdFlags = ns.flags([
    ['host', ''],
    ['h', ''],
  ]);

  const target = getHostFlag(ns, cmdFlags, true, true);

  if (!target) {
    return;
  }

  // Defines how much money a server should have before we hack it
  // In this case, it is set to the maximum amount of money.
  const moneyThresh = ns.getServerMaxMoney(target);

  // Defines the minimum security level the target server can
  // have. If the target's security level is higher than this,
  // we'll weaken it before doing anything else
  const securityThresh = ns.getServerMinSecurityLevel(target) + 0.05;

  // If we have the BruteSSH.exe program, use it to open the SSH Port
  // on the target server
  //if (ns.fileExists("BruteSSH.exe", "home")) {
  //    ns.brutessh(target);
  //}

  // Get root access to target server
  //ns.nuke(target);

  // Infinite loop that continously hacks/grows/weakens the target server
  while (true) {
    if (ns.getServerSecurityLevel(target) > securityThresh) {
      // If the server's security level is above our threshold, weaken it
      await ns.weaken(target);
    } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
      // If the server's money is less than our threshold, grow it
      await ns.grow(target);
    } else {
      // Otherwise, hack it
      await ns.hack(target);
    }
  }
}

type CmdFlags = Record<string, ScriptArg | string[]>;

function getHostFlag(
  ns: NS,
  cmdFlags: CmdFlags,
  includePositional: boolean = false,
  printError: boolean = false
): string | null {
  const filter = includePositional ? ['_', 'h', 'host'] : ['h', 'host'];

  let hostFlags = Object.entries(cmdFlags).filter((flag) => filter.includes(flag[0]));

  let hostArgs = hostFlags
    .map((flag) => {
      const arg = flag[1];

      return arg instanceof Array ? [flag[0], arg[0]] : flag;
    })
    .filter((flag) => flag[1] && flag[1] !== '');

  if (hostArgs.length === 0) {
    if (printError) {
      printMissingHostError(ns);
    }

    return null;
  }

  const host = hostArgs[0][1] as string;

  return host;
}

export function printMissingHostError(ns: NS): void {
  ns.tprint(`ERROR: missing host`);
}
