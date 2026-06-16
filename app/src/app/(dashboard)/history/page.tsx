"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Clock,
  Trash2,
  Shield,
  Scan,
  Search,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface ScanRecord {
  id: string;
  target_url: string;
  security_score: number | null;
  status: string;
  scan_duration_ms: number | null;
  created_at: string;
  technologies: string[];
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

function ScoreColor(score: number | null) {
  if (score === null) return "#64748b";
  if (score >= 90) return "#00e676";
  if (score >= 70) return "#ffc400";
  return "#ff1744";
}

export default function HistoryPage() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  useEffect(() => {
    const fetchScans = async () => {
      const { data } = await supabase
        .from("scans")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setScans(data);
      setLoading(false);
    };

    fetchScans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteScan = async (id: string) => {
    await supabase.from("scans").delete().eq("id", id);
    setScans(scans.filter((s) => s.id !== id));
  };

  const filteredScans = scans.filter((s) =>
    s.target_url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={{ animate: { transition: { staggerChildren: 0.08 } } }}
      className="max-w-6xl mx-auto space-y-8"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-3xl font-bold mb-2">Scan History</h1>
        <p className="text-text-secondary">
          View and manage your previous security scans
        </p>
      </motion.div>

      {/* Search */}
      <motion.div variants={fadeUp} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by URL..."
          className="input-field !pl-12"
          id="history-search"
        />
      </motion.div>

      {/* Scans List */}
      <motion.div variants={fadeUp}>
        {loading ? (
          <div className="glass-card p-12 text-center">
            <div className="w-8 h-8 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin mx-auto mb-4" />
            <p className="text-text-secondary">Loading scan history...</p>
          </div>
        ) : filteredScans.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Shield className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {search ? "No Matching Scans" : "No Scans Yet"}
            </h3>
            <p className="text-text-secondary mb-6">
              {search
                ? "Try a different search term"
                : "Start by scanning a website from the Scanner page"}
            </p>
            {!search && (
              <Link
                href="/scanner"
                className="btn-primary inline-flex items-center gap-2"
              >
                <Scan className="w-4 h-4" /> Go to Scanner
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredScans.map((scan) => (
              <motion.div
                key={scan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
              >
                {/* Score */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-lg font-mono"
                  style={{
                    background: `${ScoreColor(scan.security_score)}12`,
                    color: ScoreColor(scan.security_score),
                    border: `1px solid ${ScoreColor(scan.security_score)}30`,
                  }}
                >
                  {scan.security_score ?? "—"}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/history/${scan.id}`}
                    className="font-medium hover:text-accent-cyan transition-colors truncate block"
                  >
                    {scan.target_url}
                  </Link>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-text-secondary">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(scan.created_at).toLocaleString()}
                    </span>
                    {scan.scan_duration_ms && (
                      <span>
                        {(scan.scan_duration_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                    <span
                      className={`badge ${
                        scan.status === "completed"
                          ? "badge-low"
                          : scan.status === "failed"
                            ? "badge-critical"
                            : "badge-info"
                      }`}
                    >
                      {scan.status}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/history/${scan.id}`}
                    className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </Link>
                  <button
                    onClick={() => deleteScan(scan.id)}
                    className="p-2 rounded-lg text-text-muted hover:text-severity-critical hover:bg-severity-critical/10 transition-colors"
                    title="Delete scan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
