import { test } from "node:test";
import assert from "node:assert/strict";
import { parseModelJson } from "../server/model-json.js";
import { GemmaAdapter, type Config } from "../server/providers.js";

const config: Config = {
  mode: "live",
  gemmaKey: "test-only",
  gemmaBase: "https://openrouter.ai/api/v1",
  gemmaModel: "google/gemma-4-26b-a4b-it:free",
  audioKey: "",
  audioBase: "https://example.test",
  audioModel: "whisper-large-v3-turbo",
};
const preferences = {
  duration: 20 as const,
  setting: "Park" as const,
  interests: ["Birds" as const],
};
const missions = {
  missions: Array.from({ length: 3 }, (_, i) => ({
    title: `Notice ${i + 1}`,
    instruction:
      "If you notice movement, observe from a distance. Otherwise notice a still surface.",
  })),
};
const wrap = (content: string, finish_reason = "stop") =>
  Response.json({ choices: [{ message: { content }, finish_reason }] });

test("Google Gemma 4 disables long thinking without assuming JSON-mode support", async () => {
  const adapter = new GemmaAdapter(
    {
      ...config,
      gemmaBase: "https://generativelanguage.googleapis.com/v1beta/openai",
      gemmaModel: "gemma-4-26b-a4b-it",
      gemmaOutputFormat: "prompt",
    },
    async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      assert.deepEqual(body.extra_body, {
        google: { thinking_config: { thinking_level: "minimal" } },
      });
      assert.equal(body.response_format, undefined);
      assert.equal(body.provider, undefined);
      return wrap(JSON.stringify(missions));
    },
  );
  assert.equal((await adapter.missions(preferences)).length, 3);
});

test("parses bare JSON and a single complete JSON fence without changing note text", () => {
  const value = { text: 'Maybe?\nA literal ``` inside a note and a "quote".' };
  const json = JSON.stringify(value);
  for (const content of [
    json,
    ` \n${json}\n`,
    `\`\`\`json\n${json}\n\`\`\``,
    `\`\`\`\r\n${json}\r\n\`\`\``,
  ])
    assert.deepEqual(parseModelJson(content), value);
});

test("does not extract, repair, or join malformed output", () => {
  for (const content of [
    'Here is your JSON: {"a":1}',
    '{"a":1} extra text',
    '{"a":1,}',
    "{'a':1}",
    '{"a":',
    '```json\n{"a":1}',
    '```json\n{"a":1}\n```\n```json\n{"a":2}\n```',
  ])
    assert.throws(() => parseModelJson(content));
});

test("documented OpenRouter Gemma requests JSON mode and compatible routing", async () => {
  const adapter = new GemmaAdapter(config, async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.deepEqual(body.provider, { require_parameters: true });
    return wrap(JSON.stringify(missions));
  });
  assert.equal((await adapter.missions(preferences)).length, 3);
});

test("documented DeepInfra Gemma uses JSON mode without OpenRouter routing fields", async () => {
  const adapter = new GemmaAdapter(
    {
      ...config,
      gemmaBase: "https://api.deepinfra.com/v1/openai",
      gemmaModel: "google/gemma-3-27b-it",
    },
    async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(body.provider, undefined);
      return wrap(JSON.stringify(missions));
    },
  );
  await adapter.missions(preferences);
});

test("unknown endpoints remain prompt-only and explicit overrides are respected", async () => {
  for (const [base, format, expected] of [
    ["https://example.test/v1", "auto", false],
    [config.gemmaBase, "prompt", false],
    ["https://example.test/v1", "json_object", true],
  ] as const) {
    const adapter = new GemmaAdapter(
      { ...config, gemmaBase: base, gemmaOutputFormat: format },
      async (_url, init) => {
        assert.equal(
          !!JSON.parse(init!.body as string).response_format,
          expected,
        );
        return wrap(JSON.stringify(missions));
      },
    );
    await adapter.missions(preferences);
  }
});

test("fenced mission JSON still passes strict schema validation", async () => {
  const good = new GemmaAdapter(config, async () =>
    wrap(`\`\`\`json\n${JSON.stringify(missions)}\n\`\`\``),
  );
  assert.equal((await good.missions(preferences)).length, 3);
  const bad = new GemmaAdapter(config, async () =>
    wrap('```json\n{"missions":[]}\n```'),
  );
  await assert.rejects(() => bad.missions(preferences), /invalid mission card/);
});

test("fenced journals cannot bypass source IDs or exact uncertainty-preserving quotes", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const notes = [
    { id, kind: "typed" as const, text: "A small yellow bird, maybe?" },
  ];
  const journal = {
    title: "Field notes",
    observations: [{ sourceNoteIds: [id], quote: notes[0].text }],
    interpretations: [],
    nextMission: {
      sourceNoteIds: [id],
      instruction: "If a similar bird appears, observe its movement.",
    },
  };
  const adapterFor = (value: unknown) =>
    new GemmaAdapter(config, async () =>
      wrap(`\`\`\`json\n${JSON.stringify(value)}\n\`\`\``),
    );
  assert.equal(
    (await adapterFor(journal).journal(preferences, notes)).observations[0]
      .quote,
    notes[0].text,
  );
  await assert.rejects(
    () =>
      adapterFor({
        ...journal,
        nextMission: {
          ...journal.nextMission,
          sourceNoteIds: ["00000000-0000-4000-8000-000000000009"],
        },
      }).journal(preferences, notes),
    /grounding/,
  );
  await assert.rejects(
    () =>
      adapterFor({
        ...journal,
        observations: [{ sourceNoteIds: [id], quote: "A yellow bird." }],
      }).journal(preferences, notes),
    /grounding/,
  );
});

test("truncated responses are rejected even if their partial content parses", async () => {
  const adapter = new GemmaAdapter(config, async () =>
    wrap(JSON.stringify(missions), "length"),
  );
  await assert.rejects(
    () => adapter.missions(preferences),
    /incomplete mission card/,
  );
});

test("malformed mission errors name the correct stage and do not retry or substitute demo data", async () => {
  let calls = 0;
  const adapter = new GemmaAdapter(config, async () => {
    calls++;
    return wrap("not-json");
  });
  await assert.rejects(
    () => adapter.missions(preferences),
    /No mission card was saved/,
  );
  assert.equal(calls, 1);
});
