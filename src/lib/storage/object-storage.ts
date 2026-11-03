import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getServerEnv, isObjectStorageConfigured } from "@/lib/env";

let client: S3Client | undefined;

function getS3Client(): S3Client {
  if (!isObjectStorageConfigured()) {
    throw new Error("Object storage is not configured");
  }
  client ??= new S3Client({
    region: getServerEnv().S3_REGION ?? "auto",
    endpoint: getServerEnv().S3_ENDPOINT,
    credentials: {
      accessKeyId: getServerEnv().S3_ACCESS_KEY!,
      secretAccessKey: getServerEnv().S3_SECRET_KEY!,
    },
    forcePathStyle: true,
  });
  return client;
}

export async function putUserObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getServerEnv().S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteUserObject(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getServerEnv().S3_BUCKET!,
      Key: key,
    }),
  );
}

export function profilePhotoKey(userId: string, variant: "original" | "print") {
  const suffix = variant === "print" ? "photo-print.jpg" : "photo-original.jpg";
  return `profiles/${userId}/${suffix}`;
}
