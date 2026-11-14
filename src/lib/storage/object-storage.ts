import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getServerEnv, isObjectStorageConfigured } from "@/lib/env";
import {
  deleteLocalObject,
  getLocalObject,
  putLocalObject,
} from "@/lib/storage/local-object-storage";

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

/** Persist a user object: S3 when configured, else local `.data/objects` (dev). */
export async function putUserObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (!isObjectStorageConfigured()) {
    await putLocalObject(key, body, contentType);
    return;
  }
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getServerEnv().S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getUserObject(
  key: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  if (!isObjectStorageConfigured()) {
    return getLocalObject(key);
  }
  try {
    const out = await getS3Client().send(
      new GetObjectCommand({
        Bucket: getServerEnv().S3_BUCKET!,
        Key: key,
      }),
    );
    if (!out.Body) return null;
    const bytes = await out.Body.transformToByteArray();
    return {
      body: Buffer.from(bytes),
      contentType: out.ContentType ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}

export async function deleteUserObject(key: string): Promise<void> {
  if (!isObjectStorageConfigured()) {
    await deleteLocalObject(key);
    return;
  }
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
