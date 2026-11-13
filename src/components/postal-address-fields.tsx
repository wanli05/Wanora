"use client";

import { useCallback, useRef, useState } from "react";
import { normalizePostalDigits } from "@/lib/domain/postal-address";

export type PostalAddressFieldLabels = {
  postalCode: string;
  address: string;
  addressKana: string;
  japaneseHint: string;
  lookupHint: string;
  lookingUp: string;
  notFound: string;
  lookupFailed: string;
  lineRemainderHint: string;
};

type Props = {
  labels: PostalAddressFieldLabels;
  initialPostalCode: string;
  initialAddressJa: string;
  initialAddressKana: string;
  inputClass: string;
};

/**
 * 履歴書フィールド：7 位邮编失焦/满位后查 zipcloud，自动填都道府県+市区町村+町域；
 * 番地等由用户手补；失败不清空已填内容。
 */
export function PostalAddressFields({
  labels,
  initialPostalCode,
  initialAddressJa,
  initialAddressKana,
  inputClass,
}: Props) {
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [addressJa, setAddressJa] = useState(initialAddressJa);
  const [addressKana, setAddressKana] = useState(initialAddressKana);
  const [status, setStatus] = useState<
    "idle" | "loading" | "not_found" | "failed"
  >("idle");
  const lastLookup = useRef<string | null>(null);

  const lookup = useCallback(async (raw: string) => {
    const digits = normalizePostalDigits(raw);
    if (!digits) return;
    if (lastLookup.current === digits) return;
    setStatus("loading");
    try {
      const res = await fetch(
        `/api/profile/postal?zip=${encodeURIComponent(digits)}`,
      );
      if (res.status === 404) {
        setStatus("not_found");
        return;
      }
      if (!res.ok) {
        setStatus("failed");
        return;
      }
      const data = (await res.json()) as {
        addressJa?: string;
        addressKana?: string;
        postalCode?: string;
      };
      lastLookup.current = digits;
      if (data.postalCode) setPostalCode(data.postalCode);
      if (data.addressJa) setAddressJa(data.addressJa);
      if (data.addressKana) setAddressKana(data.addressKana);
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm">
        <label className="block space-y-1">
          <span className="font-medium">{labels.postalCode}</span>
          <input
            name="postalCode"
            inputMode="numeric"
            autoComplete="postal-code"
            value={postalCode}
            onChange={(e) => {
              const next = e.target.value;
              setPostalCode(next);
              setStatus("idle");
              if (normalizePostalDigits(next)) {
                void lookup(next);
              }
            }}
            onBlur={() => void lookup(postalCode)}
            className={inputClass}
          />
        </label>
        <p className="text-xs text-zinc-500">{labels.lookupHint}</p>
        {status === "loading" ? (
          <p className="text-xs text-zinc-500">{labels.lookingUp}</p>
        ) : null}
        {status === "not_found" ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {labels.notFound}
          </p>
        ) : null}
        {status === "failed" ? (
          <p className="text-xs text-red-600">{labels.lookupFailed}</p>
        ) : null}
      </div>
      <div className="space-y-1 text-sm">
        <label className="block space-y-1">
          <span className="font-medium">{labels.address}</span>
          <textarea
            id="address_ja"
            name="address_ja"
            rows={3}
            value={addressJa}
            onChange={(e) => setAddressJa(e.target.value)}
            className={inputClass}
          />
        </label>
        <p className="text-xs text-zinc-500">
          {labels.lineRemainderHint}
          {labels.japaneseHint ? ` ${labels.japaneseHint}` : ""}
        </p>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{labels.addressKana}</span>
        <input
          name="addressKana"
          value={addressKana}
          onChange={(e) => setAddressKana(e.target.value)}
          className={inputClass}
        />
      </label>
    </div>
  );
}
