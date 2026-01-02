import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: false,
  banner: {
    js: "#!/usr/bin/env bun",
  },
});


