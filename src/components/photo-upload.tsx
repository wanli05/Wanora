"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
};

/** Crop to 3:4 and upload original + print-sized JPEG via `/api/profile/photo`. */
export function PhotoUpload({ disabled }: Props) {
  const t = useTranslations("Profile.photo");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    "idle",
  );

  const onFile = useCallback(
    async (file: File) => {
      setStatus("uploading");
      try {
        const originalBlob = file;
        const cropped = await cropToThreeFour(file);
        setPreview(URL.createObjectURL(cropped));
        const form = new FormData();
        form.append("original", originalBlob, "original.jpg");
        form.append("print", cropped, "print.jpg");
        const res = await fetch("/api/profile/photo", { method: "POST", body: form });
        if (!res.ok) throw new Error("upload failed");
        setStatus("done");
      } catch {
        setStatus("error");
      }
    },
    [],
  );

  return (
    <div className="space-y-2">
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
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded blob preview
        <img
          src={preview}
          alt={t("previewAlt")}
          className="h-40 w-[120px] rounded border border-zinc-200 object-cover dark:border-zinc-700"
        />
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-red-600">{t("uploadError")}</p>
      ) : null}
      {status === "done" ? (
        <p className="text-sm text-emerald-600">{t("uploadSuccess")}</p>
      ) : null}
      {disabled ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">{t("storageDisabled")}</p>
      ) : null}
    </div>
  );
}

async function cropToThreeFour(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const targetRatio = 3 / 4;
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
  const outW = 900;
  const outH = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      "image/jpeg",
      0.92,
    );
  });
}
