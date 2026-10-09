import "dotenv/config";
import {
  configuration,
  GemmaAdapter,
  ServiceError,
} from "../server/providers.js";
const config = configuration();
if (config.mode !== "live")
  throw new Error("This check requires AI_MODE=live.");
// Synthetic observations only; do not print credentials or provider bodies.
const notes = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "typed" as const,
    text: "Synthetic observation: a small yellow bird, maybe. I could not identify it.",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    kind: "audio" as const,
    text: "Synthetic reviewed transcript: I heard a soft rustle, but could not see its source.",
  },
];
try {
  const journal = await new GemmaAdapter(config).journal(
    { duration: 20, setting: "Park", interests: ["Birds", "Sounds"] },
    notes,
  );
  console.log(
    JSON.stringify({
      liveJournalValidated: true,
      model: config.gemmaModel,
      observationCount: journal.observations.length,
      interpretationCount: journal.interpretations.length,
      exactQuotes: true,
      sourceReferencesValidated: true,
      input: "synthetic",
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      liveJournalValidated: false,
      error:
        error instanceof ServiceError
          ? error.message
          : "Unexpected verification failure.",
    }),
  );
  process.exitCode = 1;
}
