# SiteSnap

SiteSnap is a powerful web utility that allows you to capture full-page screenshots of any website. It automatically crawls internal links, handles lazy-loading, and packages everything into an organized ZIP archive.

## Features

- **Smart Crawler**: Automatically finds internal links to capture multiple pages (up to 10).
- **Full Page Capture**: Captures the entire length of the page, not just the visible viewport.
- **Live Preview Gallery**: View screenshots as they are captured in real-time.
- **Selective Download**: Choose specific screenshots to download or grab the entire set.
- **AI-Powered Summary**: Automatically generates a concise summary of the website content via OpenRouter.
- **Device Emulation**: Toggle between Desktop and Mobile viewports.

## Tech Stack

### Frontend
- **React 19** - UI framework
- **Tailwind CSS 4** - Styling
- **Motion (Framer Motion)** - Animations
- **Lucide React** - Icons
- **React Markdown** - Render AI summaries

### Backend
- **Express.js** - API server
- **Puppeteer** - Headless Chrome for screenshots
- **Cheerio** - HTML parsing for link crawling
- **Axios** - HTTP client
- **JSZip** - ZIP file generation
- **tsx** - TypeScript execution

### AI
- **OpenRouter API** - Website content summarization (defaults to DeepSeek's model, OpenAI-compatible)

### Build Tools
- **Vite** - Frontend bundler
- **TypeScript** - Type safety

### Deployment
- **Docker** - Containerization (with Chromium + CJK fonts)
- **Railway** - Hosting platform

### Architecture
```
User → React SPA → Express API → Puppeteer (screenshots)
                              → OpenRouter (AI summary)
                              → JSZip (download)
```

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- An OpenRouter API Key (get one at https://openrouter.ai/keys)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/lojul/sitesnap.git
   cd sitesnap
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your OpenRouter API key:
   ```env
   OPENROUTER_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`.

### Deploy to Railway

1. Go to [railway.app](https://railway.app) and create a **New Project** → **Deploy from GitHub repo**, then select `lojul/sitesnap`.
2. Railway auto-detects the `Dockerfile` and builds/deploys it — no extra config needed.
3. In the service's **Variables** tab, set `OPENROUTER_API_KEY`.
4. Generate a public domain for the service under **Settings** → **Networking**.

## License

This project is provided for educational and personal use. Please respect the terms of service of the websites you capture.
