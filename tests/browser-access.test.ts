import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../server/app.js";
import type { Config } from "../server/providers.js";

const config: Config = {
  mode: "demo",
  gemmaKey: "",
  gemmaBase: "https://example.test",
  gemmaModel: "google/gemma-3-27b-it",
  audioKey: "",
  audioBase: "https://example.test",
  audioModel: "whisper-large-v3-turbo",
};
const preferences = { duration: 20, setting: "Park", interests: ["Birds"] };
const frontendOrigin = "http://localhost:3000";
const appFor = (development: boolean) =>
  createApp(config, undefined, { development, frontendOrigin });
const proxy = { Host: "127.0.0.1:3001", "X-Forwarded-Host": "localhost:3000" };

test("development accepts proxied frontend GET and POST with rewritten Host", async () => {
  const app = appFor(true);
  await request(app)
    .get("/api/status")
    .set(proxy)
    .set("Referer", `${frontendOrigin}/`)
    .set("Sec-Fetch-Site", "same-origin")
    .expect(200);
  for (const site of ["same-origin", "cross-site"]) {
    const result = await request(app)
      .post("/api/missions")
      .set(proxy)
      .set("Origin", frontendOrigin)
      .set("Sec-Fetch-Site", site)
      .send(preferences)
      .expect(200);
    assert.equal(result.body.missions.length, 3);
  }
  await request(app)
    .get("/api/status")
    .set(proxy)
    .set("Referer", `${frontendOrigin}/`)
    .set("Sec-Fetch-Site", "cross-site")
    .expect(200);
});

test("development allows external-link navigation only to safe status/health endpoints", async () => {
  const app = appFor(true);
  const metadata = {
    ...proxy,
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Dest": "document",
  };
  await request(app).get("/api/status").set(metadata).expect(200);
  await request(app).head("/api/health").set(metadata).expect(200);
  await request(app)
    .post("/api/missions")
    .set(metadata)
    .send(preferences)
    .expect(403);
  await request(app).get("/api/missions").set(metadata).expect(403);
  await request(app)
    .get("/api/status")
    .set(proxy)
    .set("Sec-Fetch-Site", "cross-site")
    .set("Sec-Fetch-Mode", "cors")
    .set("Sec-Fetch-Dest", "empty")
    .expect(403);
});

test("foreign, null, malformed, and similar-looking origins remain blocked in development", async () => {
  const app = appFor(true);
  for (const origin of [
    "https://unrelated.example",
    "null",
    "not-a-url",
    "http://localhost:3000.evil.example",
    "http://localhost:3002",
  ]) {
    await request(app)
      .post("/api/missions")
      .set(proxy)
      .set("Origin", origin)
      .set("Sec-Fetch-Site", "same-origin")
      .send(preferences)
      .expect(403);
    await request(app)
      .get("/api/status")
      .set(proxy)
      .set("Origin", origin)
      .set("Sec-Fetch-Site", "cross-site")
      .set("Sec-Fetch-Mode", "navigate")
      .set("Sec-Fetch-Dest", "document")
      .expect(403);
  }
});

test("Referer and forwarded headers cannot override a foreign Origin", async () => {
  await request(appFor(true))
    .post("/api/missions")
    .set(proxy)
    .set("Origin", "https://unrelated.example")
    .set("Referer", `${frontendOrigin}/`)
    .set("Sec-Fetch-Site", "cross-site")
    .send(preferences)
    .expect(403);
  await request(appFor(true))
    .get("/api/status")
    .set({ ...proxy, "X-Forwarded-Host": "unrelated.example" })
    .set("Origin", "https://unrelated.example")
    .expect(403);
});

test("production retains own-origin checks and rejects every development exception", async () => {
  const app = appFor(false);
  await request(app)
    .post("/api/missions")
    .set("Host", "trailtape.example")
    .set("X-Forwarded-Proto", "https")
    .set("Origin", "https://trailtape.example")
    .set("Sec-Fetch-Site", "same-origin")
    .send(preferences)
    .expect(200);
  await request(app)
    .post("/api/missions")
    .set(proxy)
    .set("Origin", frontendOrigin)
    .send(preferences)
    .expect(403);
  await request(app)
    .get("/api/status")
    .set(proxy)
    .set("Sec-Fetch-Site", "cross-site")
    .set("Sec-Fetch-Mode", "navigate")
    .set("Sec-Fetch-Dest", "document")
    .expect(403);
  await request(app)
    .get("/api/status")
    .set(proxy)
    .set("Sec-Fetch-Site", "cross-site")
    .set("Referer", `${frontendOrigin}/`)
    .expect(403);
});

test("status exposes live mode and model but never provider credentials", async () => {
  const app = createApp(
    {
      ...config,
      mode: "live",
      gemmaModel: "google/gemma-3-27b-it:free",
      gemmaKey: "private-gemma-key",
      audioKey: "private-audio-key",
    },
    undefined,
    { development: true, frontendOrigin },
  );
  const result = await request(app).get("/api/status").set(proxy).expect(200);
  assert.deepEqual(result.body, {
    mode: "live",
    model: "google/gemma-3-27b-it:free",
    gemmaReady: true,
    audioReady: true,
  });
  assert.ok(!result.text.includes("private-"));
  assert.equal(result.headers["access-control-allow-origin"], undefined);
});
