import { randomUUID } from "node:crypto";

export function v4(): string {
	return randomUUID();
}

export function v7(): string {
	return randomUUID();
}
