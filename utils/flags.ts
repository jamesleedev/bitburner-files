export type CmdFlags = Record<string, ScriptArg | string[]>;

export type Flags = [string, string | number | boolean | string[]][];

export const RAM_VALUES = [
  2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576,
];

export function getHostFlag(
  ns: NS,
  cmdFlags: CmdFlags,
  includePositional: boolean = false,
  printError: boolean = false
): string | null {
  const filter = includePositional ? ['_', 'h', 'host'] : ['h', 'host'];

  let hostFlags = Object.entries(cmdFlags).filter((flag) => filter.includes(flag[0]));

  let hostArgs: string[] = hostFlags
    .map((flag) => {
      const arg = flag[1];

      return Array.isArray(arg) ? (arg[0] as string) : (arg as string);
    })
    .filter((arg) => {
      return arg && arg !== '';
    });

  if (hostArgs.length === 0) {
    if (printError) {
      printMissingHostError(ns);
    }

    return null;
  }

  const host = hostArgs[0] as string;

  return host;
}

export function printMissingHostError(ns: NS): void {
  ns.tprint(`ERROR: missing host`);
}

export function isPowerOfTwo(n: number): boolean {
  return n >= 2 && Number.isInteger(Math.log2(n));
}
