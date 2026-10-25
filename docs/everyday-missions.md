# Everyday missions and richer journals

Verified on **25 October 2026**.

## What changed

- Missions now treat the app as a break from home and screens, with public life,
  everyday routines, objects, signs, buildings, movement, and small surprises
  alongside nature. Defaults are Everyday life, Small surprises, and Sounds.
  Street, Market, and Public square join the existing settings. Old preferences
  remain valid.
- Unless a user selects only nature interests, the prompt asks for at least two
  non-nature missions. A randomly chosen creative lens and higher mission-only
  temperature encourage variety. This is not a guarantee that successive model
  outputs will never resemble each other.
- Public observation can include the general pace of a shared space. Prompts
  prohibit following, identifying, recording, eavesdropping, profiling, or
  inventing strangers' private thoughts. Tasks and follow-up alternatives should
  be outdoors, screen-free, feasible, and safely away from traffic.
- New journals contain cited reflections and exactly three titled follow-up
  choices. Multiple saved notes require at least two reflections; a single thin
  note can have one. Instructions must differ, and all source IDs must exist.
  Reflections permit 60–800 characters and follow-up instructions 60–600.
  Original observations still quote every entire saved note exactly.
- Mission instructions allow up to 450 characters, with a shorter prompt target.
  A live check exposed useful outputs just beyond the previous 300-character
  boundary; the extra space accommodates a concrete action and alternative.
- Markdown exports include the new sections. Existing saved journals still open
  with their original single suggestion; regenerate to obtain the new sections.
- Consent appears directly above the setup card, and remains visible above the
  notes controls when returning or recovering a draft. Refresh still requires
  deliberate consent; it is not silently restored.

## Automatic retries

The backend retries 429, 5xx, connection failures, and unreadable transport
responses within a **45-second total budget**. It waits at least **five seconds**
between attempts, honors a longer `Retry-After`, and shortens the final attempt
to the remaining budget. Individual attempts allow 20 seconds, or 30 seconds for
the longer Gemma journal response. Authentication, credit, and invalid-request
errors stop immediately. Invalid generated JSON or failed grounding validation
does not silently turn into demo content or an invented repair.

The proxy deadline remains 50 seconds and the browser deadline 55 seconds. The
loading message explains the automatic retry window; after failure, the existing
manual Retry action remains available. No origin checks or local rate limits
were disabled. Hosted success cannot be guaranteed by retrying.

## Evidence

- **45 automated tests passed**, including old-history compatibility, exports,
  citations in the new sections, duplicate follow-up rejection, multiple-note
  reflections, and the Ogg/Opus regressions. Both type checks passed.
- Retry tests use an injected clock to verify five-second spacing, recovery,
  persistent-failure bounds, and `Retry-After`; a separate actual timer test
  verifies cancellation. Simulated time is not a measured provider latency.
- The **production build passed**. Next.js 16.4.0 also emitted an installed-version
  security-update warning and initially stopped the command. A subsequent build
  completed. Dependencies were not upgraded as part of this feature change;
  the warning still warrants a security update.
- The **production demo browser workflow passed** desktop/mobile layout, print,
  downloads, original-note links, history/reload, editing/regeneration, deletion,
  and controlled failure/audio cases. This makes no live-inference claim.
- The **voice browser regression passed** the new setup consent placement,
  broader interests, recovered-draft gates, transcript review, recording/stop,
  clip retention/discard after failure, microphone release, permission cases,
  corrupt-storage handling, reflections, three follow-ups, source disclosure,
  and mobile layout. Provider responses in this script were synthetic fixtures;
  no new real Groq transcription was claimed.
- **Real Google Gemma calls with synthetic public-life inputs succeeded.** The
  verified model was `gemma-4-26b-a4b-it`. One final mission card included repairs,
  contrasting signs, and the rhythm of public movement. A two-note journal about
  a repaired bench and a crossing returned two cited reflections and three
  follow-up choices while preserving the exact notes. A separate focused journal
  call also succeeded. Other attempts timed out; successful samples do not
  establish availability, overall accuracy, or universally safe/appropriate prose.

All live inputs were explicitly synthetic. No physical outdoor study, private
conversation capture, deployment, or publication was performed in these checks.
Generated reflections remain suggestions for human review, not verified facts.
