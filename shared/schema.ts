import { z } from "zod";
export const settings = [
  "Park",
  "Campus",
  "Neighborhood",
  "Garden",
  "Street",
  "Market",
  "Public square",
] as const;
export const interests = [
  "Everyday life",
  "People & routines",
  "Buildings & objects",
  "Small surprises",
  "Sounds",
  "Textures",
  "Light",
  "Birds",
  "Trees",
] as const;
export const preferencesSchema = z
  .object({
    duration: z.union([z.literal(10), z.literal(20), z.literal(30)]),
    setting: z.enum(settings),
    interests: z.array(z.enum(interests)).min(1).max(interests.length),
  })
  .strict();
export const noteSchema = z
  .object({
    id: z.string().uuid(),
    text: z.string().trim().min(1).max(2000),
    kind: z.enum(["typed", "audio"]),
  })
  .strict();
export const notesSchema = z
  .array(noteSchema)
  .min(1)
  .max(20)
  .refine(
    (n) => new Set(n.map((x) => x.id)).size === n.length,
    "Note IDs must be unique",
  );
const short = z.string().trim().min(1).max(300);
export const missionsSchema = z
  .object({
    missions: z
      .array(
        z
          .object({
            title: z.string().min(1).max(70),
            instruction: z.string().trim().min(1).max(450),
          })
          .strict(),
      )
      .length(3),
  })
  .strict();
const refs = z.array(z.string().uuid()).min(1).max(20);
const reflectionSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    text: z.string().trim().min(60).max(800),
    sourceNoteIds: refs,
  })
  .strict();
const followUpSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    instruction: z.string().trim().min(60).max(600),
    sourceNoteIds: refs,
  })
  .strict();
export const journalSchema = z
  .object({
    title: z.string().min(1).max(100),
    observations: z
      .array(
        z
          .object({
            sourceNoteIds: z.array(z.string().uuid()).length(1),
            quote: z.string().min(1).max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    interpretations: z
      .array(
        z
          .object({
            sourceNoteIds: refs,
            tentative: z.literal(true),
            text: short,
          })
          .strict(),
      )
      .max(5),
    // Optional additions keep existing browser history readable.
    reflections: z.array(reflectionSchema).min(1).max(4).optional(),
    nextMissions: z
      .array(followUpSchema)
      .length(3)
      .refine(
        (missions) =>
          new Set(
            missions.map((m) =>
              m.instruction.trim().toLowerCase().replace(/\s+/g, " "),
            ),
          ).size === 3,
        "Follow-up choices must have different instructions",
      )
      .optional(),
    nextMission: z
      .object({
        sourceNoteIds: refs,
        instruction: z.string().trim().min(1).max(600),
      })
      .strict(),
  })
  .strict();
export type Preferences = z.infer<typeof preferencesSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Missions = z.infer<typeof missionsSchema>["missions"];
export type Journal = z.infer<typeof journalSchema>;
export type Walk = {
  id: string;
  createdAt: string;
  preferences: Preferences;
  missions: Missions;
  notes: Note[];
  journal?: Journal;
  mode: "live" | "demo";
  model: string;
};
export const walkSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  preferences: preferencesSchema,
  missions: missionsSchema.shape.missions,
  notes: z.array(noteSchema).max(20),
  journal: journalSchema.optional(),
  mode: z.enum(["live", "demo"]),
  model: z.string().max(100),
});
export function validateJournal(value: unknown, notes: Note[]): Journal {
  const journal = journalSchema.parse(value);
  const byId = new Map(notes.map((n) => [n.id, n]));
  for (const item of [
    ...journal.observations,
    ...journal.interpretations,
    ...(journal.reflections ?? []),
    ...(journal.nextMissions ?? []),
    journal.nextMission,
  ]) {
    if (item.sourceNoteIds.some((id) => !byId.has(id)))
      throw new Error("Journal references an unknown source note.");
  }
  // Recorded observations are exact source excerpts, never model-written identifications.
  for (const item of journal.observations) {
    if (byId.get(item.sourceNoteIds[0])!.text !== item.quote)
      throw new Error("Observation must quote an entire source note exactly.");
  }
  if (
    notes.some(
      (n) => !journal.observations.some((o) => o.sourceNoteIds.includes(n.id)),
    )
  )
    throw new Error("Journal must include every source note.");
  return journal;
}
