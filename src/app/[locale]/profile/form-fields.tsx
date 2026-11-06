export function YearMonthField({
  name,
  value,
  label,
  required = true,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        type="month"
        required={required}
        value={value}
        onChange={
          onChange
            ? (e) => {
                onChange(e.target.value);
              }
            : undefined
        }
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
      />
    </label>
  );
}

export function YearMonthFields({
  year,
  month,
  yearLabel,
  monthLabel,
}: {
  year?: number;
  month?: number;
  yearLabel: string;
  monthLabel: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="text-sm">
        <span className="font-medium">{yearLabel}</span>
        <input
          name="year"
          type="number"
          required
          min={1900}
          max={2100}
          defaultValue={year}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="text-sm">
        <span className="font-medium">{monthLabel}</span>
        <input
          name="month"
          type="number"
          required
          min={1}
          max={12}
          defaultValue={month}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
    </div>
  );
}

export function EventSelect<T extends string>({
  name,
  codes,
  value,
  defaultCode,
  label,
  translate,
}: {
  name: string;
  codes: readonly T[];
  value?: T;
  defaultCode?: T;
  label: string;
  translate: (code: T) => string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        name={name}
        defaultValue={value ?? defaultCode}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
      >
        {codes.map((code) => (
          <option key={code} value={code}>
            {translate(code)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function formatYearMonthDate(d: Date) {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function formatDateInputValue(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
