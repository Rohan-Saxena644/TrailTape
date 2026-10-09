import { z } from "zod";
import type { Note, Walk } from "./schema.js";

export const DRAFT_STORAGE = "trailtape.drafts.v1";
const draftSchema = z
  .object({
    text: z.string().max(2000),
    kind: z.enum(["typed", "audio"]),
    editing: z.string().uuid().optional(),
  })
  .strict();
const storeSchema = z
  .object({
    version: z.literal(1),
    activeWalkId: z.string().uuid().optional(),
    drafts: z.record(z.string().uuid(), draftSchema),
  })
  .strict()
  .refine((store) => Object.keys(store.drafts).length <= 100);
export type NoteDraft = { text: string; kind: Note["kind"]; editing?: string };
export type DraftStore = z.infer<typeof storeSchema>;
export const emptyDraftStore = (): DraftStore => ({ version: 1, drafts: {} });

export function readDraftStore(raw: string | null, walks: Walk[]): DraftStore {
  const store = raw ? storeSchema.parse(JSON.parse(raw)) : emptyDraftStore();
  const byId = new Map(walks.map((w) => [w.id, w]));
  const drafts: DraftStore["drafts"] = {};
  for (const [id, draft] of Object.entries(store.drafts)) {
    const walk = byId.get(id);
    if (!walk || !draft.text) continue;
    // A removed observation must never be silently resurrected as an edit.
    drafts[id] = {
      ...draft,
      editing: walk.notes.some((n) => n.id === draft.editing)
        ? draft.editing
        : undefined,
    };
  }
  return {
    version: 1,
    drafts,
    activeWalkId:
      store.activeWalkId && drafts[store.activeWalkId]
        ? store.activeWalkId
        : undefined,
  };
}

export function updateDraftStore(
  store: DraftStore,
  walkId: string,
  draft?: NoteDraft,
): DraftStore {
  const drafts = { ...store.drafts };
  if (draft?.text) drafts[walkId] = draft;
  else delete drafts[walkId];
  return {
    version: 1,
    drafts,
    activeWalkId: draft?.text
      ? walkId
      : store.activeWalkId === walkId
        ? undefined
        : store.activeWalkId,
  };
}
