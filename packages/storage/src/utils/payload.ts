import { fromWebReadable, streamToBuffer } from "./streams.js";

export const payloadToBuffer = async (payload: unknown): Promise<Buffer> => {
	if (!payload) {
		throw new Error("Cannot convert empty payload to buffer");
	}

	if (Buffer.isBuffer(payload)) {
		return payload;
	}

	if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
		return Buffer.from(payload);
	}

	if (
		typeof (payload as { arrayBuffer?: () => Promise<ArrayBuffer> })
			?.arrayBuffer === "function"
	) {
		const arrayBuffer = await (
			payload as { arrayBuffer: () => Promise<ArrayBuffer> }
		).arrayBuffer();
		return Buffer.from(arrayBuffer);
	}

	if (
		typeof (payload as NodeJS.ReadableStream)?.pipe === "function" &&
		typeof (payload as NodeJS.ReadableStream).on === "function"
	) {
		return streamToBuffer(payload as NodeJS.ReadableStream);
	}

	if (
		typeof ReadableStream !== "undefined" &&
		payload instanceof ReadableStream
	) {
		return streamToBuffer(fromWebReadable(payload));
	}

	throw new Error("Unsupported payload type while building buffer");
};
