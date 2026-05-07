import {
	HeadBucketCommand,
	PutBucketPolicyCommand,
	type S3Client,
} from "@aws-sdk/client-s3";

/**
 * Applies the bucket policy that makes `public/*` readable by anyone
 * while keeping `uploads/**` fully private (signed URLs only).
 *
 * Safe to call on every startup — MinIO/S3 treats it as idempotent.
 */
export const applyBucketPolicy = async (
	client: S3Client,
	bucketName: string,
): Promise<void> => {
	try {
		await client.send(new HeadBucketCommand({ Bucket: bucketName }));
	} catch {
		throw new Error(
			`[storage] Bucket "${bucketName}" does not exist or is not accessible. ` +
				"Ensure the bucket is created and credentials are correct before applying a policy.",
		);
	}

	const policy = {
		Version: "2012-10-17",
		Statement: [
			{
				Sid: "PublicReadAccess",
				Effect: "Allow",
				Principal: "*",
				Action: ["s3:GetObject"],
				Resource: [`arn:aws:s3:::${bucketName}/public/*`],
			},
		],
	};

	await client.send(
		new PutBucketPolicyCommand({
			Bucket: bucketName,
			Policy: JSON.stringify(policy),
		}),
	);
};
