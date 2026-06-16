"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Plus,
  Trash2,
  Clock,
  Globe,
  Github,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ScheduledScan {
  id: string;
  target_url: string;
  target_type: "url" | "github_repo";
  frequency: "daily" | "weekly";
  last_run: string | null;
  next_run: string;
  is_active: boolean;
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

export default function MonitoringPage() {
  const [monitors, setMonitors] = useState<ScheduledScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const supabase = createClient();

  // Form State
  const [targetUrl, setTargetUrl] = useState("");
  const [targetType, setTargetType] = useState<"url" | "github_repo">("url");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");

  const fetchMonitors = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("scheduled_scans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setMonitors(data);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMonitors();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const nextRun = new Date();
    if (frequency === "daily") {
      nextRun.setDate(nextRun.getDate() + 1);
    } else {
      nextRun.setDate(nextRun.getDate() + 7);
    }

    const { error } = await supabase.from("scheduled_scans").insert({
      user_id: user.id,
      target_url: targetUrl,
      target_type: targetType,
      frequency,
      next_run: nextRun.toISOString(),
      is_active: true,
    });

    if (error) {
      alert("Failed to add monitor");
    } else {
      setIsAdding(false);
      setTargetUrl("");
      fetchMonitors();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this monitor?")) return;
    await supabase.from("scheduled_scans").delete().eq("id", id);
    fetchMonitors();
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={stagger}
      className="max-w-6xl mx-auto space-y-8"
    >
      <motion.div variants={fadeUp} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Activity className="w-8 h-8 text-accent-cyan" /> Real-Time Monitoring
          </h1>
          <p className="text-text-secondary">
            Schedule automated scans to continuously monitor your assets for vulnerabilities.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Monitor
        </button>
      </motion.div>

      {/* Add Monitor Form */}
      {isAdding && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          onSubmit={handleAddMonitor}
          className="glass-card p-6 border-accent-cyan/30 overflow-hidden"
        >
          <h2 className="text-lg font-semibold mb-4">Create New Monitor</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-text-secondary mb-1">Target URL or Repo</label>
              <div className="relative">
                {targetType === "url" ? (
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                ) : (
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                )}
                <input
                  type="url"
                  required
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder={targetType === "url" ? "Enter website URL" : "Enter GitHub repository URL"}
                  className="input-field !pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Type</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as "url" | "github_repo")}
                className="input-field appearance-none"
              >
                <option value="url">Website URL</option>
                <option value="github_repo">GitHub Repo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as "daily" | "weekly")}
                className="input-field appearance-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3 justify-end">
            <button type="button" onClick={() => setIsAdding(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Monitor
            </button>
          </div>
        </motion.form>
      )}

      {/* Monitors List */}
      <motion.div variants={fadeUp} className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
             <div className="w-8 h-8 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
          </div>
        ) : monitors.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium">No active monitors</h3>
            <p className="text-text-secondary mt-2">
              Set up a monitor to scan your assets automatically on a schedule.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Frequency</th>
                  <th>Last Run</th>
                  <th>Next Run</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {monitors.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {m.target_type === "url" ? (
                           <Globe className="w-4 h-4 text-text-muted" />
                        ) : (
                           <Github className="w-4 h-4 text-text-muted" />
                        )}
                        <span className="font-medium truncate max-w-[200px]">{m.target_url}</span>
                      </div>
                    </td>
                    <td>
                      <span className="capitalize text-sm">{m.frequency}</span>
                    </td>
                    <td className="text-sm text-text-secondary">
                      {m.last_run ? new Date(m.last_run).toLocaleDateString() : "Never"}
                    </td>
                    <td className="text-sm text-text-secondary">
                      {new Date(m.next_run).toLocaleDateString()}
                    </td>
                    <td>
                      {m.is_active ? (
                        <span className="badge badge-low flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="badge badge-medium flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" /> Paused
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-2 text-text-muted hover:text-severity-critical transition-colors rounded-lg hover:bg-severity-critical/10"
                        title="Delete Monitor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
