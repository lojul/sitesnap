# SiteSnap

SiteSnap is a powerful web utility that allows you to capture full-page screenshots of any website. It automatically crawls internal links, handles lazy-loading, and packages everything into an organized ZIP archive.

## Features

- **Smart Crawler**: Automatically finds internal links to capture multiple pages (up to 10).
- **Full Page Capture**: Captures the entire length of the page, not just the visible viewport.
- **Live Preview Gallery**: View screenshots as they are captured in real-time.
- **Selective Download**: Choose specific screenshots to download or grab the entire set.
- **AI-Powered Summary**: Automatically generates a concise summary of the website content using Gemini.
- **Device Emulation**: Toggle between Desktop and Mobile viewports.

## Tech Stack

- **Frontend**: React, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend**: Node.js, Express, Puppeteer (for headless browser capture).
- **AI**: Google Gemini API via `@google/genai`.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A Google Gemini API Key

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd sitesnap
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`.

## License

This project is provided for educational and personal use. Please respect the terms of service of the websites you capture.
