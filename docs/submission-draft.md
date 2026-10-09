---
title: "TrailTape: three pocket missions, one small walk, a grounded field journal"
published: false
tags: devchallenge, hf26challenge
---

_This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)_

## What I Built

TrailTape turns a short observation walk into a field journal. It is for people
who want to notice the world without turning their walk into another app session.
Choose a duration, a general setting, and a few interests. Gemma prepares three
short missions; print or save the card, put the phone away, and go outside.

Afterward, write what you noticed or import a short voice note and correct its
transcript. The journal keeps recorded observations in your exact words, links
them to original notes, separates tentative interpretations, and gives you one
specific thing to notice next time. History stays in your browser and exports
as Markdown.

[Replace with actual outdoor-test story: where you went in general terms,
what you noticed, how little screen time you needed, and what surprised you.
Include evidence and real measurements. The synthetic walkthrough is not evidence.]

## Demo

[Add a recording or deployed URL after testing. State live/demo mode clearly.]

## Code

[Add the public repository URL. The workspace initially had no Git repository;
create one and publish the code yourself before submitting.]

## How I Built It

The interface uses Next.js and TypeScript, with Express handling provider calls.
Gemma 3 27B Instruct (`google/gemma-3-27b-it`) is accessed through OpenRouter's
hosted API. An independent adapter uses Groq's `whisper-large-v3-turbo` for audio.
Both credentials stay on the backend. There is no database or login.

Grounding is an application rule, not just a prompt: notes get stable IDs; Zod
validates output; unknown IDs and altered recorded observations are rejected.
Every recorded observation must quote an entire note exactly. The application
treats notes as untrusted data and exposes no tools to the model. It still cannot
prove a tentative interpretation is true or guarantee resistance to every
prompt injection. Those are review tasks, not claims hidden behind citations.

[Add live evaluation results, exact model/provider used, sample count, validation
failures, human-reviewed unsupported claims, and measured latency. Nothing has
been measured with the real models yet. Explain any changes following tests.]

## Why Does Open Innovation Matter?

For this tool, the AI's role is small and explicit: suggest observations and help
organize a journal without pretending to know more than the walker. Gemma's
published weights make that role inspectable and portable beyond a single
proprietary model API. The prompts, validation rules, evaluation inputs, and
provider adapter are open in the repository. Someone can audit the failure
cases, change the behavior, and serve the same Gemma weights elsewhere without
redesigning the product. Availability of weights also leaves a future path to
fine-tuning on consented field-journal examples; this version does not fine-tune.

Hosted access makes this first version practical without requiring a model
installation. It also gives up the privacy and offline benefits of on-device
inference. Local history does not make the AI local: notes go to OpenRouter and
its inference provider, and audio goes to Groq. I use the term open-weight for
Gemma; its terms and use restrictions are separate from the app's MIT license.

[Add one observed benefit or tradeoff from actual use; do not claim lower cost,
better accuracy, offline operation, or superior privacy without evidence.]

## My Agent Session

[Optional: add a reviewed, redacted session link. Remove this section if unused.]

## Prize Categories

[After successful live integration: Best Use of Gemma, with actual model evidence.
Add Best Use of Render only after meaningful deployment/use on Render.
Configuration alone is not a category claim. Verify eligibility before publishing.]

[If this is a team submission, list real teammates' DEV handles. Remove unused
placeholders before publishing.]
