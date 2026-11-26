import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import ja from "../../messages/ja.json";
import { SlotGrid } from "../../src/components/progress-board/slot-grid";
import type { DraftSlot } from "../../src/lib/progress/slots";
import { addDays } from "../../src/lib/progress/tokyo";
import "./harness.css";

/** Fixed week so Mon/Tue/Sun labels stay stable across calendar days. */
const HARNESS_MONDAY = "2026-11-23";

function HarnessApp() {
  const [drafts, setDrafts] = useState<DraftSlot[]>([]);
  const mon = HARNESS_MONDAY;
  const tue = addDays(mon, 1);

  return (
    <NextIntlClientProvider locale="ja" messages={ja} timeZone="Asia/Tokyo">
      <div className="harness-shell">
        <div
          className="pb-schedule-drawer pb-schedule-drawer--edit harness-drawer"
          data-testid="edit-slots-drawer"
        >
          <header className="pb-schedule-drawer-head">
            <h1>候補日時（harness）</h1>
          </header>
          <div className="pb-schedule-drawer-body">
            <div className="harness-controls">
              <button
                type="button"
                data-testid="harness-add-mon-block"
                onClick={() =>
                  setDrafts([
                    {
                      start: `${mon}T10:00:00+09:00`,
                      end: `${mon}T11:30:00+09:00`,
                    },
                  ])
                }
              >
                Add Mon 10:00–11:30
              </button>
              <button
                type="button"
                data-testid="harness-reset-drafts"
                onClick={() => setDrafts([])}
              >
                Reset
              </button>
              <pre data-testid="harness-drafts-json">{JSON.stringify(drafts)}</pre>
            </div>
            <SlotGrid
              occupancy={[]}
              appId="harness-app"
              company="Harness Co"
              drafts={drafts}
              baseline={[]}
              initialMonday={HARNESS_MONDAY}
              onChange={setDrafts}
              onConflict={() => undefined}
            />
          </div>
        </div>
        <p className="harness-meta" data-testid="harness-week-meta">
          {`mon=${mon} tue=${tue}`}
        </p>
      </div>
    </NextIntlClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HarnessApp />
  </StrictMode>,
);
