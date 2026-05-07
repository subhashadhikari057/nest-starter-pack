import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "src/**/*.ts",
	format: ["cjs", "esm"],
	sourcemap: true,
	dts: true,
});
