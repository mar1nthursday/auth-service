# auth-service frontend

A minimal React + TypeScript demo client for [auth-service](../README.md) —
exists to show the API's flows working end to end (register, login,
2FA enrollment and challenge, password reset), not as a production UI.

## Running

Requires the backend running on `http://localhost:3000` (see the root
[README](../README.md)).

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173`, matching the backend's default
`CORS_ORIGIN`.

## Notes

- The access token is kept in memory only (React state), never in
  `localStorage` — on load, the app silently calls `/auth/refresh` using
  the httpOnly cookie to restore a session.
- 2FA setup renders the `otpauthUrl` from `/auth/2fa/setup` as a QR code
  client-side via the `qrcode` package.
- There's no router — `App.tsx` switches views with local state. The
  one exception is password reset: visiting `/?token=...` (the link the
  backend logs to its console) opens the reset form directly.
