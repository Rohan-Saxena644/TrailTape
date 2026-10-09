# Google Gemma and development proxy verification

The reported `Unexpected token 'I', "Internal S"...` error came from the browser
parsing Next's plain-text `Internal Server Error` as JSON after its rewrite proxy
lost the backend connection. It was not evidence of malformed model output.

The installed Next proxy defaults to 30 seconds, while the backend permits two
20-second provider attempts with a short retry delay. The proxy now has a finite
50-second timeout, ahead of the browser's 55-second deadline. The frontend safely
handles unreadable API responses without exposing raw response bodies or parser
exceptions. Origin checks and production protection remain in place.

For Google's exact OpenAI-compatible endpoint and Gemma 4 26B A4B / 31B model
names, requests set `extra_body.google.thinking_config.thinking_level=minimal`.
Google documents this as disabling Gemma 4 thinking. Strict mission and journal
validation still runs; unsupported JSON-mode assumptions are avoided.

Sources: [Google OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai),
[Gemma thinking controls](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api).

Verification on October 9, 2026 used local `.env` credentials and synthetic notes:

- All 33 automated tests, both frontend/backend type checks, and the production build passed.
- Proxied status returned 200 with `AI_MODE=live` and `gemma-4-26b-a4b-it`.
  Provider credentials were not exposed.
- An unrelated explicit origin returned 403.
- Before timeout alignment, provider attempts could outlast Next's proxy.
  After alignment, a timed-out mission request returned a JSON 502 and the browser
  showed a readable error with Retry, without `ECONNRESET` or a JSON parser error.
- After minimal thinking was added, a direct adapter request returned three
  validated missions with HTTP 200 in approximately five seconds.
- A real Edge browser run through localhost:3000 returned HTTP 200 for missions
  and journal, and rendered an exact uncertainty-preserving synthetic note quote.
  A second run first simulated a plain-text proxy failure, verified the connection
  error and Retry UI, then successfully generated real missions and a journal.
- Other attempts returned Google HTTP 500 or timed out. A successful run confirms
  real inference works, but does not establish reliable hosted availability.

No secrets or full provider payloads were printed. Configuration and credentials
in `.env` were left unchanged. Temporary development servers used for verification
are stopped afterward to avoid a duplicate Next process when the user starts dev.
