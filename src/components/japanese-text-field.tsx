import type { LocalizedText } from "@/lib/domain/localized-text";

type Props = {
  fieldPrefix: string;
  label: string;
  value?: LocalizedText | null;
  multiline?: boolean;
  required?: boolean;
  hint?: string;
};

/** Resume/profile copy: user enters Japanese only; stored under `ja` in LocalizedText jsonb. */
export function JapaneseTextField({
  fieldPrefix,
  label,
  value,
  multiline = false,
  required = false,
  hint,
}: Props) {
  const id = `${fieldPrefix}_ja`;
  const defaultValue = value?.ja ?? "";
  const className =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {multiline ? (
        <textarea
          id={id}
          name={id}
          rows={3}
          required={required}
          defaultValue={defaultValue}
          className={className}
        />
      ) : (
        <input
          id={id}
          name={id}
          type="text"
          required={required}
          defaultValue={defaultValue}
          className={className}
        />
      )}
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}
