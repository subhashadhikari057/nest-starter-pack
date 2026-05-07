import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/main.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	// Bundle all dependencies (default behavior for server apps)
	noExternal: [/.*/],
	dts: false, // NestJS decorators work better without .d.ts generation
});
