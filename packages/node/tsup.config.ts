import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  // @dispatchitapp/core is a runtime dependency, not bundled in.
  external: ["@dispatchitapp/core"],
});
