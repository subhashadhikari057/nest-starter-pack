import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/**/*.ts", "src/**/*.tsx"],
	format: ["cjs", "esm"],
	sourcemap: true,
	dts: true,
});
