# Reproducible sample walkthrough

These are synthetic notes and deterministic demo output. They are not a real
walk, user study, live inference result, or accuracy measurement.

1. Copy `.env.example` to `.env`. Set `AI_MODE=demo`. No keys are needed.
2. Run `npm install` and `npm run dev`; open http://localhost:3000.
3. Keep 20 minutes, Park, Birds and Sounds. Generate the card. Confirm the
   sample-mode banner. Demo missions are deliberately fixed, not personalized.
4. Print/save PDF or download the Markdown field card. The card has three
   missions, conditional alternatives, and no need to look at a screen outside.
5. Click "I'm back" and save these two notes separately:
   - "A small yellow bird hopped between two branches. I couldn't tell what kind."
   - "I heard a soft rustle near the path, but I couldn't see what made it."
6. Create a journal. Each recorded observation quotes a whole note exactly.
   Follow the source links and check the original notes. Demo mode adds no
   interpretations; its next mission refers to the first observation.
7. Export Markdown. Confirm `Mode: demo; model: sample-adapter`, full source IDs,
   and original notes are present. Reload, open My walks, and reopen the journal.
8. Edit a note. The earlier journal is invalidated; regenerate to match the
   current sources. Delete the sample walk through its confirmation control.

Audio is intentionally unavailable in demo mode. The mock HTTP audio adapter
is exercised by the focused tests; it must not be portrayed as live Whisper.
