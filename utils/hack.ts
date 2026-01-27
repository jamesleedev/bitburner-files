export function getMaxScriptThreads(ns: NS, script: string, free: number) {
  const threads = Math.floor(free / ns.getScriptRam(script));

  return Number.isFinite(threads) && !Number.isNaN ? threads : 0;
}

export function getWeakenThreads(ns: NS, securityMin: number, securityCurr: number): number {
  const securityDiff = securityCurr - securityMin;
  const weakenPerThread = ns.weakenAnalyze(1);

  return Math.ceil(securityDiff / weakenPerThread);
}

export function getGrowThreads(ns: NS, host: string): number {
  const multiplier = ns.getServerMaxMoney(host) / ns.getServerMoneyAvailable(host);
  const threads = ns.growthAnalyze(host, multiplier);

  return Math.ceil(threads);
}
