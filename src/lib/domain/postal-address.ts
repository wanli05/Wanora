/** Digits-only 7-digit JP postal code, or null if incomplete/invalid. */
export function normalizePostalDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 7) return null;
  return digits;
}

/** Display form `NNN-NNNN` from 7 digits. */
export function formatPostalCode(digits: string): string {
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export type PostalAddressHit = {
  addressJa: string;
  addressKana: string;
  postalCode: string;
};

type ZipcloudResult = {
  address1?: string;
  address2?: string;
  address3?: string;
  kana1?: string;
  kana2?: string;
  kana3?: string;
  zipcode?: string;
};

/** Map zipcloud (or compatible) first hit → editable 都道府県+市区町村+町域. */
export function postalHitFromZipcloud(
  result: ZipcloudResult,
): PostalAddressHit | null {
  const parts = [result.address1, result.address2, result.address3]
    .map((p) => p?.trim() ?? "")
    .filter(Boolean);
  if (parts.length === 0) return null;
  const kanaParts = [result.kana1, result.kana2, result.kana3]
    .map((p) => p?.trim() ?? "")
    .filter(Boolean);
  const digits = result.zipcode?.replace(/\D/g, "") ?? "";
  return {
    addressJa: parts.join(""),
    addressKana: kanaParts.length
      ? hankakuKatakanaToHiragana(kanaParts.join(""))
      : "",
    postalCode: digits.length === 7 ? formatPostalCode(digits) : "",
  };
}

/** Half-width katakana → hiragana via NFKC + kana shift (住所ふりがな). */
export function hankakuKatakanaToHiragana(input: string): string {
  const full = input.normalize("NFKC");
  return full.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

export type ZipcloudResponse = {
  status: number;
  message: string | null;
  results: ZipcloudResult[] | null;
};

export function parseZipcloudResponse(
  data: ZipcloudResponse,
):
  | { ok: true; hit: PostalAddressHit }
  | { ok: false; reason: "not_found" | "invalid" | "upstream" } {
  if (data.status === 400) return { ok: false, reason: "invalid" };
  if (data.status !== 200) return { ok: false, reason: "upstream" };
  const first = data.results?.[0];
  if (!first) return { ok: false, reason: "not_found" };
  const hit = postalHitFromZipcloud(first);
  if (!hit) return { ok: false, reason: "not_found" };
  return { ok: true, hit };
}
