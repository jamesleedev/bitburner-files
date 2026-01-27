const FLAGS: [string, ScriptArg | string[]][] = [
  ['sleep-before', 0],
  ['sleep-during', 0],
  ['sleep-after', 0],
  ['target', ''],
];

export async function main(ns: NS) {
  const cmdFlags = ns.flags(FLAGS);

  const sleepBefore = cmdFlags['sleep-before'] as number;
  const sleepDuring = cmdFlags['sleep-during'] as number;
  const sleepAfter = cmdFlags['sleep-after'] as number;
  const host = cmdFlags.target as string;

  if (sleepBefore > 0) {
    await ns.sleep(sleepBefore);
  }

  await ns.grow(host, { additionalMsec: sleepDuring });

  if (sleepAfter > 0) {
    await ns.sleep(sleepAfter);
  }
}
