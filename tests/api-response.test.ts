import { test } from "node:test";
import assert from "node:assert/strict";
import { readApiResponse } from "../shared/api-response.js";

test("proxy text and HTML failures show a connection error without leaking the body", async () => {
  for (const body of [
    "Internal Server Error",
    "<html>private upstream details</html>",
  ]) {
    await assert.rejects(
      readApiResponse(new Response(body, { status: 500 })),
      (error: Error) => {
        assert.match(error.message, /API connection failed/);
        assert.doesNotMatch(
          error.message,
          /Unexpected token|private upstream|Internal Server Error/,
        );
        return true;
      },
    );
  }
});

test("preserves JSON API errors and successful data", async () => {
  await assert.rejects(
    readApiResponse(
      Response.json(
        { error: "Provider is busy or rate limited." },
        { status: 502 },
      ),
    ),
    /Provider is busy or rate limited/,
  );
  await assert.rejects(
    readApiResponse(Response.json(null, { status: 500 })),
    /Request failed/,
  );
  assert.deepEqual(await readApiResponse(Response.json({ missions: [] })), {
    missions: [],
  });
});
