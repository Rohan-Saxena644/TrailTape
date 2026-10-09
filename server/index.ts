import "dotenv/config";
import { createRequire } from "node:module";
import { createApp } from "./app.js";
import { configuration } from "./providers.js";
const production =
  process.env.NODE_ENV === "production" ||
  /\/dist\/server\/index\.js$/.test(import.meta.url);
process.env.NODE_ENV = production ? "production" : "development";
// Next ships a CommonJS server factory; require keeps NodeNext typing honest.
const next = createRequire(import.meta.url)(
  "next",
) as typeof import("next/dist/server/next.js").default;
const app = createApp(configuration());
if (production) {
  const frontend = next({ dev: false });
  await frontend.prepare();
  app.use((req, res) => frontend.getRequestHandler()(req, res));
}
const port = Number(process.env.PORT || process.env.API_PORT || 3001);
const server = app.listen(port, () =>
  console.log(`TrailTape ${production ? "app" : "API"} ready on port ${port}.`),
);
server.requestTimeout = 60000;
server.headersTimeout = 15000;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000).unref();
  });
