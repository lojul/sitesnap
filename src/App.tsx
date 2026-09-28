import React, { useState, useEffect } from "react";
import { Aperture, Camera, Download, Globe, Loader2, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Monitor, Smartphone, Sparkles, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";

type JobStatus = "pending" | "crawling" | "capturing" | "zipping" | "completed" | "failed" | "cancelled";

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
  const [isCancelling, setIsCancelling] = useState(false);

  const cancelJob = async () => {
    if (!job) return;
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/jobs/${job.jobId}/cancel`, { method: "POST" });
      if (response.ok) {
        setJob((prev) => prev ? { ...prev, status: "cancelled", error: "Cancelled by user" } : null);
      }
    } catch (error) {
      console.error("Error cancelling job:", error);
    } finally {
      setIsCancelling(false);
    }
  };

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
    setIsGeneratingSummary(true);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (data.error) {
        setSummary("Could not generate summary.");
      } else {
        setSummary(data.summary || "No summary available.");
      }
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
    if (!job || job.status === "completed" || job.status === "failed" || job.status === "cancelled") return;

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
      case "cancelled": return "Capture cancelled";
      default: return "Processing...";
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#211D18] font-sans selection:bg-[#9A3412] selection:text-white">
      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#9A3412] flex items-center justify-center text-white">
            <Aperture size={16} strokeWidth={2} />
          </div>
          <h1 className="text-lg font-semibold font-serif italic">SiteSnap</h1>
        </div>
        <div className="text-xs text-gray-400">
          v1.0.0 / Beta
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-10"
        >
          {/* Hero Section */}
          <div className="space-y-3">
            <h2 className="text-3xl md:text-4xl font-serif leading-tight">
              Capture the web.
            </h2>
            <p className="text-base text-gray-500 max-w-xl">
              Enter a URL and we'll automatically crawl up to 10 pages, take full-page screenshots, and package them into a single ZIP file for you.
            </p>
          </div>

          {/* Input Form */}
          <section className="bg-white rounded-lg p-6 border border-gray-200">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="url" className="text-sm text-gray-500">
                  Target website URL
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#211D18] transition-colors">
                    <Globe size={18} />
                  </div>
                  <input
                    id="url"
                    type="url"
                    required
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isSubmitting || (job !== null && job.status !== "completed" && job.status !== "failed" && job.status !== "cancelled")}
                    className="w-full bg-white border border-gray-300 rounded-md py-3 pl-11 pr-4 text-base focus:outline-none focus:ring-1 focus:ring-[#9A3412] focus:border-[#9A3412] transition-colors disabled:opacity-50 disabled:bg-gray-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-gray-500">
                  Device emulation
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDevice("desktop")}
                    disabled={isSubmitting || (job !== null && job.status !== "completed" && job.status !== "failed" && job.status !== "cancelled")}
                    className={`flex items-center justify-center gap-1.5 py-2 text-sm rounded-md border transition-colors ${
                      device === "desktop"
                        ? "bg-[#9A3412] text-white border-[#9A3412]"
                        : "bg-white text-[#211D18] border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <Monitor size={14} />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevice("mobile")}
                    disabled={isSubmitting || (job !== null && job.status !== "completed" && job.status !== "failed" && job.status !== "cancelled")}
                    className={`flex items-center justify-center gap-1.5 py-2 text-sm rounded-md border transition-colors ${
                      device === "mobile"
                        ? "bg-[#9A3412] text-white border-[#9A3412]"
                        : "bg-white text-[#211D18] border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <Smartphone size={14} />
                    <span>Mobile</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (job !== null && job.status !== "completed" && job.status !== "failed" && job.status !== "cancelled")}
                className="w-full bg-[#9A3412] text-white rounded-md py-2.5 font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#7C2D12] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <>
                    <Camera size={16} />
                    <span>Start Capture</span>
                  </>
                )}
              </button>
              <p className="text-xs text-center text-gray-400">
                Please use this tool responsibly and respect the terms of service of the websites you capture.
              </p>
            </form>
          </section>

          {/* Status Display */}
          <AnimatePresence mode="wait">
            {job && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-lg p-6 border border-gray-200"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="space-y-1">
                    <h3 className="text-sm text-gray-500">Current session</h3>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <ExternalLink size={13} className="text-gray-400" />
                      {job.url}
                    </p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                    job.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                    job.status === "failed" ? "bg-red-50 text-red-700" :
                    job.status === "cancelled" ? "bg-gray-100 text-gray-600" :
                    "bg-blue-50 text-blue-700"
                  }`}>
                    {job.status}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: job.status === "completed" ? "100%" :
                                 job.total > 0 ? `${(job.progress / job.total) * 100}%` : "10%"
                        }}
                        className={`h-full transition-all duration-500 ${
                          job.status === "failed" ? "bg-red-500" :
                          job.status === "cancelled" ? "bg-gray-400" :
                          "bg-[#9A3412]"
                        }`}
                      />
                    </div>
                    <div className="text-sm text-gray-500 tabular-nums">
                      {job.status === "completed" ? "100%" :
                       job.total > 0 ? `${Math.round((job.progress / job.total) * 100)}%` : "..."}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-sm">
                      {job.status === "completed" ? (
                        <CheckCircle2 className="text-emerald-500" size={18} />
                      ) : job.status === "failed" ? (
                        <AlertCircle className="text-red-500" size={18} />
                      ) : job.status === "cancelled" ? (
                        <Square className="text-gray-400" size={16} />
                      ) : (
                        <Loader2 className="animate-spin text-gray-400" size={18} />
                      )}
                      <span>{getStatusText(job.status)}</span>
                    </div>

                    {job.status === "completed" && (
                      <a
                        href={`/api/jobs/${job.jobId}/download`}
                        className="bg-emerald-600 text-white px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-emerald-700 transition-colors"
                      >
                        <Download size={16} />
                        Download ZIP
                      </a>
                    )}

                    {(job.status === "pending" || job.status === "crawling" || job.status === "capturing" || job.status === "zipping") && (
                      <button
                        onClick={cancelJob}
                        disabled={isCancelling}
                        className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {isCancelling ? <Loader2 className="animate-spin" size={14} /> : <Square size={14} />}
                        Stop
                      </button>
                    )}

                    {(job.status === "completed" || job.status === "failed" || job.status === "cancelled") && (
                      <button
                        onClick={() => { setJob(null); setUrl(""); setSelectedScreenshots(new Set()); }}
                        className="p-2 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
                        title="New Capture"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                  </div>

                  {job.error && (
                    <div className={`p-3 rounded-md text-sm flex items-start gap-2.5 ${
                      job.status === "cancelled" ? "bg-gray-50 text-gray-600" : "bg-red-50 text-red-700"
                    }`}>
                      {job.status === "cancelled" ? (
                        <Square size={16} className="shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      )}
                      <p>{job.error}</p>
                    </div>
                  )}

                  {/* Gallery Section */}
                  {job.screenshotNames && job.screenshotNames.length > 0 && (
                    <div className="mt-10 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="text-sm text-gray-500">Preview gallery</h3>
                          <p className="text-sm text-gray-400">{selectedScreenshots.size} items selected</p>
                        </div>
                        {selectedScreenshots.size > 0 && (
                          <button
                            onClick={downloadSelected}
                            disabled={isDownloadingSelected}
                            className="bg-[#9A3412] text-white px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 hover:bg-[#7C2D12] transition-colors disabled:opacity-50"
                          >
                            {isDownloadingSelected ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                            Download Selected ({selectedScreenshots.size})
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {job.screenshotNames.map((name) => (
                          <div
                            key={name}
                            onMouseEnter={() => setHoveredImage(name)}
                            onMouseLeave={() => setHoveredImage(null)}
                            onClick={() => toggleScreenshotSelection(name)}
                            className={`relative group aspect-[4/3] rounded-md overflow-hidden border cursor-pointer transition-colors ${
                              selectedScreenshots.has(name)
                                ? "border-[#9A3412] ring-2 ring-[#9A3412]/15"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <img
                              src={`/api/jobs/${job.jobId}/screenshots/${name}`}
                              alt={name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />

                            {hoveredImage === name && (
                              <div
                                className="fixed z-[100] pointer-events-none shadow-lg rounded-md overflow-hidden border border-gray-200 bg-white hidden md:block"
                                style={{
                                  width: job.device === "mobile" ? "195px" : "640px", // 50% of 390 or 1280
                                  maxHeight: "80vh",
                                  top: "50%",
                                  left: "50%",
                                  transform: "translate(-50%, -50%)"
                                }}
                              >
                                <div className="p-2 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
                                  <span>50% actual size preview</span>
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
                              </div>
                            )}
                            <div className={`absolute inset-0 bg-black/35 flex items-center justify-center transition-opacity ${
                              selectedScreenshots.has(name) ? "opacity-100" : "opacity-0"
                            }`}>
                              <CheckCircle2 className="text-white" size={28} />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/55 to-transparent">
                              <p className="text-[10px] text-white truncate opacity-90">{name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(summary || isGeneratingSummary) && (
                    <div className="mt-6 p-5 bg-indigo-50/50 rounded-md border border-indigo-100 space-y-2.5">
                      <div className="flex items-center gap-2 text-indigo-700 font-medium text-sm">
                        <Sparkles size={15} className={isGeneratingSummary ? "animate-pulse" : ""} />
                        <span>AI site summary</span>
                      </div>
                      <div className="text-sm text-indigo-900 leading-relaxed prose prose-sm prose-indigo max-w-none">
                        {isGeneratingSummary ? (
                          <div className="flex items-center gap-2 text-gray-400 italic">
                            <Loader2 size={13} className="animate-spin" />
                            Generating summary...
                          </div>
                        ) : (
                          <Markdown>{summary || ""}</Markdown>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Features/Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 border-t border-gray-200">
            {[
              { icon: <Globe size={18} />, title: "Smart Crawler", desc: "Automatically finds internal links to capture more than just the home page." },
              { icon: <Camera size={18} />, title: "Full Page", desc: "Captures the entire length of the page, not just the visible viewport." },
              { icon: <Download size={18} />, title: "ZIP Export", desc: "All screenshots are named and bundled into a single organized archive." }
            ].map((feature, i) => (
              <div key={i} className="space-y-2">
                <div className="w-9 h-9 rounded-md bg-gray-100 flex items-center justify-center text-gray-500">
                  {feature.icon}
                </div>
                <h4 className="text-sm font-semibold">{feature.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      <footer className="max-w-3xl mx-auto px-6 py-10 text-center space-y-3 border-t border-gray-200">
        <div className="text-xs text-gray-400">
          Built with precision & care &copy; {new Date().getFullYear()}
        </div>
        <div className="text-xs text-gray-400 leading-relaxed max-w-lg mx-auto">
          <p className="font-medium text-gray-500 mb-1">Disclaimer</p>
          <p>
            This tool is provided for personal and educational purposes only. Users are solely responsible for ensuring their use of this service complies with applicable copyright laws and the terms of service of the websites being captured. SiteSnap does not store or claim ownership of any content captured through this interface.
          </p>
        </div>
      </footer>
    </div>
  );
}
