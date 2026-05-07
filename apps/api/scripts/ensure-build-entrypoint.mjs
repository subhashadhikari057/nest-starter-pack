#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const expectedEntrypoint = path.join(cwd, "dist/src/main.js");
const swcEntrypoint = path.join(cwd, "dist/main.js");

if (existsSync(expectedEntrypoint)) {
	process.exit(0);
}

if (!existsSync(swcEntrypoint)) {
	console.error(
		"Unable to locate build entrypoint. Missing both dist/src/main.js and dist/main.js.",
	);
	process.exit(1);
}

mkdirSync(path.dirname(expectedEntrypoint), { recursive: true });
writeFileSync(
	expectedEntrypoint,
	`"use strict";\nrequire("../main.js");\n`,
	"utf8",
);

console.log("Created compatibility entrypoint at dist/src/main.js");
