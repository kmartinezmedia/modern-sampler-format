/// <reference types="bun-types" />

declare global {
  interface ImportMeta {
    main?: boolean;
  }

  namespace NodeJS {
    interface Process {
      argv: string[];
      exit(code?: number): never;
    }
  }

  const process: NodeJS.Process;
  const Bun: typeof import("bun");
}

export {};

