// Synthetic model-output fields shared by grounding and JSON-format tests.
export function journalExtras(ids: string[]) {
  return {
    reflections: ids.map((id, i) => ({
      title: `Recorded detail ${i + 1}`,
      text: "This synthetic reflection refers only to the supplied observation and preserves its uncertainty.",
      sourceNoteIds: [id],
    })),
    nextMissions: Array.from({ length: 3 }, (_, i) => ({
      title: `Synthetic invitation ${i + 1}`,
      instruction: `If accessible, compare detail ${i + 1} with another ordinary object for three breaths. If absent, observe a nearby public surface.`,
      sourceNoteIds: [ids[i % ids.length]],
    })),
  };
}
