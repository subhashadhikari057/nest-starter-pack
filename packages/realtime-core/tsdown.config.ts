import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/room-keys/index.ts"],
	format: ["cjs", "esm"],
	clean: true,
	dts: true,
	// watch: ["src"],
	ignoreWatch: ["dist", "node_modules", ".turbo"],
});
