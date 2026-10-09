import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "dotenv";

// This check uses the actual local live configuration and may spend inference
// credits. All observation input is synthetic. No credentials are printed.
const env = parse(await readFile(".env", "utf8"));
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
  headless: true,
});
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(60000);
try {
  const response = await context.request.get(`${base}/api/status`);
  assert.equal(response.status(), 200);
  const status = await response.json();
  assert.equal(status.mode, "live");
  assert.equal(status.mode, env.AI_MODE || "live");
  assert.equal(status.model, env.GEMMA_MODEL || "google/gemma-3-27b-it");
  for (const name of ["GEMMA_API_KEY", "TRANSCRIPTION_API_KEY"]) {
    if (env[name]) assert.ok(!JSON.stringify(status).includes(env[name]));
  }
  console.log(
    JSON.stringify({
      check: "proxied-status",
      http: 200,
      mode: status.mode,
      model: status.model,
      credentialsExposed: false,
    }),
  );

  const foreign = await context.request.post(`${base}/api/missions`, {
    headers: {
      Origin: "https://unrelated.example",
      "Sec-Fetch-Site": "cross-site",
    },
    data: { duration: 20, setting: "Park", interests: ["Birds"] },
  });
  assert.equal(foreign.status(), 403);
  console.log(JSON.stringify({ check: "unrelated-origin", http: 403 }));

  // Real browser metadata: external-link navigation is cross-site/navigate/
  // document, with no Origin. HTTPS-to-HTTP navigation can omit Referer too.
  await page.route("https://unrelated.example/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<a href="${base}/api/status">Open status</a>`,
    }),
  );
  await page.goto("https://unrelated.example/");
  const navigationResponse = page.waitForResponse(`${base}/api/status`);
  await page.getByText("Open status").click();
  assert.equal((await navigationResponse).status(), 200);
  assert.equal(JSON.parse(await page.locator("body").innerText()).mode, "live");
  console.log(
    JSON.stringify({
      check: "cross-site-top-level-status-navigation",
      http: 200,
    }),
  );

  await page.goto(base);
  const fetched = await page.evaluate(async () => {
    const result = await fetch("/api/status");
    return { http: result.status, body: await result.json() };
  });
  assert.equal(fetched.http, 200);
  assert.equal(fetched.body.model, status.model);
  await page.getByRole("checkbox").check();
  // Reproduce Next's plain-text proxy failure and verify the actual UI recovery.
  await page.route("**/api/missions", (route) =>
    route.fulfill({
      status: 500,
      contentType: "text/plain",
      body: "Internal Server Error",
    }),
  );
  await page.getByRole("button", { name: "Make my mission card" }).click();
  await page.locator(".alert").waitFor();
  assert.match(
    await page.locator(".alert").innerText(),
    /API connection failed/,
  );
  assert.doesNotMatch(
    await page.locator(".alert").innerText(),
    /Unexpected token/,
  );
  await page.unroute("**/api/missions");
  console.log(
    JSON.stringify({ check: "plain-text-proxy-error-ui", success: true }),
  );
  const missionResponse = page.waitForResponse(
    (r) =>
      r.url() === `${base}/api/missions` && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const missions = await missionResponse;
  const result = await missions.json();
  assert.notEqual(missions.status(), 403);
  console.log(
    JSON.stringify({
      check: "proxied-missions-routing",
      http: missions.status(),
      routingPassed: true,
    }),
  );
  if (!missions.ok()) {
    await page.locator(".alert").waitFor();
    assert.ok(
      await page
        .getByRole("button", { name: "Retry", exact: true })
        .isVisible(),
    );
    console.log(
      JSON.stringify({
        check: "real-gemma-missions",
        success: false,
        error: result.error,
        browserErrorAndRetryVerified: true,
      }),
    );
  } else {
    assert.equal(result.mode, "live");
    assert.equal(result.model, status.model);
    assert.equal(result.missions.length, 3);
    await page
      .getByRole("heading", { name: "Pocket this. Then look up." })
      .waitFor();
    await page.getByRole("button", { name: "I’m back" }).click();
    await page
      .getByLabel("What did you notice?")
      .fill(
        "Synthetic verification note: a small yellow bird, maybe. I could not identify it.",
      );
    await page.getByRole("button", { name: "Save observation" }).click();
    const journalResponse = page.waitForResponse(
      (r) =>
        r.url() === `${base}/api/journal` && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Create my field journal" }).click();
    const journal = await journalResponse;
    if (journal.ok()) {
      await page.locator("blockquote").waitFor();
      assert.match(
        await page.locator("blockquote").textContent(),
        /I could not identify it/,
      );
    } else {
      await page.locator(".alert").waitFor();
    }
    console.log(
      JSON.stringify({
        check: "real-gemma-missions",
        success: true,
        journalHttp: journal.status(),
        journalSuccess: journal.ok(),
        syntheticInput: true,
      }),
    );
  }
} finally {
  await browser.close();
}
