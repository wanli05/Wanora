"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import {
  PHOTO_ASPECT_RATIO,
  PHOTO_PRINT_HEIGHT_PX,
  PHOTO_PRINT_WIDTH_PX,
} from "@/lib/domain/photo-print";

type Props = {
  disabled?: boolean;
  /** Existing saved photo URL (e.g. `/api/profile/photo`). */
  initialUrl?: string | null;
  hasPhoto?: boolean;
  /** When S3 is unset, server persists under `.data/objects`. */
  localBackend?: boolean;
};

const MAX_BYTES = 8 * 1024 * 1024;

/** Crop to 3:4 and upload original + print-sized JPEG via `/api/profile/photo`. */
export function PhotoUpload({
  disabled,
  initialUrl,
  hasPhoto,
  localBackend = false,
}: Props) {
  const t = useTranslations("Profile.photo");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [present, setPresent] = useState(Boolean(hasPhoto));
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    "idle",
  );
  const [errorKind, setErrorKind] = useState<"generic" | "tooLarge" | "type">(
    "generic",
  );

  const shown = preview ?? (present && initialUrl ? initialUrl : null);

  const onFile = useCallback(
    async (file: File) => {
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
        setErrorKind("type");
        setStatus("error");
        return;
      }
      if (file.size > MAX_BYTES) {
        setErrorKind("tooLarge");
        setStatus("error");
        return;
      }
      setStatus("uploading");
      setErrorKind("generic");
      try {
        const cropped = await cropToThreeFour(file);
        const objectUrl = URL.createObjectURL(cropped);
        setPreview(objectUrl);
        const form = new FormData();
        form.append("original", file, "original.jpg");
        form.append("print", cropped, "print.jpg");
        const res = await fetch("/api/profile/photo", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          if (res.status === 413) setErrorKind("tooLarge");
          throw new Error("upload failed");
        }
        setPresent(true);
        setStatus("done");
      } catch {
        setStatus("error");
      }
    },
    [],
  );

  const onDelete = useCallback(async () => {
    setStatus("uploading");
    try {
      const res = await fetch("/api/profile/photo", { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setPresent(false);
      setStatus("idle");
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setErrorKind("generic");
      setStatus("error");
    }
  }, [preview]);

  return (
    <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="text-sm font-medium">{t("title")}</p>
      <p className="text-xs text-zinc-500">{t("hint")}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="text-sm"
        disabled={disabled || status === "uploading"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded blob / API preview
        <img
          src={shown}
          alt={t("previewAlt")}
          className="h-40 w-[120px] rounded border border-zinc-200 object-cover dark:border-zinc-700"
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {present || preview ? (
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
            disabled={disabled || status === "uploading"}
            onClick={() => void onDelete()}
          >
            {t("remove")}
          </button>
        ) : null}
      </div>
      {status === "error" ? (
        <p className="text-sm text-red-600">
          {errorKind === "tooLarge"
            ? t("tooLarge")
            : errorKind === "type"
              ? t("invalidType")
              : t("uploadError")}
        </p>
      ) : null}
      {status === "done" ? (
        <p className="text-sm text-emerald-600">{t("uploadSuccess")}</p>
      ) : null}
      {disabled ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t("storageDisabled")}
        </p>
      ) : null}
      {!disabled && localBackend ? (
        <p className="text-xs text-zinc-500">{t("localBackendHint")}</p>
      ) : null}
    </div>
  );
}

async function cropToThreeFour(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const targetRatio = PHOTO_ASPECT_RATIO;
  const sourceRatio = bitmap.width / bitmap.height;
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (sourceRatio > targetRatio) {
    sw = bitmap.height * targetRatio;
    sx = (bitmap.width - sw) / 2;
  } else {
    sh = bitmap.width / targetRatio;
    sy = (bitmap.height - sh) / 2;
  }
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_PRINT_WIDTH_PX;
  canvas.height = PHOTO_PRINT_HEIGHT_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  ctx.drawImage(
    bitmap,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    PHOTO_PRINT_WIDTH_PX,
    PHOTO_PRINT_HEIGHT_PX,
  );
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      "image/jpeg",
      0.92,
    );
  });
}
