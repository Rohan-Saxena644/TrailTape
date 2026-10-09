import { chromium } from "playwright";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

// Missions/journals are controlled fixtures. With TEST_LIVE_AUDIO=1, only the
// synthetic spoken WAV and a browser recording of it go to the real provider.
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const liveAudio = process.env.TEST_LIVE_AUDIO === "1";
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    `--use-file-for-fake-audio-capture=${resolve("artifacts/synthetic-voice.wav")}`,
  ],
  headless: true,
});
const context = await browser.newContext({
  permissions: ["microphone"],
  viewport: { width: 1440, height: 1080 },
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const missions = Array.from({ length: 3 }, (_, i) => ({
  title: `Synthetic mission ${i + 1}`,
  instruction: "If accessible, observe a nearby surface without touching it.",
}));
async function fixtures(target) {
  await target.route("**/api/missions", (route) =>
    route.fulfill({
      json: { missions, mode: "live", model: "synthetic-browser-fixture" },
    }),
  );
  await target.route("**/api/journal", (route) => {
    const { notes } = route.request().postDataJSON();
    return route.fulfill({
      json: {
        mode: "live",
        model: "synthetic-browser-fixture",
        journal: {
          title: "Synthetic verification journal",
          observations: notes.map((n) => ({
            quote: n.text,
            sourceNoteIds: [n.id],
          })),
          interpretations: [],
          nextMission: {
            sourceNoteIds: [notes[0].id],
            instruction:
              "If accessible, revisit the same spot and observe one detail.",
          },
        },
      },
    });
  });
  if (!liveAudio)
    await target.route("**/api/transcribe", (route) =>
      route.fulfill({
        json: {
          text: "Synthetic test observation. I saw a small yellow bird, maybe. I could not identify it.",
        },
      }),
    );
}
await context.addInitScript(() => {
  const original = navigator.mediaDevices.getUserMedia.bind(
    navigator.mediaDevices,
  );
  window.__testTracks = [];
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    const stream = await original(constraints);
    window.__testTracks.push(...stream.getTracks());
    return stream;
  };
});
try {
  const status = await (await context.request.get(`${base}/api/status`)).json();
  assert.equal(
    status.audioReady,
    true,
    "Add the transcription key locally and restart the backend.",
  );
  assert.equal(status.audioProvider, "Groq");
  assert.equal(status.inferenceProvider, "Google");
  await fixtures(page);
  await page.goto(base);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Make my mission card" }).click();
  await page.getByRole("button", { name: "I’m back" }).click();
  const original = "Synthetic draft: a small yellow bird, maybe?";
  await page.getByLabel("What did you notice?").fill(original);
  await page.reload();
  await assert.equal(
    await page.getByLabel("What did you notice?").inputValue(),
    original,
  );
  await page.getByRole("button", { name: "My walks" }).click();
  await page.getByRole("button", { name: "Open →", exact: true }).click();
  assert.equal(
    await page.getByLabel("What did you notice?").inputValue(),
    original,
  );
  await page.getByRole("button", { name: "Save observation" }).click();
  assert.equal(
    await page.evaluate(
      () =>
        Object.keys(
          JSON.parse(localStorage.getItem("trailtape.drafts.v1")).drafts,
        ).length,
    ),
    0,
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("What did you notice?").fill(`${original} It moved.`);
  await page.reload();
  assert.equal(
    await page.getByLabel("What did you notice?").inputValue(),
    `${original} It moved.`,
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  assert.equal(await page.locator(".note").count(), 1);
  await page.getByRole("checkbox").check();
  console.log(
    JSON.stringify({ check: "typed-and-edit-draft-recovery", success: true }),
  );

  await page
    .getByLabel("Import audio recording")
    .setInputFiles("artifacts/synthetic-voice.wav");
  await page.getByLabel("Correct your transcript before saving").waitFor();
  const transcript = await page
    .getByLabel("Correct your transcript before saving")
    .inputValue();
  assert.match(transcript, /bird/i);
  await page.reload();
  assert.equal(
    await page.getByLabel("Correct your transcript before saving").inputValue(),
    transcript,
  );
  await page
    .getByLabel("Correct your transcript before saving")
    .fill(
      "Synthetic reviewed transcript: a bird, maybe. I could not identify it.",
    );
  await page.getByRole("button", { name: "Save observation" }).click();
  await page.getByRole("checkbox").check();
  console.log(
    JSON.stringify({
      check: "uploaded-audio-and-transcript-recovery",
      success: true,
      realGroq: liveAudio,
    }),
  );

  const responsePromise = page.waitForResponse(
    (r) =>
      r.url() === `${base}/api/transcribe` && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Record voice note" }).click();
  await page.getByRole("button", { name: "Stop recording" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "New walk" }).isDisabled(),
    true,
  );
  assert.equal(
    await page.getByLabel("What did you notice?").isDisabled(),
    true,
  );
  // Wait for the synthetic sentence to be captured, not a real microphone.
  await page.waitForTimeout(7500);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByRole("button", { name: "Review transcript" }).waitFor();
  assert.equal(
    await page.evaluate(() =>
      window.__testTracks.every((track) => track.readyState === "ended"),
    ),
    true,
  );
  assert.equal(await page.getByLabel("Recorded voice note").count(), 1);
  await page.getByRole("button", { name: "Review transcript" }).click();
  const audioResponse = await responsePromise;
  assert.equal(audioResponse.status(), 200);
  await page.getByLabel("Correct your transcript before saving").waitFor();
  assert.match(
    await page.getByLabel("Correct your transcript before saving").inputValue(),
    /bird/i,
  );
  assert.equal(
    await page.getByRole("button", { name: "New walk" }).isEnabled(),
    true,
  );
  await page.getByRole("button", { name: "Save observation" }).click();
  console.log(
    JSON.stringify({
      check: "record-stop-preview-review",
      success: true,
      realGroq: liveAudio,
      microphone: "synthetic-file",
      tracksReleased: true,
    }),
  );

  // A failed transcription retains the clip for another attempt or discard.
  await page.getByRole("button", { name: "Record voice note" }).click();
  await page.getByRole("button", { name: "Stop recording" }).waitFor();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByRole("button", { name: "Review transcript" }).waitFor();
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Synthetic transcription unavailable." },
    }),
  );
  await page.getByRole("button", { name: "Review transcript" }).click();
  await page
    .getByText("Synthetic transcription unavailable.", { exact: false })
    .waitFor();
  assert.equal(await page.getByLabel("Recorded voice note").count(), 1);
  assert.equal(
    await page.getByRole("button", { name: "New walk" }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Discard recording" }).click();
  assert.equal(
    await page.getByRole("button", { name: "New walk" }).isEnabled(),
    true,
  );
  assert.equal(await page.getByLabel("Recorded voice note").count(), 0);
  console.log(
    JSON.stringify({
      check: "transcription-failure-retains-clip-and-discard-unlocks",
      success: true,
    }),
  );

  await page.getByRole("button", { name: "Create my field journal" }).click();
  await page
    .getByRole("heading", { name: "Synthetic verification journal" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Tentative interpretations" })
      .count(),
    0,
  );
  assert.equal(await page.locator(".note-id").count(), 0);
  await page
    .locator("blockquote")
    .first()
    .getByRole("link", { name: "Note 1" })
    .click();
  assert.match(page.url(), /#note-/);
  assert.equal(await page.locator(".source:target").count(), 1);
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/voice-journal-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Edit observations" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "artifacts/voice-notes-mobile.png",
    fullPage: true,
  });
  console.log(
    JSON.stringify({
      check: "journal-polish-citations-and-mobile-layout",
      success: true,
      journal: "fixture",
    }),
  );

  // The duration limit stops a real recorder; advance only the JS clock.
  await page.clock.install();
  await page.getByRole("button", { name: "Record voice note" }).click();
  await page.getByRole("button", { name: "Stop recording" }).waitFor();
  await page.waitForTimeout(500);
  await page.clock.fastForward(91000);
  await page.clock.resume();
  await page.getByRole("button", { name: "Review transcript" }).waitFor();
  assert.equal(
    await page.evaluate(() =>
      window.__testTracks.every((track) => track.readyState === "ended"),
    ),
    true,
  );
  await page.getByRole("button", { name: "Discard recording" }).click();
  console.log(
    JSON.stringify({ check: "ninety-second-auto-stop", success: true }),
  );

  // Permission denial never acquires a track and must release the navigation lock.
  const denied = await context.newPage();
  await fixtures(denied);
  await denied.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Synthetic denial", "NotAllowedError");
    };
  });
  await denied.goto(base);
  await denied.getByRole("checkbox").check();
  await denied.getByRole("button", { name: "My walks" }).click();
  await denied.getByRole("button", { name: "Open →", exact: true }).click();
  await denied.getByRole("button", { name: "Edit observations" }).click();
  await denied.getByRole("button", { name: "Record voice note" }).click();
  await denied
    .getByText("Microphone permission was denied.", { exact: false })
    .waitFor();
  assert.equal(
    await denied.getByRole("button", { name: "New walk" }).isEnabled(),
    true,
  );
  assert.equal(
    await denied
      .getByRole("button", { name: "↑ Import audio", exact: true })
      .isEnabled(),
    true,
  );
  await denied.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => (window.__resolvePermission = resolve));
  });
  await denied.getByRole("button", { name: "Record voice note" }).click();
  await denied.getByRole("button", { name: "Cancel recording" }).click();
  assert.equal(
    await denied.getByRole("button", { name: "New walk" }).isEnabled(),
    true,
  );
  await denied.evaluate(() => {
    const audio = new AudioContext();
    window.__lateMic = audio.createMediaStreamDestination().stream;
    window.__resolvePermission(window.__lateMic);
    audio.close();
  });
  await denied.waitForFunction(() =>
    window.__lateMic.getTracks().every((track) => track.readyState === "ended"),
  );
  console.log(
    JSON.stringify({
      check: "cancelled-permission-releases-late-stream",
      success: true,
    }),
  );
  await denied.close();

  await page.evaluate(() =>
    localStorage.setItem("trailtape.drafts.v1", "corrupt synthetic fixture"),
  );
  await page.reload();
  await page
    .getByText("Unfinished drafts could not be read.", { exact: false })
    .waitFor();
  await page.getByRole("button", { name: "My walks" }).click();
  await page.getByRole("button", { name: "Open →", exact: true }).click();
  await page.getByRole("button", { name: "Edit observations" }).click();
  await page
    .getByLabel("What did you notice?")
    .fill("Synthetic unsaved note after corrupt storage.");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("trailtape.drafts.v1")),
    "corrupt synthetic fixture",
  );
  console.log(
    JSON.stringify({ check: "corrupt-draft-data-preserved", success: true }),
  );
  // A history-write failure must keep the autosaved draft recovery copy.
  await page.evaluate(() =>
    localStorage.setItem(
      "trailtape.drafts.v1",
      JSON.stringify({ version: 1, drafts: {} }),
    ),
  );
  const quotaPage = await context.newPage();
  await fixtures(quotaPage);
  await quotaPage.goto(base);
  await quotaPage.getByRole("button", { name: "My walks" }).click();
  await quotaPage.getByRole("button", { name: "Open →", exact: true }).click();
  await quotaPage.getByRole("button", { name: "Edit observations" }).click();
  const backup = "Synthetic recovery copy when history storage fails.";
  await quotaPage.getByLabel("What did you notice?").fill(backup);
  await quotaPage.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "trailtape.walks.v1")
        throw new DOMException("Synthetic full storage", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await quotaPage.getByRole("button", { name: "Save observation" }).click();
  await quotaPage
    .getByText("Browser storage is unavailable or full.", { exact: false })
    .waitFor();
  await quotaPage.reload();
  assert.equal(
    await quotaPage.getByLabel("What did you notice?").inputValue(),
    backup,
  );
  await quotaPage.close();
  console.log(
    JSON.stringify({
      check: "history-save-failure-keeps-draft-backup",
      success: true,
    }),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ check: "permission-denial-recovery", success: true }),
  );
} finally {
  await browser.close();
}
