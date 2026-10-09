---
title: "TrailTape: a small reason to step outside"
published: false
tags: devchallenge, hf26challenge
---

_This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)._

## What I Built

I wanted a small reason to get outside, without making the outing another thing
to manage on a screen. A walk doesn't need a dashboard. Sometimes it just needs
a starting point: listen for something unfamiliar, look at a texture, or notice
how the light changes.

I built **TrailTape** around that idea. Choose 10, 20, or 30 minutes, a general
setting such as a park or neighborhood, and a few interests. Gemma prepares three
short missions with alternatives when something isn't there. Print or save the
pocket card, put the screen away, and go outside. Completing every mission is
optional; the card is an invitation to pay attention.

When you're back, you can leave it there or bring observations into a field
journal. Type a note, import a short recording, or use **Record → Stop → listen
back → Review transcript → correct → Save**. I wanted the person who made the
observation to have the final say over its wording.

**Illustrative example, not an outdoor test:** imagine choosing a 20-minute park
walk with an interest in sounds. One mission might invite listening from a still
spot. Afterward, you could save “I heard a soft rustle, but couldn't see its
source” and “A small yellow bird, maybe. I couldn't identify it.” The journal
must reproduce both saved notes exactly and link them to Note 1 and Note 2. A
possible next mission is to return to that listening spot and notice whether the
rustle repeats. The unidentified bird should remain unidentified.

The journal separates recorded observations from optional tentative
interpretations. You can follow each numbered reference back to the source,
edit an observation and regenerate, or export Markdown. Unfinished typed notes,
reviewed transcripts, and edits recover after refresh. Walk history stays in
the browser, without an account.

> **PENDING — actual outdoor walkthrough, planned for 10 October 2026:**
> Add the activity, general setting, approximate duration, and generated mission
> card; two or three actual observations; quiet/noisy audio results and transcript
> corrections; whether draft recovery/retry worked; the resulting journal and
> usefulness of its next mission; and one problem or surprise. Add preparation,
> transcription, or generation timings only if actually measured, with the number
> of requests and any retries. This example is not a substitute for that evidence.

## Demo

> **PENDING — 60–90 second demo video link:** add the recording after the outdoor
> and audio check. Show the mode, pocket card, voice review, journal source links,
> draft recovery, and export.

> **PENDING — outdoor screenshots:** add the actual mission card and resulting
> journal, with captions distinguishing real observations from synthetic tests.

For now, the repository includes a
[journal screenshot](https://github.com/Rohan-Saxena644/TrailTape/blob/main/artifacts/voice-journal-desktop.png)
and a [mobile voice-note screenshot](https://github.com/Rohan-Saxena644/TrailTape/blob/main/artifacts/voice-notes-mobile.png).
These show the implemented UI with controlled synthetic inputs. They are not
photos or results from an outdoor walk. There is no deployed demo yet; the
recording will demonstrate the local app.

## Code

[TrailTape on GitHub](https://github.com/Rohan-Saxena644/TrailTape)

The app is MIT licensed. The README has the current Google/Groq setup, local and
production commands, data flow, limitations, and links to verification records.
Prompts, schemas, adapters, and synthetic evaluation cases are in the repository.

## How I Built It

I used Next.js and TypeScript for the interface, with Express handling provider
requests and keeping credentials on the backend. The current text model is
**`gemma-4-26b-a4b-it`, hosted by Google**, through
`https://generativelanguage.googleapis.com/v1beta/openai`. The hosting interface
is called the Gemini API, but I'm requesting **Gemma 4**, which Google explicitly
lists in its [hosted Gemma documentation](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api).
Gemma generates the mission card, journal structure, optional interpretations,
and next-walk suggestion from the supplied settings and notes.

Audio uses **Groq's `whisper-large-v3-turbo`** through its speech-to-text endpoint.
It transcribes speech; it doesn't identify wildlife from its sounds. Playback
and editable review happen before the transcript becomes a saved observation.
Raw audio is held in memory rather than stored in history. An unsuccessful
transcription keeps the clip available to retry or discard; refreshing the page
loses the clip, while reviewed text drafts can recover.

Two decisions mattered to the experience. First, I made recorded observations
exact source excerpts. Saved notes get stable IDs, and strict Zod validation
rejects unknown references, altered excerpts, or missing notes. That prevents a
fluent rewrite from quietly removing “maybe.” Interpretations default to an
empty list; a comparison needs at least two distinct source notes. Empty
interpretation sections disappear instead of filling the journal with restated
observations.

Second, I aligned the timeouts across the provider, Express, Next's proxy, and
browser. The backend could make two 20-second attempts, while the proxy used to
give up after 30 seconds. A plain-text proxy failure then appeared as an invalid
JSON error. The proxy now waits up to 50 seconds and the browser up to 55, and
unreadable API responses become a usable connection error with Retry. The
development proxy also permits the exact intended frontend origin while still
rejecting unrelated origins. Routing and model availability are checked
separately.

These rules validate structure and preserve the saved evidence. They don't prove
that a generated interpretation is true or that every next mission is useful.
I still need to review generated prose against the notes, especially any species
claim or implied cause.

The verification recorded on 9 October includes **37 passing automated tests**,
frontend/backend type checks, and a production build. Demo browser checks cover
desktop/mobile use, print/export, source links, history, editing, and deletion.
Voice/draft checks also exercise permission failures and interrupted storage.

Separate **real Google calls with synthetic inputs** successfully generated
missions and journals through `localhost:3000`. A later two-note journal check
preserved exact quotes and returned no interpretations. **Real Groq calls**
transcribed a synthetic spoken WAV and browser-recorded WebM; those checks used
a fake microphone, not a person outdoors. Other Google requests returned errors
or timed out. These are integration checks, not a user study, an accuracy score,
or evidence that the free quota will always be available. Tomorrow's physical
microphone and background-noise checks remain pending.

## Why Does Open Innovation Matter?

I want someone else to be able to understand and change what this tool asks of
them. The app's open code exposes the prompts, validation rules, and evaluation
inputs. Gemma's published weights add the possibility of serving the model with
another compatible host or self-hosting it. Google lists this Gemma 4 release
under Apache 2.0 in its [model card](https://ai.google.dev/gemma/docs/core/model_card_4).

That leaves room for experiments such as tuning on consented field-journal
examples. I haven't implemented local inference or fine-tuning; the useful
starting point here is a working hosted integration with a replaceable adapter
and a journal format people can export.

Hosted inference makes setup manageable, but it needs internet and sends data
outside the browser. Google receives preferences and saved notes for generation;
Groq receives audio when transcription is requested. Local history and draft
recovery don't make those calls private or offline. Provider terms and quotas
apply, and I can't promise permanently free access. Deleting a local walk removes
its browser data, not data already sent to a provider.

For this first version, I kept the product small: no database, login, maps, or
cross-device sync. The outdoor test will tell me whether the mission card helps
someone notice something and whether reviewing a voice note is convenient
enough to use afterward.

## Prize Categories

**Best Use of Gemma.** Gemma is responsible for the personalized missions and
the follow-up suggestion grounded in saved observations. Its contribution is the
loop from “what could I notice?” to “what could I notice next time?”, with original
notes kept visible and uncertainty preserved. The exact Gemma 4 model has been
verified through real hosted calls with synthetic inputs; the outdoor evidence
will be added before publication.
