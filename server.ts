import express from "express";
import { createServer as createViteServer } from "vite";
import puppeteer from "puppeteer";
import JSZip from "jszip";
import axios from "axios";
import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Job store (in-memory for simplicity, but could use SQLite)
const jobs = new Map<string, {
  status: "pending" | "crawling" | "capturing" | "zipping" | "completed" | "failed";
  progress: number;
  total: number;
  zipData?: Buffer;
  screenshots: Array<{ filename: string, data: Buffer }>;
  error?: string;
  url: string;
  device: "desktop" | "mobile";
  extractedText?: string;
}>();

// Helper to crawl internal links
async function crawlLinks(baseUrl: string, limit: number = 10): Promise<string[]> {
  const links = new Set<string>([baseUrl]);
  const urlObj = new URL(baseUrl);
  const domain = urlObj.hostname;

  try {
    const response = await axios.get(baseUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);

    $("a").each((_, element) => {
      if (links.size >= limit) return false;
      const href = $(element).attr("href");
      if (!href) return;

      try {
        const absoluteUrl = new URL(href, baseUrl).toString();
        const absoluteUrlObj = new URL(absoluteUrl);
        
        // Only internal links, same domain
        if (absoluteUrlObj.hostname === domain && !absoluteUrl.includes("#")) {
          links.add(absoluteUrl);
        }
      } catch (e) {
        // Invalid URL
      }
    });
  } catch (error) {
    console.error("Crawling error:", error);
  }

  return Array.from(links).slice(0, limit);
}

// Helper to take screenshots
async function captureScreenshots(jobId: string, urls: string[]) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "capturing";
  job.total = urls.length;
  job.progress = 0;

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--single-process"
      ],
      headless: true
    });

    const zip = new JSZip();
    const page = await browser.newPage();
    
    // Device settings
    const isMobile = job.device === "mobile";
    const viewportWidth = isMobile ? 390 : 1280;
    const viewportHeight = isMobile ? 844 : 800;
    const userAgent = isMobile 
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

    await page.setUserAgent(userAgent);
    await page.setViewport({ width: viewportWidth, height: viewportHeight });

    let firstPageText = "";

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        console.log(`Capturing ${url}...`);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
        
        // Wait extra time for animations/dynamic content
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Trigger lazy loading by scrolling to the bottom and back up
        await page.evaluate(async () => {
          await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;

              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                window.scrollTo(0, 0);
                resolve(true);
              }
            }, 100);
          });
        });

        // Wait a bit after scrolling back up
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Extract text from the first page for AI summary
        if (i === 0) {
          firstPageText = await page.evaluate(() => {
            // Remove scripts and styles
            const scripts = document.querySelectorAll('script, style');
            scripts.forEach(s => s.remove());
            return document.body.innerText.substring(0, 5000); // Limit text
          });
        }

        // Get total height of the page
        const totalHeight = await page.evaluate(() => {
          return Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
            document.documentElement.offsetHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight
          );
        });

        const numParts = Math.ceil(totalHeight / viewportHeight);
        const urlSlug = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "_").toLowerCase().substring(0, 30);

        for (let part = 0; part < numParts; part++) {
          const yPos = part * viewportHeight;
          
          // Scroll to position
          await page.evaluate((y) => window.scrollTo(0, y), yPos);
          // Wait for any lazy-loaded content or scroll animations
          await new Promise(resolve => setTimeout(resolve, 800));

          const screenshot = await page.screenshot({
            clip: {
              x: 0,
              y: yPos,
              width: viewportWidth,
              height: Math.min(viewportHeight, totalHeight - yPos)
            }
          });
          
          const filename = `page${i + 1}-part${part + 1}-${urlSlug}.png`;
          zip.file(filename, screenshot);
          job.screenshots.push({ filename, data: screenshot });
        }
        
        job.progress = i + 1;
      } catch (e) {
        console.error(`Failed to capture ${url}:`, e);
      }
    }

    if (firstPageText) {
      job.extractedText = firstPageText;
    }

    job.status = "zipping";
    
    console.log(`Generating ZIP for job ${jobId}...`);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    job.zipData = zipBuffer;
    job.status = "completed";
    console.log(`Job ${jobId} completed. ZIP size: ${zipBuffer.length} bytes.`);
  } catch (error: any) {
    console.error("Capture error:", error);
    job.status = "failed";
    job.error = error.message;
  } finally {
    if (browser) await browser.close();
  }
}

// API Routes removed from here and moved into startServer


async function startServer() {
  const vite = process.env.NODE_ENV !== "production"
    ? await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      })
    : null;

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/jobs", async (req, res) => {
    console.log("POST /api/jobs", req.body);
    const { url, device = "desktop" } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const jobId = uuidv4();
      jobs.set(jobId, { 
        status: "pending", 
        progress: 0, 
        total: 0, 
        url, 
        device,
        screenshots: [] 
      });

      // Start process in background
      (async () => {
        try {
          const job = jobs.get(jobId)!;
          job.status = "crawling";
          const urls = await crawlLinks(url, 10);
          await captureScreenshots(jobId, urls);
        } catch (err) {
          console.error(`Background job ${jobId} failed:`, err);
          const job = jobs.get(jobId);
          if (job) {
            job.status = "failed";
            job.error = String(err);
          }
        }
      })();

      res.json({ jobId });
    } catch (error: any) {
      console.error("Error creating job:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:id", (req, res) => {
    const jobId = req.params.id;
    const job = jobs.get(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    
    const { zipData, screenshots, ...safeJob } = job;
    res.json({ 
      ...safeJob, 
      jobId,
      screenshotNames: job.screenshots.map(s => s.filename)
    });
  });

  app.get("/api/jobs/:id/screenshots/:filename", (req, res) => {
    const { id, filename } = req.params;
    const job = jobs.get(id);
    if (!job) return res.status(404).send("Job not found");
    
    const screenshot = job.screenshots.find(s => s.filename === filename);
    if (!screenshot) return res.status(404).send("Screenshot not found");
    
    res.setHeader("Content-Type", "image/png");
    res.send(screenshot.data);
  });

  app.post("/api/jobs/:id/download-selected", async (req, res) => {
    const jobId = req.params.id;
    const { filenames } = req.body;
    const job = jobs.get(jobId);
    
    if (!job || !filenames || !Array.isArray(filenames)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const selectedZip = new JSZip();
    filenames.forEach(name => {
      const s = job.screenshots.find(ss => ss.filename === name);
      if (s) selectedZip.file(s.filename, s.data);
    });

    const buffer = await selectedZip.generateAsync({ type: "nodebuffer" });
    
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const tempFile = path.join(tempDir, `selected-${jobId}.zip`);
    fs.writeFileSync(tempFile, buffer);

    res.download(tempFile, `selected-screenshots.zip`, () => {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    });
  });

  app.get("/api/jobs/:id/download", (req, res) => {
    const jobId = req.params.id;
    const job = jobs.get(jobId);
    
    if (!job || !job.zipData) {
      return res.status(404).json({ error: "File not found" });
    }

    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const tempFile = path.join(tempDir, `screenshots-${jobId}.zip`);
    fs.writeFileSync(tempFile, job.zipData);

    res.download(tempFile, `screenshots-${jobId}.zip`, (err) => {
      if (err) {
        console.error("Download error:", err);
      }
      // Clean up temp file after download
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch (unlinkErr) {
        console.error("Error deleting temp file:", unlinkErr);
      }
    });
  });

  // AI Summary endpoint
  app.post("/api/summarize", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(500).json({ error: "DEEPSEEK_API_KEY not configured" });
    }

    try {
      const response = await axios.post(
        "https://api.deepseek.com/chat/completions",
        {
          model: "deepseek-chat",
          messages: [
            {
              role: "user",
              content: `Summarize this website content in 3-4 bullet points in English. Focus on the main purpose and key features. Always respond in English regardless of the website's language. Content: ${text}`,
            },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          },
        }
      );
      const summary = response.data.choices?.[0]?.message?.content || "No summary available.";
      res.json({ summary });
    } catch (error: any) {
      console.error("AI Summary error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  // JSON 404 for API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (vite) {
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
