# Verification record — 9 October 2026

These results apply to the initial implementation in this workspace. They are
engineering checks, not outdoor evidence, a user study, or model accuracy scores.

| Check                            | Result                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Node / package installation      | Node 22.16.0; npm installation succeeded; install audit reported zero vulnerabilities at that time                |
| Frontend and backend type checks | `npm run typecheck` passed                                                                                        |
| Focused unit/API tests           | `npm test`: 15 passed, zero failed                                                                                |
| Production build                 | `npm run build` passed: Next.js 16.4.0 production frontend plus compiled TypeScript backend                       |
| Production startup               | `AI_MODE=demo npm start` served frontend and API together on port 3001                                            |
| Desktop browser                  | Edge, 1440 × 1080: sample preferences → three missions → two typed notes → grounded journal → export passed       |
| Mobile browser                   | Edge, 390 × 844: card and journal journey passed; no horizontal overflow in checked views                         |
| Local history                    | Reload → reopen journal; edit → regenerate; confirm deletion passed                                               |
| Source grounding UI              | Source links reached original notes; exported journal retained uncertainty and stable IDs                         |
| Printing / downloads             | Print-media layout inspected; field-card and journal Markdown downloads passed                                    |
| Audio UI                         | Mocked transcript imported, corrected, saved, and retained as corrected source text in a journal                  |
| Audio API                        | Mocked multipart Whisper response passed; disguised, oversized, and multiple-file uploads rejected                |
| Provider reliability             | Mocked transient recovery, auth rejection, bounded retries, invalid output, and actual timeout-abort tests passed |
| UI retry                         | Controlled mock 503 → explicit Retry → successful card generation passed                                          |
| Browser errors                   | No page errors during the checked desktop/mobile demo journey                                                     |

Development startup was also smoke-tested: `npm run dev` served the frontend
on 3000 and Express on a configured 3002. The `/api/status` proxy returned
labeled demo status, and the frontend returned HTTP 200.

Screenshots were visually inspected: `artifacts/desktop-prepare.png`,
`mobile-prepare.png`, and `print-card.png`. Other sample screenshots and
`sample-journal.md` are available in the same directory. They show deterministic
demo data, never live Gemma output. Browser automation is reproducible through
`npm run test:browser`; see README for the local Edge/Chrome option.

## Not verified

- No real Gemma or Whisper call was attempted or succeeded: no backend keys
  were supplied. Documentation/model availability was verified independently.
- No real-world mission usefulness, transcription quality, or semantic journal
  accuracy was measured. The injection test checks prompt construction and
  schema rejection, not resistance of the real model to prompt injection.
- No real-model latency, cost, accuracy, or success-rate figures were collected.
- No outdoor test, deployed Render service, or published DEV submission.
- No exhaustive accessibility audit, cross-browser matrix, or concurrent-load
  test. Labels, keyboard focus styles, reduced-motion styling, and mobile
  layouts exist; browser checks do not certify accessibility compliance.

The six synthetic evaluation cases and live runner are prepared for the next
step. Run with a locally configured Gemma key, then manually review semantic
support and uncertainty as well as structural validation.
