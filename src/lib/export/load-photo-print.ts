import type { Db } from "@/db";
import { getProfileByUserId } from "@/lib/data/profiles";
import { getUserObject } from "@/lib/storage/object-storage";

/** Load the 30×40mm@300dpi JPEG for 履歴書 embedding (profiles.photo_key). */
export async function loadPhotoPrintJpeg(
  db: Db,
  userId: string,
): Promise<Buffer | null> {
  const profile = await getProfileByUserId(db, userId);
  if (!profile?.photoKey) return null;
  const obj = await getUserObject(profile.photoKey);
  return obj?.body ?? null;
}
