import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { Logger } from "@nestjs/common";

/**
 * Scans compiled output for logger.log() calls and warns at startup.
 * logger.log() is active in production (unlike verbose/debug) and will
 * appear in production logs — developers should use logger.verbose() or
 * logger.debug() for routine informational messages.
 */
export function warnProductionLogCalls(srcDir: string, logger: Logger): void {
	const hits: string[] = [];

	function scan(dir: string): void {
		for (const entry of readdirSync(dir)) {
			const fullPath = join(dir, entry);
			const stat = statSync(fullPath);
			if (stat.isDirectory() && entry !== "node_modules") {
				scan(fullPath);
			} else if (
				stat.isFile() &&
				extname(entry) === ".js" &&
				entry !== "main.js" &&
				entry !== "production-log-check.js"
			) {
				const lines = readFileSync(fullPath, "utf8").split("\n");
				for (let i = 0; i < lines.length; i++) {
					if (/\bthis\.logger\.log\(|\blogger\.log\(/.test(lines[i])) {
						hits.push(`  ${fullPath}:${i + 1}`);
					}
				}
			}
		}
	}

	scan(srcDir);

	if (hits.length > 0) {
		const border = "=".repeat(45);
		logger.error(
			`\n${border} W A R N I N G ${border}\n` +
				`  PRODUCTION LOG WARNING: ${hits.length} logger.log() call(s) detected.\n` +
				"  These WILL print in production. Use logger.verbose() or logger.debug()\n" +
				"  for routine info messages instead.\n\n" +
				`  Locations:\n${hits.join("\n")}\n` +
				`${border} W A R N I N G ${border}\n`,
		);
	}
}
