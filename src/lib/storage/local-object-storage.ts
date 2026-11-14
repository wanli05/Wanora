import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Dev-only object root (gitignored). Keys mirror S3 layout under profiles/. */
export function localObjectRoot(): string {
  return path.join(process.cwd(), ".data", "objects");
}

function assertSafeKey(key: string): void {
  if (
    !key ||
    key.includes("\0") ||
    key.includes("..") ||
    path.isAbsolute(key) ||
    key.startsWith("/") ||
    key.startsWith("\\")
  ) {
    throw new Error(`unsafe object key: ${key}`);
  }
}

function pathsFor(key: string) {
  assertSafeKey(key);
  const filePath = path.join(localObjectRoot(), key);
  return { filePath, typePath: `${filePath}.content-type` };
}

export async function putLocalObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { filePath, typePath } = pathsFor(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
  await writeFile(typePath, contentType, "utf8");
}

export async function getLocalObject(
  key: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  const { filePath, typePath } = pathsFor(key);
  try {
    const body = await readFile(filePath);
    let contentType = "application/octet-stream";
    try {
      contentType = (await readFile(typePath, "utf8")).trim() || contentType;
    } catch {
      /* older files without sidecar */
    }
    return { body, contentType };
  } catch {
    return null;
  }
}

export async function deleteLocalObject(key: string): Promise<void> {
  const { filePath, typePath } = pathsFor(key);
  await unlink(filePath).catch(() => undefined);
  await unlink(typePath).catch(() => undefined);
}
