import { expect, test, type Page } from "@playwright/test";

const MON = "2026-11-23";
const TUE = "2026-11-24";
const SUN = "2026-11-29";
const TIME = "10:00";

type Box = { x: number; y: number; width: number; height: number };

async function cellBox(page: Page, day: string, time: string): Promise<Box> {
  const cell = page.getByTestId(`slot-cell-${day}-${time}`);
  await cell.scrollIntoViewIfNeeded();
  await expect(cell).toBeVisible();
  const box = await cell.boundingBox();
  if (!box) throw new Error(`No bounding box for ${day} ${time}`);
  return box;
}

function roughlySame(a: Box, b: Box, tol = 1) {
  expect(Math.abs(a.x - b.x), "x").toBeLessThanOrEqual(tol);
  expect(Math.abs(a.y - b.y), "y").toBeLessThanOrEqual(tol);
  expect(Math.abs(a.width - b.width), "width").toBeLessThanOrEqual(tol);
  expect(Math.abs(a.height - b.height), "height").toBeLessThanOrEqual(tol);
}

async function draftsJson(page: Page) {
  const text = await page.getByTestId("harness-drafts-json").innerText();
  return JSON.parse(text) as { start: string; end: string }[];
}

test.describe("SlotGrid 480px drawer layout", () => {
  test("候补块不偏移底层半小时按钮；按屏位点击周二；× 只删周一", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("slot-week-grid")).toBeVisible();
    await expect(page.getByTestId("slot-week-grid")).toHaveAttribute(
      "data-week-monday",
      MON,
    );

    // Bring the 10:00 row into the drawer scrollport once; keep scroll fixed after.
    await page.getByTestId(`slot-cell-${MON}-${TIME}`).scrollIntoViewIfNeeded();

    const before = {
      mon: await cellBox(page, MON, TIME),
      tue: await cellBox(page, TUE, TIME),
      sun: await cellBox(page, SUN, TIME),
    };

    await page.getByTestId("harness-add-mon-block").click();
    await expect(
      page.getByTestId(`slot-block-${MON}T10:00:00+09:00`),
    ).toBeVisible();

    // Re-measure without re-scrolling so viewport coords stay comparable.
    const after = {
      mon: await page.getByTestId(`slot-cell-${MON}-${TIME}`).boundingBox(),
      tue: await page.getByTestId(`slot-cell-${TUE}-${TIME}`).boundingBox(),
      sun: await page.getByTestId(`slot-cell-${SUN}-${TIME}`).boundingBox(),
    };
    if (!after.mon || !after.tue || !after.sun) {
      throw new Error("Missing cell boxes after adding Monday block");
    }

    roughlySame(before.mon, after.mon);
    roughlySame(before.tue, after.tue);
    roughlySame(before.sun, after.sun);

    // Click the screen position of Tuesday 10:00 (pre-block coordinates).
    await page.mouse.click(
      before.tue.x + before.tue.width / 2,
      before.tue.y + before.tue.height / 2,
    );
    await page.mouse.up();

    await expect
      .poll(async () => draftsJson(page))
      .toEqual(
        expect.arrayContaining([
          {
            start: `${MON}T10:00:00+09:00`,
            end: `${MON}T11:30:00+09:00`,
          },
          {
            start: `${TUE}T10:00:00+09:00`,
            end: `${TUE}T10:30:00+09:00`,
          },
        ]),
      );

    const draftsAfterTue = await draftsJson(page);
    expect(draftsAfterTue).toHaveLength(2);

    await page.getByTestId(`slot-block-remove-${MON}T10:00:00+09:00`).click();

    await expect
      .poll(async () => draftsJson(page))
      .toEqual([
        {
          start: `${TUE}T10:00:00+09:00`,
          end: `${TUE}T10:30:00+09:00`,
        },
      ]);
    await expect(
      page.getByTestId(`slot-block-${MON}T10:00:00+09:00`),
    ).toHaveCount(0);
    await expect(
      page.getByTestId(`slot-block-${TUE}T10:00:00+09:00`),
    ).toBeVisible();
  });
});
