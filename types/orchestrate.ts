export enum TARGET_STATUS {
  HACK = 'HACK',
  PREP = 'PREP',
}

export interface Target {
  host: string;
  status: TARGET_STATUS;
  active: boolean;
  activePids: number[];
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

export interface Batch {
  hack: BatchDetails;
  weakenHack: BatchDetails;
  grow: BatchDetails;
  weakenGrow: BatchDetails;
}

interface BatchDetails {
  threads: number;
  delay: number;
}
