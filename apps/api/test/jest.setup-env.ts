import path from "node:path";

import { config as loadEnv } from "dotenv";

const candidateEnvPaths = [
	path.resolve(process.cwd(), ".env"),
	path.resolve(process.cwd(), "apps/api/.env"),
];

for (const envPath of candidateEnvPaths) {
	loadEnv({ path: envPath, override: false, quiet: true });
}
