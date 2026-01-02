import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: ["esm"],
  dts: true,
  clean: false, // Don't clean - build:samples already created WAV files in dist
  sourcemap: true,
});
