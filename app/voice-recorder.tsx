"use client";
import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 90;
const MAX_BYTES = 10 * 1024 * 1024;
export default function VoiceRecorder({
  disabled,
  onTranscribe,
  onLockChange,
}: {
  disabled: boolean;
  onTranscribe: (file: File) => Promise<boolean>;
  onLockChange: (locked: boolean) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<
    "idle" | "permission" | "recording" | "preview"
  >("idle");
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<File>();
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | undefined>(undefined);
  const stream = useRef<MediaStream | undefined>(undefined);
  const mounted = useRef(false);
  const active = useRef(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const onLock = useRef(onLockChange);
  onLock.current = onLockChange;
  const releaseMic = () => {
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = undefined;
  };
  useEffect(() => {
    mounted.current = true;
    setSupported(
      !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    );
    return () => {
      mounted.current = false;
      active.current = false;
      generation.current++;
      if (recorder.current?.state === "recording") recorder.current.stop();
      releaseMic();
      onLock.current(false);
    };
  }, []);
  useEffect(() => {
    if (!clip) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(clip);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [clip]);
  useEffect(() => {
    if (phase === "idle") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  function discard() {
    setClip(undefined);
    setPhase("idle");
    setError("");
    onLock.current(false);
  }
  async function start() {
    if (disabled || active.current) return;
    active.current = true;
    const attempt = ++generation.current;
    setError("");
    setSeconds(0);
    setPhase("permission");
    onLock.current(true);
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || attempt !== generation.current) {
        mic.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = mic;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("unsupported-format");
      const capture = new MediaRecorder(mic, { mimeType });
      recorder.current = capture;
      const chunks: Blob[] = [];
      let bytes = 0;
      let failed = false;
      capture.ondataavailable = (event) => {
        bytes += event.data.size;
        if (bytes > MAX_BYTES) {
          failed = true;
          if (mounted.current)
            setError("Recording exceeded 10 MB. Try a shorter voice note.");
          if (capture.state === "recording") capture.stop();
        } else if (event.data.size) chunks.push(event.data);
      };
      capture.onerror = () => {
        failed = true;
        releaseMic();
        active.current = false;
        if (mounted.current) {
          setPhase("idle");
          setError(
            "Recording stopped unexpectedly. Please try again or import audio.",
          );
          onLock.current(false);
        }
      };
      capture.onstop = () => {
        releaseMic();
        active.current = false;
        if (!mounted.current) return;
        if (failed || !bytes) {
          setPhase("idle");
          onLock.current(false);
          if (!failed) setError("No audio was captured. Please try again.");
          return;
        }
        const extension = mimeType.includes("mp4")
          ? "m4a"
          : mimeType.includes("ogg")
            ? "ogg"
            : "webm";
        setClip(
          new File(chunks, `voice-note.${extension}`, { type: mimeType }),
        );
        setPhase("preview");
      };
      capture.start(1000);
      setPhase("recording");
      const started = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(Math.min(elapsed, MAX_SECONDS));
        if (elapsed >= MAX_SECONDS && capture.state === "recording")
          capture.stop();
      }, 250);
    } catch (failure) {
      if (attempt !== generation.current) return;
      releaseMic();
      active.current = false;
      if (!mounted.current) return;
      setPhase("idle");
      onLock.current(false);
      const name = failure instanceof Error ? failure.name : "";
      setError(
        name === "NotAllowedError"
          ? "Microphone permission was denied. Allow it in your browser or import a recording."
          : name === "NotFoundError"
            ? "No microphone was found. You can import a recording instead."
            : "Could not start recording. Check your microphone or import a recording instead.",
      );
    }
  }
  return (
    <div className="voice-recorder">
      {error && (
        <p className="recorder-error" role="alert">
          {error}
        </p>
      )}
      {phase === "idle" && (
        <button
          className="secondary"
          disabled={disabled || !supported}
          onClick={() => void start()}
        >
          Record voice note
        </button>
      )}
      {phase === "permission" && (
        <div className="actions">
          <p role="status">Waiting for microphone permission…</p>
          <button
            className="secondary"
            onClick={() => {
              generation.current++;
              active.current = false;
              discard();
            }}
          >
            Cancel recording
          </button>
        </div>
      )}
      {phase === "recording" && (
        <div className="actions">
          <span role="status">
            Recording · {seconds}s / {MAX_SECONDS}s
          </span>
          <button
            className="primary"
            onClick={() => {
              if (recorder.current?.state === "recording")
                recorder.current.stop();
            }}
          >
            Stop recording
          </button>
        </div>
      )}
      {phase === "preview" && clip && (
        <>
          <p>
            Listen back, then send this recording for an editable transcript.
          </p>
          {preview && (
            <audio controls src={preview} aria-label="Recorded voice note" />
          )}
          <div className="actions">
            <button
              className="primary"
              disabled={disabled}
              onClick={async () => {
                if (await onTranscribe(clip)) discard();
              }}
            >
              Review transcript
            </button>
            <button className="secondary" disabled={disabled} onClick={discard}>
              Discard recording
            </button>
          </div>
          <p className="hint">
            Audio stays in this tab until you request transcription. The
            recording is not saved across refreshes.
          </p>
        </>
      )}
      {!supported && (
        <p className="hint">
          Recording needs a supported browser on HTTPS or localhost. You can
          still import audio.
        </p>
      )}
    </div>
  );
}
