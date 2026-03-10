import React, { useState, useEffect } from "react";
import { Camera, Download, Globe, Loader2, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Monitor, Smartphone, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";

type JobStatus = "pending" | "crawling" | "capturing" | "zipping" | "completed" | "failed";

interface Job {
  jobId: string;
  status: JobStatus;
  progress: number;
  total: number;
  url: string;
  device?: "desktop" | "mobile";
  error?: string;
  extractedText?: string;
  screenshotNames?: string[];
}

export default function App() {
  const [url, setUrl] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [job, setJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [selectedScreenshots, setSelectedScreenshots] = useState<Set<string>>(new Set());
  const [isDownloadingSelected, setIsDownloadingSelected] = useState(false);
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);

  const toggleScreenshotSelection = (name: string) => {
    const newSelection = new Set(selectedScreenshots);
    if (newSelection.has(name)) {
      newSelection.delete(name);
    } else {
      newSelection.add(name);
    }
    setSelectedScreenshots(newSelection);
  };

  const downloadSelected = async () => {
    if (!job || selectedScreenshots.size === 0) return;
    
    setIsDownloadingSelected(true);
    try {
      const response = await fetch(`/api/jobs/${job.jobId}/download-selected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filenames: Array.from(selectedScreenshots) }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "selected-screenshots.zip";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error downloading selected:", error);
    } finally {
      setIsDownloadingSelected(false);
    }
  };

  const generateSummary = async (text: string) => {
    if (!process.env.DEEPSEEK_API_KEY) return;

    setIsGeneratingSummary(true);
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "user",
              content: `Summarize this website content in 3-4 bullet points. Focus on the main purpose and key features. Content: ${text}`,
            },
          ],
        }),
      });
      const data = await response.json();
      setSummary(data.choices?.[0]?.message?.content || "No summary available.");
    } catch (error) {
      console.error("AI Summary error:", error);
      setSummary("Could not generate summary.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsSubmitting(true);
    setSummary(null);
    setSelectedScreenshots(new Set());
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, device }),
      });
      const data = await response.json();
      if (data.jobId) {
        setJob({ jobId: data.jobId, status: "pending", progress: 0, total: 0, url });
      } else {
        alert(data.error || "Failed to start job");
      }
    } catch (error) {
      console.error("Error starting job:", error);
      alert("Failed to connect to server");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${job.jobId}`);
        const data = await response.json();
        setJob((prev) => prev ? { ...prev, ...data } : null);
        
        if (data.status === "completed" && data.extractedText && !summary && !isGeneratingSummary) {
          generateSummary(data.extractedText);
        }
      } catch (error) {
        console.error("Error polling job:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [job?.jobId, job?.status, summary, isGeneratingSummary]);

  const getStatusText = (status: JobStatus) => {
    switch (status) {
      case "pending": return "Initializing...";
      case "crawling": return "Crawling website for links...";
      case "capturing": return `Capturing page ${job?.progress} of ${job?.total}...`;
      case "zipping": return "Creating ZIP archive...";
      case "completed": return "Screenshots ready!";
      case "failed": return "Failed to process website";
      default: return "Processing...";
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#F5F5F0]">
      {/* Header */}
      <header className="border-b border-[#141414]/10 p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center text-[#F5F5F0]">
            <Camera size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase italic font-serif">SiteSnap</h1>
        </div>
        <div className="text-xs font-mono opacity-50 uppercase tracking-widest">
          v1.0.0 / Beta
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          {/* Hero Section */}
          <div className="space-y-4">
            <h2 className="text-5xl md:text-7xl font-serif italic font-light leading-tight tracking-tighter">
              Capture the <span className="font-bold not-italic">Web</span>.
            </h2>
            <p className="text-lg opacity-60 max-w-xl">
              Enter a URL and we'll automatically crawl up to 10 pages, take full-page screenshots, and package them into a single ZIP file for you.
            </p>
          </div>

          {/* Input Form */}
          <section className="bg-white rounded-3xl p-8 shadow-xl shadow-black/5 border border-black/5">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="url" className="text-xs font-mono uppercase tracking-widest opacity-50 ml-1">
                  Target Website URL
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#141414]/30 group-focus-within:text-[#141414] transition-colors">
                    <Globe size={20} />
                  </div>
                  <input
                    id="url"
                    type="url"
                    required
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isSubmitting || (job !== null && job.status !== "completed" && job.status !== "failed")}
                    className="w-full bg-[#F5F5F0] border-none rounded-2xl py-5 pl-12 pr-4 text-lg focus:ring-2 focus:ring-[#141414] transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest opacity-50 ml-1">
                  Device Emulation
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setDevice("desktop")}
                    disabled={isSubmitting || (job !== null && job.status !== "completed" && job.status !== "failed")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                      device === "desktop" 
                        ? "bg-[#141414] text-[#F5F5F0] border-[#141414]" 
                        : "bg-transparent text-[#141414] border-black/10 hover:border-black/30"
                    }`}
                  >
                    <Monitor size={18} />
                    <span className="font-medium">Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevice("mobile")}
                    disabled={isSubmitting || (job !== null && job.status !== "completed" && job.status !== "failed")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                      device === "mobile" 
                        ? "bg-[#141414] text-[#F5F5F0] border-[#141414]" 
                        : "bg-transparent text-[#141414] border-black/10 hover:border-black/30"
                    }`}
                  >
                    <Smartphone size={18} />
                    <span className="font-medium">Mobile</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (job !== null && job.status !== "completed" && job.status !== "failed")}
                className="w-full bg-[#141414] text-[#F5F5F0] rounded-2xl py-5 font-bold text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <>
                    <Camera size={24} />
                    <span>Start Capture</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-center opacity-40 font-mono uppercase tracking-wider">
                Please use this tool responsibly and respect the terms of service of the websites you capture.
              </p>
            </form>
          </section>

          {/* Status Display */}
          <AnimatePresence mode="wait">
            {job && (
              <motion.section
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-8 shadow-xl shadow-black/5 border border-black/5"
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="space-y-1">
                    <h3 className="text-xs font-mono uppercase tracking-widest opacity-50">Current Session</h3>
                    <p className="font-medium flex items-center gap-2">
                      <ExternalLink size={14} className="opacity-40" />
                      {job.url}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    job.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                    job.status === "failed" ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {job.status}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-3 bg-[#F5F5F0] rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ 
                          width: job.status === "completed" ? "100%" : 
                                 job.total > 0 ? `${(job.progress / job.total) * 100}%` : "10%" 
                        }}
                        className={`h-full transition-all duration-500 ${
                          job.status === "failed" ? "bg-red-500" : "bg-[#141414]"
                        }`}
                      />
                    </div>
                    <div className="text-sm font-mono font-bold">
                      {job.status === "completed" ? "100%" : 
                       job.total > 0 ? `${Math.round((job.progress / job.total) * 100)}%` : "..."}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      {job.status === "completed" ? (
                        <CheckCircle2 className="text-emerald-500" size={20} />
                      ) : job.status === "failed" ? (
                        <AlertCircle className="text-red-500" size={20} />
                      ) : (
                        <Loader2 className="animate-spin text-[#141414]/40" size={20} />
                      )}
                      <span>{getStatusText(job.status)}</span>
                    </div>

                    {job.status === "completed" && (
                      <a
                        href={`/api/jobs/${job.jobId}/download`}
                        className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                      >
                        <Download size={18} />
                        Download ZIP
                      </a>
                    )}

                    {(job.status === "completed" || job.status === "failed") && (
                      <button
                        onClick={() => { setJob(null); setUrl(""); setSelectedScreenshots(new Set()); }}
                        className="p-3 rounded-xl border border-black/5 hover:bg-black/5 transition-colors"
                        title="New Capture"
                      >
                        <RefreshCw size={18} />
                      </button>
                    )}
                  </div>

                  {job.error && (
                    <div className="mt-4 p-4 bg-red-50 rounded-xl text-red-700 text-sm flex items-start gap-3">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      <p>{job.error}</p>
                    </div>
                  )}

                  {/* Gallery Section */}
                  {job.screenshotNames && job.screenshotNames.length > 0 && (
                    <div className="mt-12 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="text-xs font-mono uppercase tracking-widest opacity-50">Live Preview Gallery</h3>
                          <p className="text-sm opacity-60">{selectedScreenshots.size} items selected</p>
                        </div>
                        {selectedScreenshots.size > 0 && (
                          <button
                            onClick={downloadSelected}
                            disabled={isDownloadingSelected}
                            className="bg-[#141414] text-[#F5F5F0] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-black/80 transition-all disabled:opacity-50"
                          >
                            {isDownloadingSelected ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            Download Selected ({selectedScreenshots.size})
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {job.screenshotNames.map((name) => (
                          <motion.div
                            key={name}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onMouseEnter={() => setHoveredImage(name)}
                            onMouseLeave={() => setHoveredImage(null)}
                            onClick={() => toggleScreenshotSelection(name)}
                            className={`relative group aspect-[4/3] rounded-2xl overflow-hidden border-2 cursor-pointer transition-all duration-300 ${
                              selectedScreenshots.has(name) 
                                ? "border-[#141414] ring-4 ring-[#141414]/10" 
                                : "border-transparent shadow-sm hover:shadow-xl hover:shadow-black/10"
                            }`}
                          >
                            <img
                              src={`/api/jobs/${job.jobId}/screenshots/${name}`}
                              alt={name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            
                            <AnimatePresence>
                              {hoveredImage === name && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="fixed z-[100] pointer-events-none shadow-2xl rounded-2xl overflow-hidden border border-black/10 bg-white hidden md:block"
                                  style={{
                                    width: job.device === "mobile" ? "195px" : "640px", // 50% of 390 or 1280
                                    maxHeight: "80vh",
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)"
                                  }}
                                >
                                  <div className="p-2 bg-black/5 text-[10px] font-mono uppercase tracking-widest flex justify-between items-center">
                                    <span>50% Actual Size Preview</span>
                                    <span>{name}</span>
                                  </div>
                                  <div className="overflow-auto max-h-[calc(80vh-30px)]">
                                    <img
                                      src={`/api/jobs/${job.jobId}/screenshots/${name}`}
                                      alt="Preview"
                                      className="w-full h-auto block"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                              selectedScreenshots.has(name) ? "opacity-100" : "opacity-0"
                            }`}>
                              <CheckCircle2 className="text-white" size={32} />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                              <p className="text-[8px] text-white font-mono truncate opacity-80">{name}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(summary || isGeneratingSummary) && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3"
                    >
                      <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-widest">
                        <Sparkles size={16} className={isGeneratingSummary ? "animate-pulse" : ""} />
                        <span>AI Site Summary</span>
                      </div>
                      <div className="text-sm text-indigo-900 leading-relaxed prose prose-indigo max-w-none">
                        {isGeneratingSummary ? (
                          <div className="flex items-center gap-2 opacity-50 italic">
                            <Loader2 size={14} className="animate-spin" />
                            Generating summary...
                          </div>
                        ) : (
                          <Markdown>{summary || ""}</Markdown>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Features/Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-black/5">
            {[
              { icon: <Globe size={20} />, title: "Smart Crawler", desc: "Automatically finds internal links to capture more than just the home page." },
              { icon: <Camera size={20} />, title: "Full Page", desc: "Captures the entire length of the page, not just the visible viewport." },
              { icon: <Download size={20} />, title: "ZIP Export", desc: "All screenshots are named and bundled into a single organized archive." }
            ].map((feature, i) => (
              <div key={i} className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center">
                  {feature.icon}
                </div>
                <h4 className="font-bold">{feature.title}</h4>
                <p className="text-sm opacity-50 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      <footer className="max-w-3xl mx-auto px-6 py-12 text-center space-y-4">
        <div className="opacity-30 text-xs font-mono uppercase tracking-[0.2em]">
          Built with Precision & Care &copy; {new Date().getFullYear()}
        </div>
        <div className="opacity-40 text-[10px] leading-relaxed max-w-lg mx-auto">
          <p className="font-bold uppercase tracking-widest mb-1">Disclaimer</p>
          <p>
            This tool is provided for personal and educational purposes only. Users are solely responsible for ensuring their use of this service complies with applicable copyright laws and the terms of service of the websites being captured. SiteSnap does not store or claim ownership of any content captured through this interface.
          </p>
        </div>
      </footer>
    </div>
  );
}
