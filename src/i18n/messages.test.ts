import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/locale";
import { loadMessages } from "./messages";

function flatten(obj: object, prefix = ""): Record<string, unknown> {
  return Object.entries(obj).reduce<Record<string, unknown>>(
    (acc, [key, value]) =>
      value !== null && typeof value === "object"
        ? { ...acc, ...flatten(value, `${prefix}${key}.`) }
        : { ...acc, [`${prefix}${key}`]: value },
    {},
  );
}

const all = await Promise.all(
  LOCALES.map(async (l) => [l, flatten(await loadMessages(l))] as const),
);
const reference = Object.keys(all[0][1]).sort();

describe("UI messages", () => {
  it.each(all)("%s has exactly the same keys as ja", (_, messages) => {
    expect(Object.keys(messages).sort()).toEqual(reference);
  });

  it.each(all)("%s has no empty or non-string values", (_, messages) => {
    for (const [key, value] of Object.entries(messages)) {
      expect(typeof value, key).toBe("string");
      expect((value as string).trim(), key).not.toBe("");
    }
  });
});
