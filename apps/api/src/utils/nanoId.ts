export function generateRandomAlphanumeric(length = 6): string {
	// nestjs-doctor-ignore security/no-hardcoded-secrets — character alphabet, not a secret
	const characters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
	let result = "";

	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}

	return result;
}
