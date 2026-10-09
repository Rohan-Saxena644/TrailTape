import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDraftStore,
  readDraftStore,
  updateDraftStore,
} from "../shared/drafts.js";
import type { Walk } from "../shared/schema.js";
const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";
const note = "00000000-0000-4000-8000-000000000003";
const walks = [
  { id: first, notes: [{ id: note }] },
  { id: second, notes: [] },
] as Walk[];

test("drafts stay attached to their own walk and clear independently", () => {
  let store = updateDraftStore(emptyDraftStore(), first, {
    text: "Maybe a bird?",
    kind: "typed",
    editing: note,
  });
  store = updateDraftStore(store, second, {
    text: "A reviewed transcript.",
    kind: "audio",
  });
  const restored = readDraftStore(JSON.stringify(store), walks);
  assert.equal(restored.activeWalkId, second);
  assert.equal(restored.drafts[first].editing, note);
  assert.equal(restored.drafts[second].kind, "audio");
  const cleared = updateDraftStore(restored, second);
  assert.equal(cleared.drafts[second], undefined);
  assert.equal(cleared.activeWalkId, undefined);
  assert.equal(cleared.drafts[first].text, "Maybe a bird?");
});
test("removed walks are excluded and removed notes cannot be resurrected as edits", () => {
  const store = updateDraftStore(emptyDraftStore(), first, {
    text: "Unfinished edit",
    kind: "typed",
    editing: second,
  });
  assert.equal(
    readDraftStore(JSON.stringify(store), walks).drafts[first].editing,
    undefined,
  );
  const removed = readDraftStore(JSON.stringify(store), []);
  assert.deepEqual(removed.drafts, {});
  assert.equal(removed.activeWalkId, undefined);
});
test("corrupt, oversized, or unrelated draft formats are rejected", () => {
  for (const raw of [
    "broken",
    JSON.stringify({ version: 2, drafts: {} }),
    JSON.stringify({
      version: 1,
      drafts: { [first]: { text: "x".repeat(2001), kind: "typed" } },
    }),
    JSON.stringify({
      version: 1,
      drafts: { [first]: { text: "hello", kind: "unknown" } },
    }),
  ]) {
    assert.throws(() => readDraftStore(raw, walks));
  }
});
