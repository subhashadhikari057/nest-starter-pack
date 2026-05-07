import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, "..");
const repoRoot = resolve(appDir, "..", "..");

const apiPackageJson = JSON.parse(
	readFileSync(join(appDir, "package.json"), "utf8"),
);

const workspaceDeps = Object.entries(apiPackageJson.dependencies ?? {})
	.filter(
		([name, version]) =>
			name.startsWith("@bullhouse/") && version === "workspace:*",
	)
	.map(([name]) => name);

const packagesDir = join(repoRoot, "packages");
const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => join(packagesDir, entry.name));

const packageIndex = new Map();
for (const dir of packageDirs) {
	const packageJsonPath = join(dir, "package.json");
	if (!existsSync(packageJsonPath)) continue;

	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	if (packageJson?.name) {
		packageIndex.set(packageJson.name, { dir, packageJson });
	}
}

const missingBuilds = [];
for (const depName of workspaceDeps) {
	const dep = packageIndex.get(depName);
	if (!dep) continue;

	const mainFile = dep.packageJson.main ?? "dist/index.js";
	if (!existsSync(join(dep.dir, mainFile))) {
		missingBuilds.push(depName);
	}
}

if (missingBuilds.length === 0) {
	process.exit(0);
}

console.log(
	`[ensure-workspace-deps] Missing build output for: ${missingBuilds.join(", ")}`,
);
console.log("[ensure-workspace-deps] Building missing workspace packages...");

const args = [...missingBuilds.flatMap((name) => ["--filter", name]), "build"];
const result = spawnSync("pnpm", args, {
	cwd: repoRoot,
	stdio: "inherit",
});

if (result.status !== 0) {
	process.exit(result.status ?? 1);
}
