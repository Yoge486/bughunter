"use client";

import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scan,
  Shield,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  RefreshCw,
  Loader2,
  Globe,
  Github,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import ChatAssistant from "@/components/ChatAssistant";

interface Vulnerability {
  id?: string;
  name: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  remediation: string;
  ai_explanation?: string;
}

interface ScanResult {
  id?: string;
  target_url: string;
  security_score: number;
  vulnerabilities: Vulnerability[];
  headers_checked: Record<string, unknown>;
  technologies: string[];
  scan_duration_ms: number;
}

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const severityIcons = {
  critical: AlertTriangle,
  high: AlertTriangle,
  medium: Info,
  low: CheckCircle,
  info: Info,
};

function ScannerContent() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState(searchParams.get("url") || "");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [expandedVuln, setExpandedVuln] = useState<number | null>(null);
  const [scanType, setScanType] = useState<"url" | "github">("url");

  const handleScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url) return;

    setScanning(true);
    setError("");
    setResult(null);
    setProgress(0);

    const steps = scanType === "url" 
      ? [
          { p: 10, label: "Resolving DNS..." },
          { p: 25, label: "Checking SSL/TLS..." },
          { p: 40, label: "Analyzing security headers..." },
          { p: 55, label: "Detecting technologies..." },
          { p: 70, label: "Scanning for vulnerabilities..." },
          { p: 85, label: "Running AI analysis..." },
          { p: 95, label: "Generating report..." },
        ]
      : [
          { p: 10, label: "Connecting to GitHub API..." },
          { p: 30, label: "Fetching repository tree..." },
          { p: 50, label: "Analyzing codebase files..." },
          { p: 70, label: "Detecting hardcoded secrets & SAST..." },
          { p: 85, label: "Running AI code review..." },
          { p: 95, label: "Generating report..." },
        ];

    // Animate progress
    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
      setProgress(step.p);
      setProgressLabel(step.label);
    }

    try {
      const endpoint = scanType === "url" ? "/api/scan" : "/api/scan/github";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Scan failed");
      }

      const data = await response.json();
      setProgress(100);
      setProgressLabel("Scan complete!");

      await new Promise((r) => setTimeout(r, 500));
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("url")) {
      setTimeout(() => {
        handleScan();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Security Scanner</h1>
        <p className="text-text-secondary">
          Enter a website URL or GitHub repository to scan for vulnerabilities
        </p>
      </div>

      {/* Target Type Tabs */}
      <div className="flex items-center gap-2 bg-white/[0.02] p-1 rounded-xl w-fit border border-white/[0.05]">
        <button
          onClick={() => setScanType("url")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            scanType === "url" ? "bg-accent-cyan/10 text-accent-cyan" : "text-text-secondary hover:text-white hover:bg-white/5"
          }`}
        >
          <Globe className="w-4 h-4" /> Website URL
        </button>
        <button
          onClick={() => setScanType("github")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            scanType === "github" ? "bg-accent-purple/10 text-accent-purple" : "text-text-secondary hover:text-white hover:bg-white/5"
          }`}
        >
          <Github className="w-4 h-4" /> GitHub Repository
        </button>
      </div>

      {/* Target Input */}
      <form onSubmit={handleScan} className="glass-card p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            {scanType === "url" ? (
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            ) : (
              <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            )}
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={scanType === "url" ? "Enter website URL" : "Enter GitHub repository URL"}
              className="input-field !pl-12"
              required
              disabled={scanning}
              id="scan-url-input"
            />
          </div>
          <button
            type="submit"
            disabled={scanning}
            className="btn-primary flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
            id="start-scan-btn"
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Scanning...
              </>
            ) : (
              <>
                <Scan className="w-4 h-4" /> Start Scan
              </>
            )}
          </button>
        </div>
      </form>

      {/* Scanning Animation */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card p-10 text-center"
          >
            {/* Radar Animation */}
            <div className="relative w-40 h-40 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border border-accent-cyan/20" />
              <div className="absolute inset-4 rounded-full border border-accent-cyan/15" />
              <div className="absolute inset-8 rounded-full border border-accent-cyan/10" />
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <div
                  className="absolute top-1/2 left-1/2 w-1/2 h-1 origin-left animate-radar"
                  style={{
                    background:
                      "linear-gradient(90deg, #00f5d4 0%, transparent 100%)",
                  }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="w-10 h-10 text-accent-cyan" />
              </div>
              {/* Pulse rings */}
              <div className="absolute inset-0 rounded-full border border-accent-cyan/30 animate-pulse-ring" />
              <div
                className="absolute inset-0 rounded-full border border-accent-cyan/20 animate-pulse-ring"
                style={{ animationDelay: "0.5s" }}
              />
            </div>

            {/* Progress */}
            <div className="max-w-sm mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">
                  {progressLabel}
                </span>
                <span className="text-sm font-mono text-accent-cyan">
                  {progress}%
                </span>
              </div>
              <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, #00f5d4, #00bbf9)",
                  }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 border-severity-critical/20"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-severity-critical flex-shrink-0" />
            <div>
              <p className="font-medium text-severity-critical">Scan Failed</p>
              <p className="text-sm text-text-secondary mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={handleScan}
            className="btn-secondary mt-4 flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Retry Scan
          </button>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Score Card */}
            <div className="glass-card p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Score Gauge */}
                <div className="score-gauge flex-shrink-0">
                  <svg width="180" height="180" viewBox="0 0 180 180">
                    <circle
                      cx="90"
                      cy="90"
                      r="78"
                      fill="none"
                      stroke="rgba(148,163,184,0.1)"
                      strokeWidth="10"
                    />
                    <motion.circle
                      cx="90"
                      cy="90"
                      r="78"
                      fill="none"
                      stroke={ScoreToColor(result.security_score)}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 78}`}
                      initial={{
                        strokeDashoffset: 2 * Math.PI * 78,
                      }}
                      animate={{
                        strokeDashoffset:
                          2 * Math.PI * 78 * (1 - result.security_score / 100),
                      }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
                    />
                  </svg>
                  <span className="score-value text-4xl">
                    {result.security_score}
                  </span>
                  <span className="score-label">Score</span>
                </div>

                {/* Summary */}
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-2xl font-bold mb-2">
                    {result.target_url}
                  </h2>
                  <p className="text-text-secondary mb-4">
                    Scan completed in{" "}
                    {(result.scan_duration_ms / 1000).toFixed(1)}s •{" "}
                    {result.vulnerabilities.length} issues found
                  </p>

                  {/* Severity Summary */}
                  <div className="flex flex-wrap gap-2">
                    {(
                      ["critical", "high", "medium", "low", "info"] as const
                    ).map((sev) => {
                      const count = result.vulnerabilities.filter(
                        (v) => v.severity === sev
                      ).length;
                      if (count === 0) return null;
                      return (
                        <span key={sev} className={`badge badge-${sev}`}>
                          {count} {sev}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Vulnerabilities List */}
            <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-semibold">
                  Vulnerabilities Found
                </h2>
              </div>

              <div className="divide-y divide-border">
                {result.vulnerabilities
                  .sort(
                    (a, b) =>
                      severityOrder[a.severity] - severityOrder[b.severity]
                  )
                  .map((vuln, i) => {
                    const Icon = severityIcons[vuln.severity];
                    const isExpanded = expandedVuln === i;

                    return (
                      <div key={i} className="transition-colors hover:bg-white/[0.01]">
                        <button
                          onClick={() =>
                            setExpandedVuln(isExpanded ? null : i)
                          }
                          className="w-full p-5 flex items-center gap-4 text-left"
                        >
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0`}
                            style={{
                              background: `var(--color-severity-${vuln.severity})12`,
                              border: `1px solid var(--color-severity-${vuln.severity})25`,
                            }}
                          >
                            <Icon
                              className="w-4 h-4"
                              style={{
                                color: `var(--color-severity-${vuln.severity})`,
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium">{vuln.name}</h3>
                            <p className="text-sm text-text-secondary truncate">
                              {vuln.description}
                            </p>
                          </div>
                          <span className={`badge badge-${vuln.severity}`}>
                            {vuln.severity}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-text-muted" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-text-muted" />
                          )}
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-5 pb-5 pl-18 space-y-4">
                                <div className="p-4 rounded-xl bg-bg-secondary">
                                  <h4 className="text-sm font-semibold text-accent-cyan mb-2">
                                    📝 Description
                                  </h4>
                                  <p className="text-sm text-text-secondary leading-relaxed">
                                    {vuln.description}
                                  </p>
                                </div>

                                <div className="p-4 rounded-xl bg-bg-secondary">
                                  <h4 className="text-sm font-semibold text-severity-low mb-2">
                                    🔧 Remediation
                                  </h4>
                                  <p className="text-sm text-text-secondary leading-relaxed">
                                    {vuln.remediation}
                                  </p>
                                </div>

                                {vuln.ai_explanation && (
                                  <div className="p-4 rounded-xl bg-accent-purple/5 border border-accent-purple/15">
                                    <h4 className="text-sm font-semibold text-accent-purple mb-2">
                                      🤖 AI Analysis
                                    </h4>
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                      {vuln.ai_explanation}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleScan}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Rescan
              </button>
              <button
                onClick={() => {
                  if (result.id) {
                    window.location.href = `/history/${result.id}`;
                  }
                }}
                className="btn-primary flex items-center gap-2"
              >
                View Full Report <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {result.id && (
              <ChatAssistant scanId={result.id} targetUrl={result.target_url} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ScoreToColor(score: number): string {
  if (score >= 90) return "#00e676";
  if (score >= 70) return "#ffc400";
  return "#ff1744";
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-text-secondary">Loading scanner...</div>}>
      <ScannerContent />
    </Suspense>
  );
}
