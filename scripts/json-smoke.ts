import "dotenv/config";
import {
  configuration,
  GemmaAdapter,
  ServiceError,
} from "../server/providers.js";

// Live check using synthetic preferences only. Print response-format metadata,
// never provider bodies, private notes, or keys.
const config = configuration();
if (config.mode !== "live")
  throw new Error("This check requires AI_MODE=live.");
const diagnosticFetch: typeof fetch = async (input, init) => {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    const failure = error as { name?: string; cause?: { code?: string } };
    console.log(
      JSON.stringify({
        transportError: failure.name,
        code: failure.cause?.code,
      }),
    );
    throw error;
  }
  const request = JSON.parse(init!.body as string);
  const metadata: Record<string, unknown> = {
    http: response.status,
    requestedJsonMode: request.response_format?.type || "prompt-only",
  };
  if (response.ok) {
    try {
      const envelope = await response.clone().json();
      const choice = envelope.choices?.[0];
      const content = choice?.message?.content;
      metadata.finishReason = choice?.finish_reason;
      metadata.contentLength =
        typeof content === "string" ? content.length : null;
      metadata.hasMarkdownFence =
        typeof content === "string" && content.trim().startsWith("```");
      try {
        JSON.parse(content);
        metadata.rawJsonValid = true;
      } catch {
        metadata.rawJsonValid = false;
      }
    } catch {
      metadata.envelopeReadable = false;
    }
  }
  console.log(JSON.stringify(metadata));
  return response;
};
try {
  const missions = await new GemmaAdapter(config, diagnosticFetch).missions({
    duration: 20,
    setting: "Park",
    interests: ["Birds", "Sounds"],
  });
  console.log(
    JSON.stringify({
      liveMissionsValidated: true,
      count: missions.length,
      model: config.gemmaModel,
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      liveMissionsValidated: false,
      error:
        error instanceof ServiceError
          ? error.message
          : "Unexpected verification failure.",
    }),
  );
  process.exitCode = 1;
}
