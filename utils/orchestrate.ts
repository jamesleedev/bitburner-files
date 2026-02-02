import type { ServerPooled, ServerWithFreeThreads, Target } from 'types/orchestrate';

export function getServerWithFreeThreads(ns: NS, script: string, serverPool: ServerPooled[]): ServerWithFreeThreads[] {
  const scriptRam = ns.getScriptRam(script);

  const servers: ServerWithFreeThreads[] = serverPool.map((server) => {
    const free = server.ram - ns.getServerUsedRam(server.host);

    return {
      host: server.host,
      threadsAvailable: Math.floor(free / scriptRam),
    };
  });

  return servers;
}

export function isInactive(ns: NS, target: Target): boolean {
  const activeProcesses = target.activePids.map((pid) => ns.getRunningScript(pid)).filter((script) => script !== null);

  return activeProcesses.length === 0;
}

export function syncFiles(ns: NS, script: string, host: string) {
  if (!ns.fileExists(script, host)) {
    ns.scp(script, host);
  }
}
