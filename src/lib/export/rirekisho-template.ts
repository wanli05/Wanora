import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Expected SHA-256 of the locked MHLW A4 blank template (acceptance baseline). */
export const RIREKISHO_TEMPLATE_SHA256 =
  "2d84e5eccdf8149d4b981f7109e09d11e7d280b049599d419702326ab844dfa2";

export const RIREKISHO_PAGE = {
  widthTwips: 11906,
  heightTwips: 16838,
  marginTwips: 720,
  tableWidthTwips: 10490,
} as const;

export const RIREKISHO_GRIDS = {
  identity: [1131, 1147, 5660, 2552],
  historyPage1: [1267, 860, 8363],
  historyPage2: [1418, 850, 8222],
} as const;

/** Exact row height for 学歴・職歴 / 免許・資格 data rows. */
export const RIREKISHO_RECORD_ROW_HEIGHT_TWIPS = 567;

/** Floating photo frame size from the blank template DrawingML. */
export const RIREKISHO_PHOTO_EMU = {
  cx: 1053000,
  cy: 1404000,
} as const;

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Load the blank 履歴書 template bytes from the server asset tree.
 * Callers must copy before mutating — never write back to this path.
 */
export function loadRirekishoTemplateBytes(): Buffer {
  const path = join(HERE, "templates", "rirekisyo_a4_mhlw.docx");
  const buf = readFileSync(path);
  const digest = createHash("sha256").update(buf).digest("hex");
  if (digest !== RIREKISHO_TEMPLATE_SHA256) {
    throw new Error(
      `rirekisho template SHA-256 mismatch: got ${digest}, expected ${RIREKISHO_TEMPLATE_SHA256}`,
    );
  }
  return buf;
}
