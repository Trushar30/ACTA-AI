# Deploying ACTA-AI

The app is two separate services. **Deploy the backend first**, then point the frontend at it.

| Part      | Where                       | Why                                                                                  |
| --------- | --------------------------- | ------------------------------------------------------------------------------------ |
| Frontend  | Vercel                      | Static Vite/React build — perfect fit.                                               |
| Backend   | Render / Railway / Fly.io   | Needs a long-running Node process with Chromium + ffmpeg. Vercel serverless can't run Puppeteer, Socket.io, ffmpeg, or `node-cron`. |

---

## 1 · Backend → Render (via Dockerfile)

1. Push this repo to GitHub.
2. In Render → **New +** → **Web Service** → connect the repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Runtime:** `Docker` (Render auto-detects `backend/Dockerfile`)
   - **Plan:** Starter or higher (the free plan sleeps and Chromium will OOM).
4. **Environment Variables:** paste from `backend/.env.example`. At minimum you need `MONGO_URI`, `JWT_SECRET`, `SESSION_SECRET`, `BOT_ENCRYPTION_KEY`, and any AI provider key you actually use (Gemini / Deepgram / Groq…).
5. Deploy. Note the URL Render gives you, e.g. `https://acta-backend.onrender.com`.
6. Update `GOOGLE_CALLBACK_URL` to `<that URL>/api/auth/google/callback` and add the same redirect URI in Google Cloud Console.

> Disk note: `recordings/` and `browser-profiles/` are written to local disk and **will be wiped on every redeploy**. Mount a Render Disk if you need them to persist.

> Python transcription is optional. The Dockerfile does **not** ship Python; flows that use `PYTHON_EXECUTABLE` will fail. Most transcription paths go through Deepgram / AssemblyAI / Groq APIs instead and work fine.

---

## 2 · Frontend → Vercel

Backend is already running on a **Vultr VPS** at `http://45.77.168.91:3001`, so the frontend just needs to point at it.

1. In Vercel → **Add New** → **Project** → import the repo.
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `vite build` *(already in `vercel.json`)*
   - **Output Directory:** `dist`
3. **Environment Variables** — `frontend/.env.production` already sets `VITE_API_URL=http://45.77.168.91:3001`, so the build will Just Work. If you want to override per-environment, set it in Vercel's UI (it overrides the file).
4. Deploy. `frontend/vercel.json` rewrites all paths to `index.html` so React Router routes don't 404 on refresh.

### ⚠️ Mixed-content warning — this WILL break in browsers

Vercel serves the frontend over **HTTPS**, but the Vultr backend is **HTTP**. Browsers silently block HTTPS→HTTP requests as "mixed content." That means:

- Every `fetch()` / `axios` call from the deployed site will fail in the browser console.
- Google OAuth callbacks require HTTPS — login will not work.
- `Secure` cookies won't be sent.
- Socket.io will refuse to upgrade to `wss://`.

**To actually make the deployed site work, the backend needs HTTPS.** Cheapest path:

1. Point a (free) domain at `45.77.168.91` — DuckDNS works, or buy a $1 `.xyz`.
2. On the Vultr box:
   ```bash
   sudo apt install -y caddy
   # /etc/caddy/Caddyfile:
   # api.yourdomain.com {
   #     reverse_proxy localhost:3001
   # }
   sudo systemctl reload caddy
   ```
   Caddy auto-fetches a Let's Encrypt cert.
3. Update `VITE_API_URL` to `https://api.yourdomain.com` in Vercel and redeploy.

Until that's done, the deployed frontend will only be useful for visual smoke-testing the UI shell.

---

## 3 · After both are up

- In the **backend's** env vars, add the Vercel URL to whatever CORS allow-list you use, and update `GOOGLE_CALLBACK_URL` if you change domains.
- Test login → dashboard → create a meeting end-to-end.

## Local dev unchanged

`VITE_API_URL` falls back to `http://localhost:3000`, so `npm run dev` in `frontend/` against `npm start` in `backend/` still works without any env file.
