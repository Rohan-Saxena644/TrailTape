# Voice notes, draft recovery, and journal polish

Groq transcription uses the backend-only `TRANSCRIPTION_API_KEY`, with
`TRANSCRIPTION_BASE_URL=https://api.groq.com/openai/v1` and
`TRANSCRIPTION_MODEL=whisper-large-v3-turbo`. The Google Gemma key is separate.
Restart the dev server after changing `.env`.

On the after-walk screen, record a voice note, stop, listen back, and choose
**Review transcript**. Recording stops automatically after 90 seconds or when
the 10 MB limit is exceeded. Microphone permission is requested only after
clicking Record. The microphone is released on stop, failure, cancellation, and
unmount. A late permission grant after cancellation is released too.

Raw recordings stay in memory in the tab. They are sent for transcription only
when requested, and are not recovered across refreshes. Failed transcription
keeps the recording available for another attempt or discard. Imported files
retain the existing format/signature validation and memory-only backend handling.
Recording needs HTTPS or localhost; on a phone visiting a plain HTTP LAN address,
use the phone's voice recorder and import its file instead.

Typed drafts, transcript drafts, and unfinished edits are saved as text in a
separate versioned browser-storage record. They remain attached to their walk.
Refresh resumes the last unfinished draft; opening a walk restores its own draft.
Saving or clearing removes that draft. Corrupt storage is left untouched and
storage failures show a warning. A failed history save retains the earlier draft
backup. Clearing browser data still removes local history and drafts.

The journal hides internal UUIDs while retaining numbered source links and UUIDs
in Markdown exports. Empty interpretation sections are omitted. The model is
instructed to prefer an empty list to restating an observation; optional
comparisons must cite at least two distinct notes. This evidence-count rule is
enforced after citation validation and applied to older saved journals in the UI
and exports. It does not establish semantic truth. Human review remains needed.
Privacy text uses backend-supplied provider names without exposing credentials or
provider URLs.

## Verification, October 9, 2026

- Live Groq successfully transcribed a synthetic spoken WAV uploaded through
  localhost:3000 and a real browser MediaRecorder WebM of that synthetic speech.
  No physical microphone or private conversation was captured.
- Browser checks passed for typed/transcript/edit refresh recovery, microphone
  release, recording preview, editable transcription, failed transcription with
  clip retention, discard, permission denial, late permission after cancellation,
  the 90-second auto-stop, corrupt draft preservation, draft backup after a history
  storage-write failure, source links, and mobile layout.
- All 37 automated tests, both type checks, and the production build passed. The
  production demo browser workflow also passed print/export, history/reload,
  edit/regenerate, deletion, mobile layout, and controlled audio/error cases.
- A separate real Google Gemma 4 journal check with two synthetic notes passed
  exact-quote and reference validation, with an empty interpretation list. Other
  live Google attempts returned provider errors; bulk local browser tests also
  correctly reached the app's existing request-rate limit. Neither limit was
  disabled. See `scripts/journal-smoke.ts` and the earlier routing record.
- Mission and journal responses in the voice-specific browser test are explicitly
  controlled fixtures. They are not presented as real Gemma output or outdoor
  observations. Google inference has a separate live verification script.

With `npm run dev` running and a local Groq key configured:

```powershell
$env:BROWSER_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run test:voice
```

The default transcription responses are mocked. To test real Groq using only the
provided synthetic speech sample, set `TEST_LIVE_AUDIO=1` for that command. This
consumes transcription quota. The browser uses a fake microphone backed by
`artifacts/synthetic-voice.wav`. Test screenshots are synthetic fixtures.

## Remaining outdoor checks

Take a short walk and record your actual observations. Check one quiet voice
note, one with background noise, and one uncertain observation. Review and correct
each transcript before saving. Verify the journal quotes every saved note exactly,
its next mission follows a real note, and no interpretation claims an unsupported
species or cause. Try a page refresh during an unfinished typed/transcript draft,
then export the finished journal. Record failures as well as successes in
[the outdoor checklist](demo-checklist.md). This verification has not been done
outdoors by the coding agent.
