import type { Walk, Journal } from "./schema.js";
// An evidence-count rule for optional comparisons, not semantic verification.
export function comparisonInterpretations(journal: Journal) {
  return journal.interpretations.filter(
    (item) => new Set(item.sourceNoteIds).size >= 2,
  );
}
export function followUpMissions(journal: Journal) {
  return (
    journal.nextMissions ?? [
      { title: "A thread for next time", ...journal.nextMission },
    ]
  );
}
export function missionMarkdown(w: Walk) {
  return `# TrailTape · pocket missions\n\n${w.preferences.duration} minutes · ${w.preferences.setting}\n${w.mode === "demo" ? "SAMPLE / DEMO — no live inference\n" : ""}\n${w.missions.map((m, i) => `## ${i + 1}. ${m.title}\n${m.instruction}`).join("\n\n")}\n\nStay on accessible paths. Observe without disturbing wildlife. Put your phone away.\n`;
}
export function journalMarkdown(w: Walk) {
  if (!w.journal) return missionMarkdown(w);
  const j = w.journal;
  const interpretations = comparisonInterpretations(j);
  return `# ${j.title}\n\n${w.createdAt} · ${w.preferences.setting} · ${w.preferences.duration} minutes\nMode: ${w.mode}; model: ${w.model}\n\n## Your pocket missions\nInvitations, not a completion record.\n\n${w.missions.map((m, i) => `### ${i + 1}. ${m.title}\n${m.instruction}`).join("\n\n")}\n\n## Recorded observations\n${j.observations.map((o) => `- ${o.quote} [${o.sourceNoteIds.join(", ")}]`).join("\n")}${interpretations.length ? `\n\n## Tentative interpretations\n${interpretations.map((o) => `- ${o.text.replace(/^Tentative:\s*/i, "")} (tentative) [${o.sourceNoteIds.join(", ")}]`).join("\n")}` : ""}\n\n${j.reflections?.length ? `## Looking back\n${j.reflections.map((r) => `### ${r.title}\n${r.text} [${r.sourceNoteIds.join(", ")}]`).join("\n\n")}\n\n` : ""}## Next walk - choose one\n${followUpMissions(
    j,
  )
    .map(
      (m, i) =>
        `### ${i + 1}. ${m.title}\n${m.instruction} [${m.sourceNoteIds.join(", ")}]`,
    )
    .join(
      "\n\n",
    )}\n\n## Original notes\n${w.notes.map((n) => `### ${n.id} (${n.kind})\n${n.text}`).join("\n\n")}\n`;
}
