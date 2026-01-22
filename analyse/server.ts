import { COLORS } from 'utils/colors';
import { getHostFlag } from 'utils/flags';

export async function main(ns: NS) {
  const cmdFlags = ns.flags([
    ['host', ''],
    ['h', ''],
  ]);

  const host = getHostFlag(ns, cmdFlags, true, true);

  if (!host) {
    return;
  }

  const server = {
    root: ns.hasRootAccess(host),
    ramMax: ns.getServerMaxRam(host),
    ramUsed: ns.getServerUsedRam(host),
    moneyMax: ns.getServerMaxMoney(host),
    moneyAvail: ns.getServerMoneyAvailable(host),
    moneyPerHack: ns.hackAnalyze(host),
    growthTime: ns.getGrowTime(host),
    growthMultiplier: ns.getServerGrowth(host),
    growNeeded10per: ns.growthAnalyze(host, 1.1),
    growNeeded50per: ns.growthAnalyze(host, 1.5),
    growNeeded2x: ns.growthAnalyze(host, 2),
    securityMin: ns.getServerMinSecurityLevel(host),
    securityCurr: ns.getServerSecurityLevel(host),
    weakenTime: ns.getWeakenTime(host),
    weakenPerThread: ns.weakenAnalyze(1),
    growSecurity: ns.growthAnalyzeSecurity(1, host),
    hackSecurity: ns.hackAnalyzeSecurity(1, host),
  }

  const remainingGrowth = ns.growthAnalyze(host, server.moneyMax / server.moneyAvail);
  const moneyRatio = server.moneyAvail / server.moneyMax
  const moneyPercent = Number.isFinite(moneyRatio) && !Number.isNaN(moneyRatio) ? moneyRatio : 0;

  ns.tprintf(`${COLORS.CYAN}# ${host}${COLORS.RESET}`);


  ns.tprintf(`${COLORS.CYAN}## About${COLORS.RESET}`);

  ns.tprintf(`${COLORS.MAGENTA}### Info${COLORS.RESET}`);
  ns.tprintf(`${server.root ? COLORS.GREEN : COLORS.RED}* Root: ${server.root}${COLORS.RESET}`);
  ns.tprintf(`* RAM Max: ${ns.formatRam(server.ramMax)}`);
  ns.tprintf(`* RAM Used: ${ns.formatRam(server.ramUsed)}`);
  ns.tprintf(`* RAM Free: ${ns.formatRam(server.ramMax - server.ramUsed)}`);

  ns.tprintf(`${COLORS.MAGENTA}### Scripts${COLORS.RESET}`);
  for (const p of ns.ps(host)) {
    ns.tprintf(`* Name: ${p.filename}`);
    ns.tprintf(`  - Threads: ${p.threads}`);
    ns.tprintf(`  - Args: ${p.args}`);
  }


  ns.tprintf(`${COLORS.CYAN}## Hacking${COLORS.RESET}`);

  ns.tprintf(`${COLORS.MAGENTA}### Money${COLORS.RESET}`);
  ns.tprintf(`* Money Max: $${ns.formatNumber(server.moneyMax)}`);
  ns.tprintf(`* Money Available: $${ns.formatNumber(server.moneyAvail)} (%v)`, ns.formatPercent(moneyPercent));
  ns.tprintf(`* Money Per Hack: $${ns.formatNumber(server.moneyPerHack)}`);

  ns.tprintf(`${COLORS.MAGENTA}### Growth${COLORS.RESET}`);
  ns.tprintf(`* Growth Time: ${ns.tFormat(server.growthTime)}`);
  ns.tprintf(`* Growth Multiplier: ${server.growthMultiplier}`);
  ns.tprintf(`* Grow Threads for 10%%: ${server.growNeeded10per} (${ns.tFormat(server.growthTime * server.growNeeded10per)})`);
  ns.tprintf(`* Grow Threads for 50%%: ${server.growNeeded50per} (${ns.tFormat(server.growthTime * server.growNeeded50per)})`);
  ns.tprintf(`* Grow Threads for 2x: ${server.growNeeded2x} (${ns.tFormat(server.growthTime * server.growNeeded2x)})`);
  ns.tprintf(`* Grow Threads for remaining: ${remainingGrowth} (${ns.tFormat(server.growthTime * remainingGrowth)})`);

  ns.tprintf(`${COLORS.MAGENTA}### Security${COLORS.RESET}`);
  ns.tprintf(`* Minimum Security Level: ${server.securityMin}`);
  ns.tprintf(`* Current Security Level: ${server.securityCurr}`);
  ns.tprintf(`* Weaken Time: ${ns.tFormat(server.weakenTime)}`);
  ns.tprintf(`* Weaken Amount per Thread: ${server.weakenPerThread}`);
  ns.tprintf(`${server.growSecurity > server.weakenPerThread ? COLORS.RED : COLORS.GREEN}* Security Increase with Grow: ${server.growSecurity}`);
  ns.tprintf(`${server.hackSecurity > server.weakenPerThread ? COLORS.RED : COLORS.GREEN}* Security Increase with Hack: ${server.hackSecurity}`);
}