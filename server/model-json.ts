// Accept a JSON document, optionally wrapped in one Markdown code block.
// Never extract JSON from prose, repair syntax, or reconstruct truncated output.
export function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  const fence = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
  return JSON.parse(fence ? fence[1] : trimmed);
}
