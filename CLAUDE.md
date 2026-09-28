# SiteSnap

Website screenshot crawler. Paste in a URL, it crawls up to 10 internal links,
captures a full-page screenshot of each (desktop or mobile), shows them in a
live gallery as they come in, writes a short AI summary of the site, and
packages selected or all screenshots into a ZIP download.

- **Repo**: `lojul/sitesnap` on GitHub.
- **Live**: `sitesnap.infiniduo.com` (also linked from the Infinity Duo v2
  site's Our Work page, `~/Active Projects/infinity-duo-v2`, as the
  `sitesnap-website-crawler` showcase — keep that page's summary in sync if
  this README/feature set changes materially).
- **Hosting**: Railway, deployed from the Dockerfile (Chromium + CJK fonts
  baked in for Puppeteer). `render.yaml`/Render config was removed in favour
  of Railway.

## Stack

- Frontend: React 19, Tailwind CSS 4, Motion (Framer Motion), Lucide icons,
  React Markdown (for rendering the AI summary).
- Backend: Express (`server.ts`), Puppeteer for headless-Chrome screenshots,
  Cheerio for link crawling, Axios, JSZip for the download package, `tsx` to
  run the TypeScript server directly.
- AI summary: OpenRouter API, defaults to DeepSeek's `deepseek/deepseek-chat`
  model (OpenAI-compatible). Generated **server-side** (moved there from the
  client to fix Chinese-font rendering and keep the API key off the client).
  Model is overridable via `OPENROUTER_MODEL`; instructed to always summarize
  in English regardless of the site's own language.
- Build: Vite + TypeScript.

## Environment

`.env` (see `.env.example`):
- `OPENROUTER_API_KEY` — required.
- `OPENROUTER_MODEL` — optional, defaults to `deepseek/deepseek-chat`.
- `APP_URL` — the hosted URL (self-referential links/callbacks); AI Studio
  injects this automatically at runtime when deployed there, otherwise set it
  by hand for Railway.

## Working notes

- Crawl is capped at 10 internal pages per run.
- Full-page capture (not just the viewport), with lazy-loaded content handled
  before the screenshot is taken.
- Desktop/mobile viewport is a toggle in the UI, not per-page.
- `npm run dev` runs `tsx server.ts` (Express + Vite dev middleware in one
  process, not a separate frontend/backend dev split).
