import mongoose, { type ConnectOptions } from "mongoose";

export { mongoose };

export * from "./schemas";

export async function createMongoConnection(
	uri: string,
	options?: ConnectOptions,
): Promise<typeof mongoose> {
	const connection = await mongoose.connect(uri, {
		autoIndex: true,
		...options,
	});

	console.log("[MongoDB] Connected successfully");

	mongoose.connection.on("error", (err) => {
		console.error("[MongoDB] Connection error:", err.message);
	});

	mongoose.connection.on("disconnected", () => {
		console.warn("[MongoDB] Disconnected");
	});

	return connection;
}

export async function closeMongoConnection(): Promise<void> {
	await mongoose.disconnect();
	console.log("[MongoDB] Disconnected gracefully");
}
