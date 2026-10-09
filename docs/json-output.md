# JSON output reliability fix

The screenshot's invalid-JSON error came from parsing the entire model message
as JSON. The request had no `response_format`, and the mission prompt's example
also contained a bare `...` placeholder, which itself was not valid JSON. A model
could return Markdown-wrapped JSON, explanatory prose, or genuinely malformed
content. The specific failed response was not captured, so its exact cause is
not established.

Changes:

- Use a valid three-item JSON example and explicitly forbid prose/code fences.
- Request `response_format: {type: "json_object"}` automatically for documented
  OpenRouter Gemma 3 27B / Gemma 4 26B A4B and 31B configurations, including free
  aliases, and DeepInfra Gemma 3 27B. OpenRouter additionally gets
  `provider: {require_parameters: true}` to require parameter-compatible routing.
- Expose `GEMMA_OUTPUT_FORMAT=auto|json_object|prompt` for compatible endpoints.
  Unknown endpoints stay prompt-only under `auto`; no request failure silently
  downgrades the output mode or substitutes demo data.
- Parse a bare JSON document or one complete Markdown JSON block. Do not extract
  objects from prose, join blocks, fix syntax, or reconstruct truncated content.
- Apply the existing strict Zod schema and source-note validation afterward.
  Wrapper removal never modifies note text or makes an invalid citation valid.
- Reject truncated/non-completed responses and identify the correct mission-card
  or journal stage in errors.

Verification: all **30 tests passed**, including nine JSON regression tests;
frontend/backend type checks and the production build passed. Tests cover JSON
mode requests, provider-specific routing fields, explicit configuration overrides,
fenced output, malformed/prose/truncated rejection, and grounding after parsing.

Two live diagnostic runs used synthetic preferences and the locally configured
`google/gemma-4-26b-a4b-it:free`. Before the fix, requests were prompt-only; after
the fix, they requested `json_object`. Both runs received HTTP 429, including
their single bounded transport retry. No live mission output was obtained, so
neither the user's original formatting issue nor the live fix was confirmed
against an actual successful model response. No keys or model content were
printed. The user's existing development processes were left running.

To repeat the live check when the endpoint is available:

```sh
npx tsx scripts/json-smoke.ts
```

This uses your local `.env` and may consume provider quota/credits. It prints
only HTTP status, requested format, completion/framing metadata, and validation
success/count, never full model content or credentials. A rate-limit failure
remains a provider availability issue; JSON parsing cannot fix it.
