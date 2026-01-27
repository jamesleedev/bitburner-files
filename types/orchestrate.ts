export enum TARGET_STATUS {
  WEAKEN = 'WEAKEN',
  GROW = 'GROW',
  HACK = 'HACK',
}

export interface Target {
  host: string;
  status: TARGET_STATUS;
  active: boolean;
  activePids: number[];
  last?: {
    type: TARGET_STATUS;
    threads: number;
  };
  ramMax: number;
  ramUsed: number;
  moneyMax: number;
  moneyAvail: number;
  securityMin: number;
  securityCurr: number;
}

export interface ServerPooled {
  host: string;
  ram: number;
}

export interface ServerWithFreeThreads {
  host: string;
  threadsAvailable: number;
}

export interface RunOperationOpts {
  log?: boolean;
  spreadEvenly?: boolean;
  delay?: number;
}
