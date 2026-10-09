import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
// Run against an explicitly configured demo server; never spend provider credits.
const base = process.env.TEST_BASE_URL || "http://localhost:3001";
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("artifacts", { recursive: true });
try {
  const status = await (await context.request.get(`${base}/api/status`)).json();
  assert.equal(
    status.mode,
    "demo",
    "Browser checks require an explicit demo server; live inference is never called.",
  );
  await page.goto(base);
  await page.getByText("Sample mode is on.", { exact: false }).waitFor();
  await page.screenshot({
    path: "artifacts/desktop-prepare.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Make my mission card" }).click();
  await page
    .getByRole("heading", { name: "Pocket this. Then look up." })
    .waitFor();
  assert.equal(await page.locator(".mission").count(), 3);
  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: "artifacts/print-card.png", fullPage: true });
  await page.emulateMedia({ media: "screen" });
  const cardDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save card as Markdown" }).click();
  assert.match((await cardDownload).suggestedFilename(), /missions.md/);
  await page.getByRole("button", { name: "I’m back" }).click();
  const observation =
    "A small yellow bird hopped between two branches. I couldn't tell what kind.";
  await page.getByLabel("What did you notice?").fill(observation);
  await page.getByRole("button", { name: "Save observation" }).click();
  await page
    .getByLabel("What did you notice?")
    .fill("I heard a soft rustle, but couldn't see what made it.");
  await page.getByRole("button", { name: "Save observation" }).click();
  await page.getByRole("button", { name: "Create my field journal" }).click();
  await page.getByRole("heading", { name: "A few things I noticed" }).waitFor();
  assert.equal(await page.locator("blockquote").count(), 2);
  assert.equal(
    await page.locator("blockquote").first().locator("p").textContent(),
    observation,
  );
  await page
    .locator("blockquote")
    .first()
    .getByRole("link", { name: "Note 1" })
    .click();
  assert.match(page.url(), /#note-/);
  const journalDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Markdown" }).click();
  const downloaded = await journalDownload;
  await downloaded.saveAs("artifacts/sample-journal.md");
  const md = await readFile("artifacts/sample-journal.md", "utf8");
  assert.match(md, /Mode: demo/);
  assert.ok(md.includes(observation));
  await page.screenshot({
    path: "artifacts/desktop-journal.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "My walks" }).click();
  await page.getByRole("button", { name: "Open →", exact: true }).click();
  await page.getByRole("heading", { name: "A few things I noticed" }).waitFor();
  await page.getByRole("button", { name: "Edit observations" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page
    .getByLabel("What did you notice?")
    .fill(`${observation} It moved quickly.`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Create my field journal" }).click();
  await page.getByRole("heading", { name: "A few things I noticed" }).waitFor();
  assert.match(
    await page.locator("blockquote").first().textContent(),
    /It moved quickly/,
  );
  await page.getByRole("button", { name: "My walks" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete walk", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your first page is waiting." })
    .waitFor();
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(base);
  await mobile.getByText("Sample mode is on.", { exact: false }).waitFor();
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await mobile.screenshot({
    path: "artifacts/mobile-prepare.png",
    fullPage: true,
  });
  await mobile.getByRole("button", { name: "Make my mission card" }).click();
  await mobile
    .getByRole("heading", { name: "Pocket this. Then look up." })
    .waitFor();
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await mobile.screenshot({
    path: "artifacts/mobile-card.png",
    fullPage: true,
  });
  await mobile.getByRole("button", { name: "I’m back" }).click();
  await mobile
    .getByLabel("What did you notice?")
    .fill("A rough leaf and a quiet path.");
  await mobile.getByRole("button", { name: "Save observation" }).click();
  await mobile.getByRole("button", { name: "Create my field journal" }).click();
  await mobile
    .getByRole("heading", { name: "A few things I noticed" })
    .waitFor();
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  // Controlled browser fixtures cover errors and audio correction. These are mocks,
  // not live Gemma or Whisper calls, and send no data to hosted providers.
  const fixture = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const audioPage = await fixture.newPage();
  await audioPage.route("**/api/status", (route) =>
    route.fulfill({
      json: {
        mode: "live",
        model: "mock-fixture",
        gemmaReady: true,
        audioReady: true,
      },
    }),
  );
  let missionAttempts = 0;
  await audioPage.route("**/api/missions", async (route) => {
    if (++missionAttempts === 1)
      await route.fulfill({
        status: 503,
        json: { error: "Mock provider unavailable. Your input is still here." },
      });
    else await route.continue();
  });
  await audioPage.route("**/api/transcribe", (route) =>
    route.fulfill({ json: { text: "There was mouse on the wall, I think." } }),
  );
  await audioPage.goto(base);
  await audioPage.getByRole("checkbox").check();
  await audioPage.getByRole("button", { name: "Make my mission card" }).click();
  await audioPage
    .getByText("Mock provider unavailable.", { exact: false })
    .waitFor();
  await audioPage.getByRole("button", { name: "Retry", exact: true }).click();
  await audioPage
    .getByRole("heading", { name: "Pocket this. Then look up." })
    .waitFor();
  await audioPage.getByRole("button", { name: "I’m back" }).click();
  await audioPage
    .getByLabel("Import audio recording")
    .setInputFiles({
      name: "synthetic.wav",
      mimeType: "audio/wav",
      buffer: Buffer.concat([
        Buffer.from("RIFF"),
        Buffer.alloc(4),
        Buffer.from("WAVEfmt "),
        Buffer.alloc(30),
      ]),
    });
  await audioPage.getByLabel("Correct your transcript before saving").waitFor();
  await audioPage
    .getByLabel("Correct your transcript before saving")
    .fill("There was moss on the wall, I think.");
  await audioPage.getByRole("button", { name: "Save observation" }).click();
  await audioPage
    .getByRole("button", { name: "Create my field journal" })
    .click();
  await audioPage
    .getByRole("heading", { name: "A few things I noticed" })
    .waitFor();
  assert.equal(
    await audioPage.locator("blockquote p").textContent(),
    "There was moss on the wall, I think.",
  );
  assert.equal(
    await audioPage.locator(".source .note-text").textContent(),
    "There was moss on the wall, I think.",
  );
  await fixture.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop/mobile demo flow, print card, downloads, citations, reload/history, edit/regenerate, delete, no horizontal overflow or page errors; mocked failure/retry and audio correction. No live inference.",
  );
} finally {
  await browser.close();
}
