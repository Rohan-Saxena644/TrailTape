import type { RequestHandler } from "express";

export type BrowserAccessOptions = {
  development: boolean;
  frontendOrigin: string;
};

function originOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

export function browserAccess(options: BrowserAccessOptions): RequestHandler {
  const frontendOrigin = originOf(options.frontendOrigin);
  if (!frontendOrigin || frontendOrigin !== options.frontendOrigin) {
    throw new Error(
      "DEV_FRONTEND_ORIGIN must be an exact HTTP(S) origin without a path.",
    );
  }
  return (req, res, next) => {
    const origin = req.get("origin");
    const ownOrigin = `${req.protocol}://${req.get("host")}`;
    // Next's rewrite changes Host to the backend destination. Do not turn an
    // arbitrary X-Forwarded-Host into an allowed origin: the dev frontend is
    // explicitly configured instead. Production permits only its own origin.
    const trusted = (value: string | undefined) =>
      value === ownOrigin || (options.development && value === frontendOrigin);
    if (origin && !trusted(origin)) {
      res.status(403).json({ error: "Cross-origin requests are not allowed." });
      return;
    }

    if (req.get("sec-fetch-site") === "cross-site") {
      const fromDevFrontend =
        options.development &&
        (origin === frontendOrigin ||
          (!origin && originOf(req.get("referer")) === frontendOrigin));
      // A link from an external page is a legitimate top-level navigation.
      // Only these read-only endpoints get this development exception. It
      // never permits a mutation, fetch/subresource, or explicit foreign Origin.
      const safeDevNavigation =
        options.development &&
        !origin &&
        (req.method === "GET" || req.method === "HEAD") &&
        (req.path === "/status" || req.path === "/health") &&
        req.get("sec-fetch-mode") === "navigate" &&
        req.get("sec-fetch-dest") === "document";
      if (!fromDevFrontend && !safeDevNavigation) {
        res.status(403).json({ error: "Cross-site requests are not allowed." });
        return;
      }
    }
    next();
  };
}
