#!/usr/bin/env node

// @ts-nocheck
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const OUTPUT_FILE = ".env.generated";
const cwd = process.cwd();

function generateKeys() {
	const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
		modulusLength: 2048,
		publicKeyEncoding: {
			type: "spki",
			format: "pem",
		},
		privateKeyEncoding: {
			type: "pkcs8",
			format: "pem",
		},
	});

	const privateKeyBase64 = Buffer.from(privateKey).toString("base64");
	const publicKeyBase64 = Buffer.from(publicKey).toString("base64");

	return { privateKeyBase64, publicKeyBase64 };
}

function printInstructions(keys) {
	console.log("Generated JWT RSA Key Pair");
	console.log("\nAdd the following to your environment configuration:\n");
	console.log(`JWT_PRIVATE_KEY_BASE64=${keys.privateKeyBase64}`);
	console.log(`JWT_PUBLIC_KEY_BASE64=${keys.publicKeyBase64}`);
	console.log("JWT_ACCESS_TOKEN_TTL_SECONDS=900");
	console.log("JWT_REFRESH_TOKEN_TTL_SECONDS=604800");
}

function formatEnv(keys) {
	return `########################################
# API server
########################################
PORT=5000
NODE_ENV=development
SWAGGER_ENABLED=true
SWAGGER_BOOT_MODE=eager

########################################
# Database (matches docker-compose.dev.yml)
########################################
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bullhouse

########################################
# MongoDB (matches docker-compose.dev.yml)
########################################
MONGODB_URL=mongodb://bullhouse:securepassword@localhost:27018/bullhouse?authSource=admin

########################################
# Auth
########################################
CORS_ORIGINS=http://localhost:3000
FRONTEND_BASE_URL=http://localhost:3000
API_PUBLIC_BASE_URL=http://localhost:5000

########################################
# JWT / sessions
########################################
JWT_PRIVATE_KEY_BASE64=${keys.privateKeyBase64}
JWT_PUBLIC_KEY_BASE64=${keys.publicKeyBase64}
JWT_ACCESS_TOKEN_TTL_SECONDS=900
JWT_REFRESH_TOKEN_TTL_SECONDS=604800

########################################
# Storage / uploads (matches docker-compose.dev.yml rustfs)
########################################
STORAGE_DRIVER=auto
STORAGE_BUCKET_ENDPOINT=http://localhost:9000
STORAGE_BUCKET_ACCESS_KEY=rustfsadmin
STORAGE_BUCKET_SECRET_KEY=rustfsadmin
STORAGE_BUCKET_NAME=bullhouse-dev
STORAGE_BUCKET_REGION=us-east-1
STORAGE_BUCKET_PUBLIC_URL=http://localhost:9000
UPLOAD_LOCATION=apps/api/uploads

########################################
# Redis (matches docker-compose.dev.yml)
########################################
REDIS_URL=redis://bullhouse:securepassword@localhost:6380
REDIS_CACHE_TTL_SECONDS=3600

########################################
# Email / notifications
########################################
EMAIL_SMTP_HOST=
EMAIL_SMTP_PORT=
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USER=
EMAIL_SMTP_PASSWORD=
EMAIL_DEFAULT_FROM="Starter Nest <no-reply@example.com>"

########################################
# SMS OTP
########################################
SMS_PROVIDER=mock
OTP_EXPIRY_MINUTES=15
OTP_MAX_ATTEMPTS=5

########################################
# Firebase Admin SDK (optional for local dev)
########################################
FIREBASE_PROJECT_ID=bullhouse-xyz
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@bullhouse-xyz.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD..."

########################################
# LiveKit (Live Streaming)
########################################
LIVEKIT_API_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret12345678901234567890123456789012
EGRESS_OUTPUT_BASE_PATH=/recordings
LIVEKIT_HLS_TOKEN_SECRET=replace-with-random-hls-token-secret

########################################
# eSewa ePay
########################################
ESEWA_EPAY_URL=https://rc-epay.esewa.com.np/api/epay/main/v2/form
ESEWA_EPAY_STATUS_URL=https://rc.esewa.com.np/mobile/transaction
ESEWA_PRODUCT_CODE=EPAYTEST
ESEWA_SECRET_KEY=8gBm/:&EnhH.1/q

########################################
# Realtime / WebSocket
########################################
WS_ORIGINS=http://localhost:3000
WS_NAMESPACE=/realtime
WS_RATE_LIMIT_MAX_CONNECTIONS=100
WS_RATE_LIMIT_PER_MINUTE=100
EVENT_HISTORY_ENABLED=true
EVENT_HISTORY_TTL=3600
ACK_TIMEOUT=10000
ACK_RETRIES=0
WS_AUTH_DISABLED=false
`;
}

function maybeWriteEnv(keys) {
	const envPath = path.join(cwd, OUTPUT_FILE);
	if (fs.existsSync(envPath)) {
		console.log(
			"\n.env.generated already exists. Copy the keys above into your .env file manually.",
		);
		return;
	}

	const template = formatEnv(keys);
	fs.writeFileSync(envPath, template, { encoding: "utf8" });
	console.log(`\nWrote sample configuration to ${envPath}`);
}

const keys = generateKeys();
printInstructions(keys);
maybeWriteEnv(keys);
