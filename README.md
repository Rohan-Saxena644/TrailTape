# TrailTape

**Three pocket missions. One small walk. A journal in your own words.**

TrailTape helps you spend the walk looking around, then save what you noticed.
Choose 10, 20, or 30 minutes, a general setting, and interests. Hosted Gemma
generates three short missions with conditional alternatives; print/save the
card and put the phone away. Afterward, write observations or import a short
recording, correct the transcript, generate a source-linked journal, and export
Markdown. History is saved in this browser, without a database or account.

Built for [Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).
The official [rules](https://dev.to/page/hacktoberfest-week1-2026-10-05-contest-rules)
close entries on 11 October 2026 at 11:59 PM PDT, which is **12 October at
12:29 PM IST**. Target submission day: Sunday 11 October IST. No eligibility,
outdoor-test, live-inference, or deployment claims are implied by this code.

## Run locally

Use Node.js 22.16+ and npm. Dependencies are locked in `package-lock.json`.

```sh
npm ci
```

Copy `.env.example` to `.env` in the repository root. On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux: `cp .env.example .env`. Edit `.env` in your local editor.
**Do not paste keys into a chat, screenshot, submission, or Git commit.** Real
`.env` files are ignored. No environment variable is exposed as `NEXT_PUBLIC_*`.

For the full text workflow, create an [OpenRouter key](https://openrouter.ai/settings/keys),
check account credits and model access, and set:

```dotenv
AI_MODE=live
GEMMA_API_KEY=your_local_openrouter_key
GEMMA_BASE_URL=https://openrouter.ai/api/v1
GEMMA_MODEL=google/gemma-3-27b-it
```

For optional transcription, create a key in the [Groq console](https://console.groq.com/keys)
and put it in `TRANSCRIPTION_API_KEY`. Keep the other transcription defaults.
A missing audio key disables audio import without blocking typed notes.

To try the interface without credentials, explicitly set `AI_MODE=demo`.
Demo cards are fixed and journals deterministically quote your notes. Sample
mode is prominently labeled, stored with each walk, and included in exports.
It never pretends to call Gemma or silently replaces a failed live response.
Audio is unavailable in demo mode.

```sh
npm run dev
```

Open **http://localhost:3000**. Next.js runs on 3000; Express on 3001. The frontend
proxies `/api` to Express. Change `API_PORT` in `.env` if needed. In PowerShell
with script restrictions, use `npm.cmd` instead of `npm`.

The development API permits the exact `DEV_FRONTEND_ORIGIN` (default
`http://localhost:3000`), including through Next's Host-rewriting proxy. If you
use another frontend hostname or port, set that exact origin and restart both
servers. No wildcard CORS is enabled. Development permits external-link
navigation to read-only status/health endpoints; cross-site mutations and
unrelated explicit origins remain blocked. Production allows only its own origin
and retains cross-site Fetch Metadata rejection. See the
[proxy regression record](docs/dev-proxy.md) for captured headers and results.

`npm run test:dev-proxy` verifies the running development stack with the actual
live `.env`, an unrelated-origin rejection, an external-link status navigation,
and a browser mission request. It may spend inference credits, and continues
to a synthetic journal only if missions succeed. Set `BROWSER_EXECUTABLE` as
described below if using an installed browser. It reports request routing
separately from actual model inference.

```sh
npm run typecheck
npm test
npm run build
npm start
```

The production command serves both the frontend and API from one Express
process at **http://localhost:3001** (or `PORT`/`API_PORT`). `npm start` selects
production automatically from the compiled entry point. Run from the repository
root. Development and production shouldn't run simultaneously on the same port.

## Exact providers and models

Official documentation checked on 9 October 2026; access/quotas can change.

| Purpose              | Service / model                     | API format / access                                                                                                                                                    |
| -------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missions and journal | OpenRouter, `google/gemma-3-27b-it` | `POST https://openrouter.ai/api/v1/chat/completions`, Bearer key, JSON `model` and `messages`; OpenRouter account, key and available credits/access                    |
| Audio transcript     | Groq, `whisper-large-v3-turbo`      | `POST https://api.groq.com/openai/v1/audio/transcriptions`, Bearer key, multipart `file`, `model`, `response_format=json`; Groq account/key and model permission/quota |

References: [Gemma listing and published weight link](https://openrouter.ai/google/gemma-3-27b-it),
[OpenRouter API quickstart](https://openrouter.ai/docs/quickstart),
[authentication](https://openrouter.ai/docs/api_reference/authentication),
[Groq quickstart](https://console.groq.com/docs/quickstart),
[speech-to-text formats and models](https://console.groq.com/docs/speech-to-text).
This is **Gemma**, Google's open-weight model, not Gemini. No local model install
is needed. Documented OpenRouter Gemma 3 27B / Gemma 4 26B A4B and 31B endpoints,
and DeepInfra Gemma 3 27B, use JSON-object response mode automatically. OpenRouter
requests also require providers to support the requested parameters. We keep
strict application validation because JSON mode does not enforce our schema or
establish grounding. See [OpenRouter model support](https://openrouter.ai/google/gemma-4-26b-a4b-it:free)
and [DeepInfra JSON modes](https://docs.deepinfra.com/chat/structured-outputs).

`GEMMA_OUTPUT_FORMAT=auto` is the default. Unknown model/endpoint combinations
remain prompt-only; set `json_object` only after confirming support, or `prompt`
to disable the response-format parameter. Unsupported settings fail visibly;
there is no silent downgrade. We accept bare valid JSON or a single complete
Markdown code block containing valid JSON, then apply the same schemas and
source checks. Prose surrounding JSON, malformed syntax, and truncated responses
are rejected without automatic repair. Errors identify the mission-card or
journal stage correctly.

See the [Google proxy and live inference verification](docs/google-proxy-verification.md)
for the Google endpoint configuration, timeout correction, and successful synthetic browser run.
See the [JSON reliability verification record](docs/json-output.md) for the
formatting regressions and the live endpoint's separate rate-limit failure.

The two adapters in `server/providers.ts` have independently configurable base
URLs and model IDs for compatible APIs. Changes require confirming that the
new endpoint serves an actual Gemma model or an appropriate transcription model.
The default Gemma model is not a free-model alias; do not assume inference costs
nothing. OpenRouter can route this model across inference providers; it does not
fall back to a different model in TrailTape's request.

## Why open weights matter here

Gemma is the core of the live experience: it generates small context-sensitive
missions and a next-walk suggestion from actual notes. Published weights make
the model portable to other compatible hosting services; the app's prompts,
schemas, and evaluation inputs make its behavior open to inspection and change.
That creates a path to self-hosting or fine-tuning later without locking journal
format and UI to one proprietary model family. This release does neither.
Hosted access reduces setup work but gives up on-device privacy and offline
inference. No accuracy, price, or latency advantage over closed models has been
measured. Gemma is open-weight under its own terms; the app is MIT licensed.

## Architecture and grounding

```text
Next.js UI ── same-origin /api ── Express
   │                              ├── Gemma adapter ── OpenRouter / Gemma
   │                              └── Whisper adapter ── Groq / Whisper
   └── localStorage: cards, original notes, journals (max 100 walks)
```

`app/` contains the responsive interface; `server/` contains private provider
calls; `shared/` contains schemas, grounding checks, and Markdown exports.
In production, Express delegates non-API requests to Next's custom server.
This keeps Render deployment to one process; it is not Next standalone output.
No authentication, maps, queues, analytics, or persistent server storage.

- Notes receive stable UUIDs when saved. Editing preserves IDs but invalidates
  the old journal; you regenerate it from the current notes.
- Zod validates strict output shapes. References in observations,
  interpretations, and next mission must all point to actual source-note IDs.
- Each recorded observation must quote **one entire source note exactly**, and
  every input note must be represented. A shortened quote cannot erase uncertainty.
- Interpretations are optional and structurally tentative. Prompts forbid
  speculative species IDs. Application checks don't establish semantic truth;
  title, interpretations, missions, and next-mission grounding need human review.
- Input notes are serialized as untrusted data inside the prompt. The model has
  no tools, code execution, retrieval, or system access. Prompt injection can
  still influence generated prose; citations alone are not a complete defense.
- Invalid/truncated model output is rejected, never shown as a successful journal.
  Provider failures don't substitute demo output. Notes remain available to retry.

Limits: 1–20 unique notes, 2,000 characters each; 64 KB JSON input; three missions;
10 MB audio; detected WAV/MP3/M4A/MP4/OGG/WebM/FLAC content. The UI accepts short
recordings; actual duration is not measured. Transcripts over 2,000 characters
are rejected with a request to use a shorter clip. MP4/WebM can contain video;
import audio-only clips to avoid sending unnecessary data.

Provider requests have a 20-second timeout per attempt and at most one retry,
with a 400 ms delay, for connection failures, 429s, or 5xx responses. Auth/credit
errors are not retried. Frontend timeout is 55 seconds. An in-memory rate limiter
permits 20 API requests per minute per IP, and at most two concurrent audio
uploads per process. Audio uses bounded memory buffers, content-signature
validation, and zeroes the original buffer after processing; it creates no
temporary files. Multipart/fetch may make additional memory copies, reclaimed
by the runtime. Never interpret buffer cleanup as provider deletion.

## Data handling and terms

Preferences go through Express to OpenRouter and its routed provider. On journal
creation, all saved notes for that walk, including corrected transcripts, go
with preferences. Imported audio goes through Express to Groq; it is not saved
in walk history. Unsaved typed drafts are held in the tab and are not sent or
persisted. Refreshing loses unsaved drafts. History uses unencrypted localStorage;
browser clearing, storage limits, private mode, and shared-device access matter.
Export Markdown to keep a portable copy. Delete a walk through My walks.

There is no app-level logging of private notes, raw audio, API keys, or provider
response bodies. Hosted services may have their own logging and retention.
Review [OpenRouter provider logging](https://openrouter.ai/docs/guides/privacy/provider-logging)
and account privacy controls, [OpenRouter privacy](https://openrouter.ai/privacy),
and [Groq data controls](https://console.groq.com/docs/your-data).
Hosted inference requires internet and is not fully private. Print/download your
card before walking; the app does not promise offline reloading or inference.
Fonts are bundled locally; the interface uses no remote images or analytics.

Use of hosted Gemma functionality must comply with the [Gemma terms](https://ai.google.dev/gemma/terms)
and [prohibited-use restrictions](https://ai.google.dev/gemma/prohibited_use_policy).
The live interface requires agreement before sending data. Operators must also
comply with [OpenRouter terms](https://openrouter.ai/terms) and
[Groq terms](https://groq.com/terms-of-use/). See `NOTICE`. No model weights are
distributed here and the app's MIT license doesn't relicense models or services.

## Verification and evaluation

Focused tests cover strict output validation, citations in every section,
uncertainty removal, omitted notes, input limits, untrusted-data prompting,
transient recovery, auth failures, bounded retries, real timeout cancellation,
no demo substitution, the demo API slice, and audio signature/size/multipart
handling. Mock audio calls are not evidence of real transcription quality.

To repeat browser verification, start a production server with `AI_MODE=demo`;
install Playwright's browser (`npx playwright install chromium`) or set
`BROWSER_EXECUTABLE` to a local Chrome/Edge executable, then `npm run test:browser`.
`TEST_BASE_URL` defaults to http://localhost:3001. The script exercises desktop
and mobile journeys, print styling, downloads, source links, history persistence,
note editing/regeneration, and deletion. It refuses to run a live-mode journey.
Screenshots and the exported synthetic journal are written to `artifacts/`.
They are sample-mode evidence only.

For real model evaluation, set your local Gemma key and `AI_MODE=live`, then:

```sh
npm run evaluate
```

This sends only the synthetic cases in `docs/evaluation.json` to Gemma and costs
provider credits. It emits the exact model, measured elapsed time including
retries, structural pass/fail, and generated output. Manually review every case
against its expectations, especially invented species, unsupported interpretations,
instruction following, and specific next missions. A structural pass is not an
accuracy score. Do not substitute demo outputs for real evaluation results.
See [verification record](docs/verification.md) for what actually ran.

## Deployment and submission

`render.yaml` is a prepared [Render Blueprint](https://render.com/docs/blueprint-spec)
for one Node web service on the free plan. Nothing has been deployed. After you
choose to deploy, push a new repository, connect it in Render, and review the
Blueprint, plan availability and any inference charges before creating it.
Set the keys in Render's secret environment settings, never in YAML. The build
uses `npm ci && npm run build`; start uses `npm start`; health check is
`/api/health`. Render provides `PORT` and the Blueprint sets `NODE_ENV=production`.
Free instances can sleep, making the first request slow. There is no durable
server filesystem requirement; history stays with each user's browser origin.
Moving to a new hostname doesn't migrate existing local history.

The server trusts one reverse proxy, as expected on Render. Public demo hosting
has no user login; IP throttling and provider account spend limits are useful
bounds, not a full abuse-control system. Review limits before wider exposure.
Do not claim the Render category from a config file alone.

- [Reproducible synthetic sample](docs/sample-walkthrough.md)
- [Evaluation inputs](docs/evaluation.json)
- [Recording / outdoor-test checklist](docs/demo-checklist.md)
- [DEV submission draft using actual template headings](docs/submission-draft.md)

Before submitting: configure and verify real Gemma, take an actual outdoor walk,
record evidence and real timings, review model failures, add repository/demo links,
and replace every draft placeholder. Audio can remain optional if access fails;
report that honestly. Publish only when you're ready. Verify eligibility against
the official rules; no prize eligibility is claimed here. Note any post-deadline
commits in this README as required by the challenge.

## Current limitations

The follow-up development proxy check attempted live Gemma missions using the
locally configured `google/gemma-3-27b-it:free`. Routing succeeded, but the
provider adapter returned HTTP 502; no real Gemma output was obtained.
The later JSON-mode check used `google/gemma-4-26b-a4b-it:free` and received HTTP
429 both before and after the formatting fix. A subsequent Google Gemma 4 check
successfully generated missions and a grounded journal through the development
proxy in a real browser; other Google attempts timed out or returned HTTP 500.
See [the verification record](docs/google-proxy-verification.md).
Whisper has not been tested with real credentials. API docs verification confirms the
intended integration format, not account-level access.
No outdoor test, real-model accuracy/latency measurement, deployment, or submission
has been completed. Automatic grounding protects exact recorded notes but doesn't
guarantee prose is semantically supported. History is device/browser-specific;
there is no sync, audio playback/storage, offline service worker, or species ID.
The initial workspace was empty and not a Git repository; no existing work was
overwritten and no remote was created or pushed.
