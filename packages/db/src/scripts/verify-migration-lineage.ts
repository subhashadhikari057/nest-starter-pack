import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JournalEntry = {
	idx: number;
	tag: string;
};

type Journal = {
	entries?: JournalEntry[];
};

const fail = (message: string): never => {
	throw new Error(message);
};

const toMigrationNumber = (value: number): string =>
	value.toString().padStart(4, "0");

const filenameToNumber = (filename: string): number => {
	const match = /^(\d{4})_.+\.sql$/.exec(filename);
	if (!match) {
		fail(`Invalid migration filename format: ${filename}`);
	}
	return Number(match[1]);
};

const readJournal = (metaDir: string): JournalEntry[] => {
	const journalPath = path.join(metaDir, "_journal.json");
	const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
	if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
		fail(`Invalid or empty journal entries at ${journalPath}`);
	}

	for (let idx = 0; idx < journal.entries.length; idx += 1) {
		const entry = journal.entries[idx];
		if (entry.idx !== idx) {
			fail(
				`Journal idx mismatch for tag ${entry.tag}: expected ${idx}, got ${entry.idx}`,
			);
		}
		const expectedPrefix = `${toMigrationNumber(idx)}_`;
		if (!entry.tag.startsWith(expectedPrefix)) {
			fail(
				`Journal tag sequence mismatch at idx ${idx}: expected tag prefix ${expectedPrefix}, got ${entry.tag}`,
			);
		}
	}

	return journal.entries;
};

const assertMigrationFiles = (
	migrationsDir: string,
	entries: JournalEntry[],
): string[] => {
	const files = readdirSync(migrationsDir)
		.filter((filename) => /^(\d{4})_.+\.sql$/.test(filename))
		.sort((left, right) => filenameToNumber(left) - filenameToNumber(right));

	if (files.length !== entries.length) {
		fail(
			`Expected ${entries.length} migration SQL files based on journal, found ${files.length}`,
		);
	}

	for (let idx = 0; idx < entries.length; idx += 1) {
		const expectedFile = `${entries[idx].tag}.sql`;
		if (files[idx] !== expectedFile) {
			fail(
				`Migration file mismatch at idx ${idx}: expected ${expectedFile}, found ${files[idx] ?? "<missing>"}`,
			);
		}
	}

	return files;
};

const assertSnapshots = (metaDir: string, entries: JournalEntry[]): void => {
	const snapshotFiles = readdirSync(metaDir)
		.filter((filename) => /^\d{4}_snapshot\.json$/.test(filename))
		.sort();

	if (snapshotFiles.length !== entries.length) {
		fail(
			`Expected ${entries.length} snapshot files based on journal, found ${snapshotFiles.length}`,
		);
	}

	for (let idx = 0; idx < entries.length; idx += 1) {
		const expectedSnapshot = `${toMigrationNumber(idx)}_snapshot.json`;
		if (snapshotFiles[idx] !== expectedSnapshot) {
			fail(
				`Snapshot sequence mismatch at ${expectedSnapshot}: found ${snapshotFiles[idx] ?? "<missing>"}`,
			);
		}
	}
};

const main = (): void => {
	const scriptDir = path.dirname(fileURLToPath(import.meta.url));
	const dbRoot = path.resolve(scriptDir, "..");
	const migrationsDir = path.join(dbRoot, "migrations");
	const metaDir = path.join(migrationsDir, "meta");

	const journalEntries = readJournal(metaDir);
	const migrationFiles = assertMigrationFiles(migrationsDir, journalEntries);
	const migrationSet = new Set(migrationFiles);

	for (const entry of journalEntries) {
		const sqlFilename = `${entry.tag}.sql`;
		if (!migrationSet.has(sqlFilename)) {
			fail(`Journal tag ${entry.tag} has no matching SQL file: ${sqlFilename}`);
		}
	}

	assertSnapshots(metaDir, journalEntries);

	const head = journalEntries[journalEntries.length - 1];
	console.log(
		`Migration lineage verification passed (head ${head.tag}, ${journalEntries.length} total migrations).`,
	);
};

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
