import "dotenv/config";
import { readFile } from "node:fs/promises";
import { notesSchema, preferencesSchema } from "../shared/schema.js";
import { configuration, GemmaAdapter } from "../server/providers.js";
const config = configuration();
if (config.mode !== "live" || !config.gemmaKey)
  throw new Error(
    "Evaluation requires AI_MODE=live and GEMMA_API_KEY in your local .env.",
  );
const set = JSON.parse(
  await readFile(new URL("../docs/evaluation.json", import.meta.url), "utf8"),
);
const adapter = new GemmaAdapter(config);
for (const item of set.cases) {
  const start = performance.now();
  try {
    const result = await adapter.journal(
      preferencesSchema.parse(set.preferences),
      notesSchema.parse(item.notes),
    );
    console.log(
      JSON.stringify({
        case: item.name,
        model: config.gemmaModel,
        elapsedMs: Math.round(performance.now() - start),
        structuralValidation: "pass",
        manualReviewRequired: true,
        expected: item.expect,
        result,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        case: item.name,
        model: config.gemmaModel,
        elapsedMs: Math.round(performance.now() - start),
        structuralValidation: "fail",
        error: error instanceof Error ? error.message : "Request failed",
      }),
    );
  }
}
