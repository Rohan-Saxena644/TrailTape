import express from "express";
import multer from "multer";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { preferencesSchema, notesSchema } from "../shared/schema.js";
import {
  GemmaAdapter,
  WhisperAdapter,
  ServiceError,
  type Config,
} from "./providers.js";
const allowed = new Set(["wav", "mp3", "m4a", "mp4", "ogg", "webm", "flac"]);
export function createApp(config: Config, fetcher: typeof fetch = fetch) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 20,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please wait a minute and retry." },
    }),
  );
  app.use("/api", express.json({ limit: "64kb" }));
  // Browser requests must originate from this app; no cross-origin API access.
  app.use("/api", (req, res, next) => {
    const origin = req.get("origin");
    if (
      origin &&
      origin !== `${req.protocol}://${req.get("host")}` &&
      !(!process.env.NODE_ENV || process.env.NODE_ENV === "development")
    ) {
      res.status(403).json({ error: "Cross-origin requests are not allowed." });
      return;
    }
    if (req.get("sec-fetch-site") === "cross-site") {
      res.status(403).json({ error: "Cross-site requests are not allowed." });
      return;
    }
    next();
  });
  const gemma = new GemmaAdapter(config, fetcher);
  const whisper = new WhisperAdapter(config, fetcher);
  app.get("/api/status", (_req, res) =>
    res.json({
      mode: config.mode,
      model: config.mode === "demo" ? "sample-adapter" : config.gemmaModel,
      gemmaReady: config.mode === "demo" || !!config.gemmaKey,
      audioReady: config.mode === "live" && !!config.audioKey,
    }),
  );
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.post("/api/missions", async (req, res) => {
    const preferences = preferencesSchema.parse(req.body);
    res.json({
      missions: await gemma.missions(preferences),
      mode: config.mode,
      model: config.mode === "demo" ? "sample-adapter" : config.gemmaModel,
    });
  });
  app.post("/api/journal", async (req, res) => {
    const input = z
      .object({ preferences: preferencesSchema, notes: notesSchema })
      .strict()
      .parse(req.body);
    res.json({
      journal: await gemma.journal(input.preferences, input.notes),
      mode: config.mode,
      model: config.mode === "demo" ? "sample-adapter" : config.gemmaModel,
    });
  });
  // Memory only: bounded 10MB uploads; no temporary files are created.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  });
  let inFlightAudio = 0;
  app.post(
    "/api/transcribe",
    (req, res, next) => {
      if (inFlightAudio >= 2) {
        res
          .status(429)
          .json({ error: "Audio processing is busy. Try again shortly." });
        return;
      }
      inFlightAudio++;
      let released = false;
      const release = () => {
        if (!released) {
          inFlightAudio--;
          released = true;
        }
      };
      res.on("finish", release);
      res.on("close", release);
      next();
    },
    upload.single("audio"),
    async (req, res) => {
      const file = req.file;
      if (!file) throw new ServiceError("Choose an audio file first.", 400);
      try {
        const detected = await fileTypeFromBuffer(file.buffer);
        if (!detected || !allowed.has(detected.ext))
          throw new ServiceError(
            "Unsupported recording. Use WAV, MP3, M4A, MP4, OGG, WebM, or FLAC.",
            400,
          );
        res.json({
          text: await whisper.transcribe(
            file.buffer,
            detected.mime,
            detected.ext,
          ),
        });
      } finally {
        file.buffer.fill(0);
      }
    },
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({
            error:
              "Check your input: 1–20 unique notes, each under 2,000 characters, and valid walk preferences are required.",
          });
        return;
      }
      if (error instanceof multer.MulterError) {
        res
          .status(400)
          .json({
            error: "Upload one supported audio recording, up to 10 MB.",
          });
        return;
      }
      if (error instanceof ServiceError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      if ((error as { type?: string })?.type === "entity.too.large") {
        res
          .status(413)
          .json({ error: "Notes are too large. Shorten them and retry." });
        return;
      }
      if (error instanceof SyntaxError) {
        res.status(400).json({ error: "Request must contain valid JSON." });
        return;
      }
      // Never expose/log provider payloads, keys, private notes, or audio.
      res
        .status(500)
        .json({
          error:
            "Something went wrong. Your notes are still available; please retry.",
        });
    },
  );
  return app;
}
