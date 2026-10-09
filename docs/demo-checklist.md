# Outdoor walkthrough and submission evidence

Planned check: **10 October 2026**. Keep this record factual, including failures.
The existing synthetic live-model checks are documented in
[voice/draft verification](voice-and-drafts.md) and
[Google verification](google-proxy-verification.md); they do not replace this walk.

## Before going out

- Start one `npm run dev` stack. Confirm live mode and `gemma-4-26b-a4b-it` on
  `/api/status`; don't display `.env` or credentials in the recording.
- Generate and save/print the actual mission card. Check its conditional
  alternatives, then put the screen away. Completing every mission is optional.
- Recording needs localhost or HTTPS. For a phone on plain HTTP over the LAN,
  record in its native voice recorder and import the clip afterward. Record your
  own speech, without capturing private conversations.

## Fill in after the walk

| Evidence                                              | Actual result to enter                                                                                                                                                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity, general setting, date, approximate duration | **PENDING:** avoid a precise/private location                                                                                                                                                                     |
| Mission card                                          | **PENDING:** settings, generated missions, screenshot or exported card                                                                                                                                            |
| Two or three original observations                    | **PENDING:** exact saved wording, retaining uncertainty                                                                                                                                                           |
| Quiet voice note                                      | **PENDING:** short sample, recording/import method, playback result                                                                                                                                               |
| Background-noise voice note                           | **PENDING:** noise description and transcription result, including failure                                                                                                                                        |
| Transcript review                                     | **PENDING:** original transcript, corrected wording, or “no correction needed”                                                                                                                                    |
| Recovery and retry                                    | **PENDING:** refresh an unfinished typed/reviewed-text draft; report whether it recovered. Note any natural transcription failure and whether Retry retained the clip; mark retry “not observed” if none occurred |
| Journal and source links                              | **PENDING:** screenshot/Markdown; check every observation matches its saved note, each link opens the correct source, and interpretations don't invent species or causes                                          |
| Next mission                                          | **PENDING:** quote it and explain whether it was useful and supported by the notes                                                                                                                                |
| Problem or surprise                                   | **PENDING:** what happened and any correction; “none observed” is acceptable                                                                                                                                      |
| Timings, only if measured                             | **PENDING:** preparation/editing or request times, sample count, retries included; otherwise write “not measured”                                                                                                 |
| Screenshots                                           | **PENDING:** actual mission card, transcript review, journal/source view; captions and links                                                                                                                      |
| 60–90 second demo video                               | **PENDING:** shareable URL                                                                                                                                                                                        |

Raw audio is not refresh-recoverable. Test recovery with text after transcription
review, before saving. After saving a note, confirm its draft is cleared. Export
the finished journal and check history after reload; test deletion on a spare walk.
If interpretations are absent, show that honestly rather than inventing one.

## Record a 60–90 second demo

1. **0–15 seconds:** explain the problem, show live mode, choose preferences, and
   generate/show the mission card.
2. **15–25 seconds:** show the saved/printed card and a brief outdoor shot from
   the actual activity. Explain that the screen can stay away.
3. **25–45 seconds:** show Record, Stop, playback, Review transcript, an actual
   correction if needed, and Save. Mention the background-noise outcome.
4. **45–65 seconds:** show the resulting journal, one original-note source link,
   preserved uncertainty, and the next mission.
5. **65–90 seconds:** briefly show draft recovery and Markdown export. Explain
   browser storage versus Google/Groq processing, and report one limitation.

Trim waiting time if necessary, but don't present an edited sequence as a latency
measurement. Label any synthetic or demo insert separately. A deployed URL is
optional when the video demonstrates the local app; don't imply a deployment.

## Finish the unpublished DEV draft

- Replace the outdoor evidence block in [submission-draft.md](submission-draft.md)
  with a short first-person account supported by the record above. Keep the
  illustrative example explicitly labeled if retaining it.
- Replace the video and outdoor-screenshot placeholders with accessible links.
  Publish timing numbers only if recorded; otherwise say they weren't measured.
- Check the configured [repository URL](https://github.com/Rohan-Saxena644/TrailTape)
  and screenshot links while signed out. A Git remote alone doesn't prove public
  access. Push these documentation changes before relying on their remote links.
- Keep synthetic integration results separate from the outdoor result. Report
  routing success separately from successful real inference, and record any
  provider/rate-limit failures without removing the app's protections.
- Keep **Best Use of Gemma**; do not add a Render category from `render.yaml`.
  There is no deployed Render service. Omit My Agent Session unless a real,
  reviewed, shareable session link becomes available.
- Preview DEV formatting and required tags `devchallenge, hf26challenge`. The
  file remains `published: false` until you deliberately publish it. Remove all
  remaining `PENDING` blocks from the finished article.

The [official challenge](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)
closes **11 October 2026 at 11:59 PM PDT**, equivalent to **12 October at 12:29 PM
IST**. Leave time to check the rules and publish before the cutoff.
