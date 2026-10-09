"use client";
import { useEffect, useRef, useState } from "react";
import {
  walkSchema,
  validateJournal,
  missionsSchema,
  type Walk,
  type Preferences,
  type Note,
} from "../shared/schema";
import { journalMarkdown, missionMarkdown } from "../shared/export";
const STORAGE = "trailtape.walks.v1";
type Status = {
  mode: "live" | "demo";
  model: string;
  gemmaReady: boolean;
  audioReady: boolean;
};
type View = "prepare" | "missions" | "notes" | "journal" | "history";
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/markdown;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: body ? "POST" : "GET",
    headers:
      body instanceof FormData
        ? undefined
        : body
          ? { "Content-Type": "application/json" }
          : undefined,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(55000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Request failed. Please retry.");
  return data;
}
export default function Home() {
  const [view, setView] = useState<View>("prepare");
  const [preferences, setPreferences] = useState<Preferences>({
    duration: 20,
    setting: "Park",
    interests: ["Birds", "Sounds"],
  });
  const [status, setStatus] = useState<Status>();
  const [walk, setWalk] = useState<Walk>();
  const [history, setHistory] = useState<Walk[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [retry, setRetry] = useState<() => void>();
  const [draft, setDraft] = useState("");
  const [draftKind, setDraftKind] = useState<Note["kind"]>("typed");
  const [editing, setEditing] = useState<string>();
  const [consent, setConsent] = useState(false);
  const [deleteId, setDeleteId] = useState<string>();
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const taskRef = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const value: unknown = JSON.parse(raw);
        if (!Array.isArray(value) || value.length > 100) throw new Error();
        const parsed = value.map((w) => walkSchema.parse(w));
        for (const w of parsed)
          if (w.journal) validateJournal(w.journal, w.notes);
        setHistory(parsed);
      }
    } catch {
      setStorageError(
        "Saved history could not be read. Existing browser data has been left untouched. Export current work before closing.",
      );
    }
    setLoaded(true);
    void loadStatus();
  }, []);
  useEffect(() => {
    headingRef.current?.focus();
  }, [view]);
  async function loadStatus() {
    try {
      setStatus(await request<Status>("status"));
      setError("");
    } catch {
      setError("Cannot reach the backend. Start both services, then retry.");
      setRetry(() => () => void loadStatus());
    }
  }
  function clearFailure() {
    setError("");
    setRetry(undefined);
  }
  function persist(next: Walk[]) {
    setHistory(next);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. Export your journal; changes are held only in this tab.",
      );
    }
  }
  function save(w: Walk) {
    setWalk(w);
    if (loaded)
      persist([w, ...history.filter((x) => x.id !== w.id)].slice(0, 100));
  }
  async function run(label: string, operation: () => Promise<void>) {
    if (taskRef.current) return;
    taskRef.current = true;
    setBusy(label);
    setError("");
    setRetry(undefined);
    try {
      await operation();
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "TimeoutError"
          ? e.message
          : "The request timed out. Your notes remain here. Please retry.",
      );
      setRetry(() => () => void run(label, operation));
    } finally {
      taskRef.current = false;
      setBusy("");
    }
  }
  function toggleInterest(value: Preferences["interests"][number]) {
    clearFailure();
    setPreferences((p) => ({
      ...p,
      interests: p.interests.includes(value)
        ? p.interests.filter((x) => x !== value)
        : [...p.interests, value],
    }));
  }
  function generateMissions() {
    void run("Preparing your pocket missions…", async () => {
      const result = await request<{
        missions: Walk["missions"];
        mode: Walk["mode"];
        model: string;
      }>("missions", preferences);
      const w: Walk = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        preferences,
        missions: missionsSchema.parse({ missions: result.missions }).missions,
        notes: [],
        mode: result.mode,
        model: result.model,
      };
      save(w);
      setView("missions");
    });
  }
  function addNote() {
    if (!walk || !draft.trim()) return;
    clearFailure();
    const notes = editing
      ? walk.notes.map((n) =>
          n.id === editing ? { ...n, text: draft.trim() } : n,
        )
      : [
          ...walk.notes,
          { id: crypto.randomUUID(), text: draft.trim(), kind: draftKind },
        ];
    save({ ...walk, notes, journal: undefined });
    setDraft("");
    setEditing(undefined);
    setDraftKind("typed");
    setNotice("Observation saved locally.");
  }
  function createJournal() {
    if (!walk) return;
    void run("Turning your notes into a field journal…", async () => {
      const result = await request<{
        journal: unknown;
        mode: Walk["mode"];
        model: string;
      }>("journal", { preferences: walk.preferences, notes: walk.notes });
      save({
        ...walk,
        journal: validateJournal(result.journal, walk.notes),
        mode: result.mode,
        model: result.model,
      });
      setView("journal");
    });
  }
  function upload(file: File) {
    if (draft.trim()) {
      setError("Save or clear your current note before importing audio.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Choose a recording under 10 MB.");
      return;
    }
    void run("Listening to your recording…", async () => {
      const body = new FormData();
      body.append("audio", file);
      const result = await request<{ text: string }>("transcribe", body);
      setDraft(result.text);
      setDraftKind("audio");
      setEditing(undefined);
      setNotice(
        "Transcript ready. Correct it below, then save it as an observation.",
      );
    });
  }
  function openWalk(w: Walk) {
    setWalk(w);
    setPreferences(w.preferences);
    setDraft("");
    setEditing(undefined);
    setView(w.journal ? "journal" : w.notes.length ? "notes" : "missions");
    setError("");
  }
  function changeView(v: View) {
    if (busy) return;
    setView(v);
    clearFailure();
    setNotice("");
  }
  const canSend = status?.mode === "demo" || consent;
  const references = (ids: string[]) => (
    <div className="references">
      {ids.map((id) => (
        <a key={id} href={`#note-${id}`}>
          Note {(walk?.notes.findIndex((n) => n.id === id) ?? 0) + 1}
        </a>
      ))}
    </div>
  );
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="TrailTape home">
          <span className="brand-icon" aria-hidden="true">
            ⌁
          </span>{" "}
          TrailTape<span className="brand-sub">THE EVERYDAY FIELD JOURNAL</span>
        </a>
        <nav aria-label="Main">
          <button
            className={view === "history" ? "nav active" : "nav"}
            onClick={() => changeView("history")}
            disabled={!!busy}
          >
            My walks <span className="count">{history.length}</span>
          </button>
          <button
            className="nav"
            disabled={!!busy}
            onClick={() => changeView("prepare")}
          >
            New walk <span aria-hidden="true">↗</span>
          </button>
        </nav>
      </header>
      <main>
        <div className="statusline">
          <span>
            <span className="dot" /> A LITTLE OUTSIDE. A LITTLE MORE NOTICED.
          </span>
          <span>
            {status?.mode === "demo"
              ? "DEMO · SAMPLE OUTPUT"
              : status
                ? "HOSTED GEMMA · ONLINE"
                : "CONNECTING…"}
          </span>
        </div>
        {status?.mode === "demo" && (
          <div className="demo-banner">
            Sample mode is on. Missions and journals use a deterministic demo
            adapter; no live Gemma or audio inference.
          </div>
        )}
        {storageError && (
          <p className="alert" role="alert">
            {storageError}
          </p>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}{" "}
            {retry && (
              <button disabled={!!busy} onClick={retry}>
                Retry
              </button>
            )}
          </div>
        )}
        {busy && (
          <p className="loading" role="status">
            <span className="spinner" />
            {busy}
          </p>
        )}
        <div className="sr-only" role="status">
          {notice}
        </div>
        {view !== "history" && (
          <div className="steps" aria-label="Walk stages">
            <button
              onClick={() => changeView("prepare")}
              disabled={!!busy}
              aria-current={view === "prepare" ? "step" : undefined}
            >
              01 <span>Make room</span>
            </button>
            <span>—</span>
            <button
              onClick={() => changeView("missions")}
              disabled={!walk || !!busy}
              aria-current={view === "missions" ? "step" : undefined}
            >
              02 <span>Go notice</span>
            </button>
            <span>—</span>
            <button
              onClick={() => changeView("notes")}
              disabled={!walk || !!busy}
              aria-current={
                view === "notes" || view === "journal" ? "step" : undefined
              }
            >
              03 <span>Bring it back</span>
            </button>
          </div>
        )}
        {view === "prepare" && (
          <div className="prepare-grid">
            <section>
              <p className="eyebrow">YOUR NEXT SMALL ADVENTURE</p>
              <h1 ref={headingRef} tabIndex={-1}>
                Step outside.
                <br />
                Come back with
                <br />
                <em>a story.</em>
              </h1>
              <p className="intro">
                You don’t need a mountain or a whole afternoon. Just a short
                walk, three things to notice, and a little curiosity.
              </p>
              <div
                className="landscape"
                role="img"
                aria-label="An illustrated sun over rolling green hills"
              >
                <div className="sun" />
                <div className="hill far" />
                <div className="hill near" />
                <div className="trail" />
                <span className="landscape-caption">
                  SLOW DOWN. THERE’S SOMETHING HERE.
                </span>
              </div>
              <p className="side-note">
                No route to follow. No streak to keep.
                <br />
                Just pay attention to what’s around you.
              </p>
            </section>
            <section className="panel preferences">
              <div className="panel-heading">
                <span className="eyebrow">BEFORE YOUR WALK</span>
                <span aria-hidden="true">↗</span>
              </div>
              <h2>Make a little room.</h2>
              <p className="muted">
                We’ll make three pocket-sized missions for your walk.
              </p>
              <fieldset disabled={!!busy}>
                <legend>How much time do you have?</legend>
                <div className="choices durations">
                  {([10, 20, 30] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={preferences.duration === d}
                      className={
                        preferences.duration === d
                          ? "choice selected"
                          : "choice"
                      }
                      onClick={() => {
                        clearFailure();
                        setPreferences({ ...preferences, duration: d });
                      }}
                    >
                      {d}
                      <small>minutes</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="field-label" htmlFor="setting">
                Where are you heading?
              </label>
              <select
                id="setting"
                disabled={!!busy}
                value={preferences.setting}
                onChange={(e) => {
                  clearFailure();
                  setPreferences({
                    ...preferences,
                    setting: e.target.value as Preferences["setting"],
                  });
                }}
              >
                {["Park", "Campus", "Neighborhood", "Garden"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <fieldset disabled={!!busy}>
                <legend>What catches your curiosity?</legend>
                <div className="choices interests">
                  {(
                    ["Birds", "Trees", "Sounds", "Textures", "Light"] as const
                  ).map((s, i) => (
                    <button
                      type="button"
                      key={s}
                      className={
                        preferences.interests.includes(s)
                          ? "chip selected"
                          : "chip"
                      }
                      aria-pressed={preferences.interests.includes(s)}
                      onClick={() => toggleInterest(s)}
                    >
                      <span aria-hidden="true">
                        {["⌁", "♧", "≋", "▧", "☀"][i]}
                      </span>{" "}
                      {s}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="hint">Pick at least one. No expertise needed.</p>
              <button
                className="primary wide"
                disabled={
                  !!busy ||
                  !status?.gemmaReady ||
                  !preferences.interests.length ||
                  !canSend
                }
                onClick={generateMissions}
              >
                Make my mission card <span aria-hidden="true">→</span>
              </button>
              {status && !status.gemmaReady && (
                <p className="hint">
                  Live Gemma needs a backend API key. See README for setup.
                </p>
              )}
              <p className="screen-note">A minute here. The rest out there.</p>
            </section>
          </div>
        )}
        {view === "missions" && walk && (
          <section className="stage">
            <p className="eyebrow">
              BEFORE YOUR WALK · {walk.preferences.duration} MINUTES ·{" "}
              {walk.preferences.setting.toUpperCase()}
            </p>
            <h1 ref={headingRef} tabIndex={-1}>
              Pocket this.
              <br />
              <em>Then look up.</em>
            </h1>
            <p className="intro">
              Save or print your card. Put the phone away and take these three
              small invitations with you.
            </p>
            <article className="mission-card">
              <div className="card-title">
                <span>TrailTape / field card</span>
                <span>
                  {walk.mode === "demo" ? "SAMPLE" : "GEMMA MISSIONS"}
                </span>
              </div>
              {walk.missions.map((m, i) => (
                <div className="mission" key={i}>
                  <span className="mission-number">0{i + 1}</span>
                  <div>
                    <h2>{m.title}</h2>
                    <p>{m.instruction}</p>
                  </div>
                </div>
              ))}
              <p className="card-footer">
                Stay on accessible paths. Observe without disturbing wildlife.
                No need to complete every mission.
              </p>
            </article>
            <div className="actions">
              <button className="secondary" onClick={() => window.print()}>
                Print / save PDF
              </button>
              <button
                className="secondary"
                onClick={() =>
                  download(missionMarkdown(walk), "trailtape-missions.md")
                }
              >
                Save card as Markdown
              </button>
              <button className="primary" onClick={() => changeView("notes")}>
                I’m back · add observations →
              </button>
            </div>
          </section>
        )}
        {view === "notes" && walk && (
          <section className="stage">
            <p className="eyebrow">AFTER YOUR WALK</p>
            <h1 ref={headingRef} tabIndex={-1}>
              What stayed
              <br />
              <em>with you?</em>
            </h1>
            <p className="intro">
              A color, a sound, something you couldn’t name. Your own words are
              enough.
            </p>
            <div className="notebook-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>{editing ? "Edit observation" : "Add an observation"}</h2>
                  <span>{walk.notes.length}/20</span>
                </div>
                <label className="field-label" htmlFor="observation">
                  {draftKind === "audio"
                    ? "Correct your transcript before saving"
                    : "What did you notice?"}
                </label>
                <textarea
                  id="observation"
                  placeholder="A small yellow bird hopped between two branches. I couldn’t tell what kind."
                  maxLength={2000}
                  rows={6}
                  value={draft}
                  disabled={!!busy}
                  onChange={(e) => {
                    clearFailure();
                    setDraft(e.target.value);
                  }}
                />
                <p className="hint">
                  {draft.length}/2,000 characters · Keep uncertainty in your
                  words.
                </p>
                <div className="actions">
                  <button
                    className="primary"
                    disabled={
                      !!busy ||
                      !draft.trim() ||
                      (!editing && walk.notes.length >= 20)
                    }
                    onClick={addNote}
                  >
                    {editing ? "Save changes" : "Save observation"} +
                  </button>
                  {draft && (
                    <button
                      className="secondary"
                      disabled={!!busy}
                      onClick={() => {
                        setDraft("");
                        setEditing(undefined);
                        setDraftKind("typed");
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="audio-area">
                  <span className="eyebrow">HAVE A VOICE NOTE?</span>
                  <p>Import a short recording, then review the transcript.</p>
                  <input
                    ref={fileRef}
                    type="file"
                    className="sr-only"
                    accept=".wav,.mp3,.m4a,.mp4,.ogg,.webm,.flac"
                    aria-label="Import audio recording"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    className="secondary"
                    disabled={!!busy || !status?.audioReady || !canSend}
                    onClick={() => fileRef.current?.click()}
                  >
                    ↑ Import audio
                  </button>
                  <p className="hint">
                    WAV, MP3, M4A, MP4, OGG, WebM, FLAC · up to 10 MB.{" "}
                    {!status?.audioReady &&
                      "Transcription needs a live backend key; typed notes work independently."}
                  </p>
                </div>
              </section>
              <section>
                <h2 className="notes-title">
                  Your field notes <span>{walk.notes.length}</span>
                </h2>
                {walk.notes.length === 0 ? (
                  <div className="empty">
                    <span aria-hidden="true">♧</span>
                    <h3>A blank page is a good beginning.</h3>
                    <p>Add one observation to start your journal.</p>
                  </div>
                ) : (
                  walk.notes.map((n, i) => (
                    <article className="note" key={n.id}>
                      <p className="eyebrow">
                        NOTE {i + 1} ·{" "}
                        {n.kind === "audio" ? "REVIEWED TRANSCRIPT" : "TYPED"}
                      </p>
                      <p className="note-text">{n.text}</p>
                      <div className="actions">
                        <button
                          className="text-button"
                          disabled={!!busy}
                          onClick={() => {
                            setDraft(n.text);
                            setEditing(n.id);
                            setDraftKind(n.kind);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-button"
                          disabled={!!busy}
                          onClick={() =>
                            save({
                              ...walk,
                              notes: walk.notes.filter((x) => x.id !== n.id),
                              journal: undefined,
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))
                )}
                <button
                  className="primary wide"
                  disabled={
                    !!busy ||
                    !walk.notes.length ||
                    !canSend ||
                    !status?.gemmaReady ||
                    !!draft.trim()
                  }
                  onClick={createJournal}
                >
                  Create my field journal →
                </button>
                {draft.trim() && (
                  <p className="hint">
                    Save or clear the draft before creating your journal.
                  </p>
                )}
              </section>
            </div>
          </section>
        )}
        {view === "journal" && walk?.journal && (
          <section className="stage journal">
            <p className="eyebrow">
              YOUR FIELD JOURNAL ·{" "}
              {new Date(walk.createdAt).toLocaleDateString()}
            </p>
            <h1 ref={headingRef} tabIndex={-1}>
              {walk.journal.title}
            </h1>
            <p className="intro">
              {walk.preferences.duration} minutes in the{" "}
              {walk.preferences.setting.toLowerCase()}. Kept in your words,
              grounded in your notes.
            </p>
            <div className="actions">
              <button
                className="primary"
                onClick={() =>
                  download(journalMarkdown(walk), "trailtape-journal.md")
                }
              >
                ↓ Export Markdown
              </button>
              <button className="secondary" onClick={() => changeView("notes")}>
                Edit observations
              </button>
              <button
                className="secondary"
                onClick={() => changeView("prepare")}
              >
                Plan another walk ↗
              </button>
            </div>
            <section className="panel journal-paper">
              <p className="eyebrow">
                RECORDED OBSERVATIONS · EXACT SOURCE EXCERPTS
              </p>
              {walk.journal.observations.map((o, i) => (
                <blockquote key={i}>
                  <p>{o.quote}</p>
                  {references(o.sourceNoteIds)}
                </blockquote>
              ))}
              <h2>Tentative interpretations</h2>
              <p className="hint">
                Generated suggestions, not verified facts or species
                identifications.
              </p>
              {walk.journal.interpretations.length ? (
                walk.journal.interpretations.map((o, i) => (
                  <div key={i}>
                    <p>{o.text}</p>
                    {references(o.sourceNoteIds)}
                  </div>
                ))
              ) : (
                <p className="muted">
                  No interpretations added. Your observations stand on their
                  own.
                </p>
              )}
              <div className="next-mission">
                <p className="eyebrow">A THREAD FOR NEXT TIME</p>
                <h2>Keep your curiosity going.</h2>
                <p>{walk.journal.nextMission.instruction}</p>
                {references(walk.journal.nextMission.sourceNoteIds)}
              </div>
            </section>
            <h2>Original notes</h2>
            <p className="hint">
              Check the sources. The journal does not verify what was observed.
            </p>
            {walk.notes.map((n, i) => (
              <article id={`note-${n.id}`} key={n.id} className="note source">
                <p className="eyebrow">
                  NOTE {i + 1} · {n.kind}
                </p>
                <p className="note-text">{n.text}</p>
                <small className="note-id">{n.id}</small>
              </article>
            ))}
            <p className="hint">
              {walk.mode === "demo"
                ? "SAMPLE / DEMO — no live inference"
                : `Generated with ${walk.model} via hosted inference`}
            </p>
          </section>
        )}
        {view === "history" && (
          <section className="stage">
            <p className="eyebrow">SAVED IN THIS BROWSER</p>
            <h1 ref={headingRef} tabIndex={-1}>
              Little walks.
              <br />
              <em>Things remembered.</em>
            </h1>
            <p className="intro">
              Your field cards, notes, and journals. No account needed. Export
              anything you want to keep beyond this browser.
            </p>
            {history.length === 0 ? (
              <div className="empty">
                <h2>Your first page is waiting.</h2>
                <p>A short walk can be the beginning.</p>
                <button
                  className="primary"
                  onClick={() => changeView("prepare")}
                >
                  Plan a walk →
                </button>
              </div>
            ) : (
              <div className="history-grid">
                {history.map((w) => (
                  <article className="panel history-card" key={w.id}>
                    <p className="eyebrow">
                      {w.mode === "demo" ? "SAMPLE · " : ""}
                      {new Date(w.createdAt).toLocaleDateString()} ·{" "}
                      {w.preferences.duration} MIN
                    </p>
                    <h2>
                      {w.journal?.title ||
                        `${w.preferences.setting} observation walk`}
                    </h2>
                    <p className="muted">
                      {w.notes.length} notes ·{" "}
                      {w.journal ? "Journal ready" : "Walk in progress"}
                    </p>
                    <div className="actions">
                      <button className="primary" onClick={() => openWalk(w)}>
                        Open →
                      </button>
                      <button
                        className="text-button"
                        onClick={() =>
                          download(journalMarkdown(w), "trailtape-walk.md")
                        }
                      >
                        Export
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setDeleteId(w.id)}
                      >
                        Delete
                      </button>
                    </div>
                    {deleteId === w.id && (
                      <div className="delete-confirm">
                        <p>Delete this walk and its notes from this browser?</p>
                        <button
                          className="secondary"
                          onClick={() => {
                            persist(history.filter((x) => x.id !== w.id));
                            if (walk?.id === w.id) setWalk(undefined);
                            setDeleteId(undefined);
                          }}
                        >
                          Delete walk
                        </button>
                        <button
                          className="text-button"
                          onClick={() => setDeleteId(undefined)}
                        >
                          Keep it
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        <section className="privacy">
          <div>
            <span className="eyebrow">A NOTE ON YOUR NOTES</span>
            <p>
              History stays in this browser. In live mode, preferences and saved
              notes go to OpenRouter and its inference provider; imported audio
              goes to Groq. Hosted inference requires internet and is not fully
              private. Avoid sensitive details.
            </p>
          </div>
          {status?.mode !== "demo" && (
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />{" "}
              I agree to send this data for hosted inference and to the{" "}
              <a
                href="https://ai.google.dev/gemma/terms"
                target="_blank"
                rel="noreferrer"
              >
                Gemma terms
              </a>{" "}
              and{" "}
              <a
                href="https://ai.google.dev/gemma/prohibited_use_policy"
                target="_blank"
                rel="noreferrer"
              >
                use restrictions
              </a>
              .
            </label>
          )}
        </section>
      </main>
      <footer>
        <span>
          TrailTape <span aria-hidden="true">⌁</span>
        </span>
        <span>Made for noticing, not scrolling.</span>
        <a
          href="https://ai.google.dev/gemma/terms"
          target="_blank"
          rel="noreferrer"
        >
          Gemma terms
        </a>
      </footer>
    </>
  );
}
