# Development proxy regression

The original failure was reproduced by opening `/api/status` from an external
page in Edge. A temporary, selected-header trace at Express captured:

| Header           | Frontend GET fetch      | Frontend POST fetch     | External-link status navigation |
| ---------------- | ----------------------- | ----------------------- | ------------------------------- |
| Host             | `127.0.0.1:3001`        | `127.0.0.1:3001`        | `127.0.0.1:3001`                |
| X-Forwarded-Host | `localhost:3000`        | `localhost:3000`        | `localhost:3000`                |
| Origin           | absent                  | `http://localhost:3000` | absent                          |
| Referer origin   | `http://localhost:3000` | `http://localhost:3000` | absent                          |
| Sec-Fetch-Site   | `same-origin`           | `same-origin`           | `cross-site`                    |
| Sec-Fetch-Mode   | `cors`                  | `cors`                  | `navigate`                      |
| Sec-Fetch-Dest   | `empty`                 | `empty`                 | `document`                      |

Next's installed rewrite implementation uses `changeOrigin: true` and writes
`X-Forwarded-Host`. It changes Host, not the original browser Origin or Fetch
Metadata. Opening a URL from an external page legitimately produces cross-site
navigation metadata; the HTTPS-to-HTTP browser navigation also omitted Referer.
The original unconditional cross-site rejection therefore blocked this safe
status navigation. A host-based origin comparison would also mistake a proxied
frontend POST for a foreign origin. The previous development bypass avoided
that comparison by accepting every Origin, which was too broad.

Process inspection also found an old production/demo server occupying 3001
alongside a development frontend on 3000. Those identified TrailTape processes
were stopped and the development stack restarted from `.env`. The backend now
explicitly selects development when launched from source, and production when
launched from the compiled entry point. The diagnostic trace was removed.

## Policy

- Development explicitly trusts `DEV_FRONTEND_ORIGIN`, defaulting to
  `http://localhost:3000`, and the backend's own origin. It does not derive an
  allowlist from client-supplied forwarded-host headers.
- An explicit foreign/malformed/`null` Origin is rejected before any exception,
  even if Referer or Fetch Metadata claims otherwise.
- Development cross-site fetches require the exact configured frontend Origin,
  or its Referer when Origin is absent.
- Development top-level GET/HEAD navigation without Origin is permitted only
  for `/api/status` and `/api/health`, requiring `navigate` and `document`.
  This does not permit cross-site fetches or mutations.
- Production has neither development exception. It requires its own Origin
  when one is present and continues rejecting cross-site Fetch Metadata.
- No CORS middleware or wildcard access-control header was added. Requests
  without browser Origin/Fetch Metadata continue supporting server-side clients;
  these checks are browser protections, not API authentication.

## Actual verification

`npm run test:dev-proxy` used Edge against the real Next → Express route on
`http://localhost:3000`, without mocking providers:

| Check                                                | Result                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| GET `/api/status` through Next                       | 200; `mode=live`, configured model `google/gemma-3-27b-it:free`                       |
| Status credentials                                   | No key fields or secret values exposed                                                |
| External-link browser navigation to status           | 200; previously reproduced as 403                                                     |
| Same-origin browser status fetch                     | 200                                                                                   |
| Valid browser POST `/api/missions`                   | Reached Gemma adapter; response 502 from provider failure handling, not a routing 403 |
| Unrelated Origin POST through Next                   | 403                                                                                   |
| Browser consent → mission request → provider failure | Error and Retry control displayed                                                     |
| Real Gemma inference                                 | Attempted but unsuccessful; no live missions or journal generated                     |

The application's sanitized provider error was: "Provider request failed.
Check model availability and retry." This does not establish the upstream
HTTP status or cause; model availability, account access, and other provider
failures must be checked separately. The configured model and `.env` were
preserved. No API key, private note, or raw provider error body was printed.

All 21 unit/API tests passed, including six new origin/metadata regressions.
The production-policy tests cover own-origin acceptance and rejection of the
development origin, cross-site navigation, and Referer exceptions. Additional
tests reject spoofed forwarded-host headers, foreign/malformed origins, and
cross-site mutations. Frontend/backend type checks and the production build passed.
