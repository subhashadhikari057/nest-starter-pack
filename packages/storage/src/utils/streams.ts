import { Readable } from "node:stream";

const MAX_BUFFER_BYTES = 500 * 1024 * 1024; // 500 MB hard cap

export const streamToBuffer = async (
	stream: NodeJS.ReadableStream,
): Promise<Buffer> =>
	new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let totalSize = 0;
		// Cast to Readable so we can call destroy() when the size cap is exceeded.
		const readable = stream as Readable;
		readable.on("data", (chunk: Buffer) => {
			totalSize += chunk.length;
			if (totalSize > MAX_BUFFER_BYTES) {
				readable.destroy(new Error("Response too large to buffer (> 500 MB)"));
				return;
			}
			chunks.push(Buffer.from(chunk));
		});
		readable.on("error", (error) => reject(error));
		readable.on("end", () => resolve(Buffer.concat(chunks)));
	});

export const fromWebReadable = (
	stream: ReadableStream,
): NodeJS.ReadableStream => {
	if (typeof Readable.fromWeb !== "function") {
		throw new Error("Readable.fromWeb is not supported in this runtime");
	}
	return Readable.fromWeb(stream);
};
