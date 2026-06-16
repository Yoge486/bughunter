"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  Info
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

interface Vulnerability {
  id: string;
  name: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
}

interface ScanRecord {
  id: string;
  target_url: string;
  security_score: number | null;
  status: string;
  created_at: string;
}

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

export default function ReportsPage() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user scans
      const { data: userScans } = await supabase
        .from("scans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (userScans) {
        setScans(userScans);

        // Extract scan IDs to fetch related vulnerabilities
        const scanIds = userScans.map((s) => s.id);

        if (scanIds.length > 0) {
          const { data: userVulns } = await supabase
            .from("vulnerabilities")
            .select("id, name, severity, category")
            .in("scan_id", scanIds);

          if (userVulns) {
            setVulnerabilities(userVulns);
          }
        }
      }
      setLoading(false);
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCSV = () => {
    if (vulnerabilities.length === 0) {
      alert("No vulnerabilities to export!");
      return;
    }

    // Prepare CSV data
    const headers = ["Severity", "Category", "Vulnerability Name"];
    const rows = vulnerabilities.map((v) => [
      v.severity.toUpperCase(),
      v.category,
      `"${v.name.replace(/"/g, '""')}"`, // Escape quotes
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `bughunter_vulnerabilities_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
      </div>
    );
  }

  const completedScans = scans.filter((s) => s.status === "completed" && s.security_score !== null);
  const avgScore = completedScans.length > 0
    ? Math.round(completedScans.reduce((sum, s) => sum + (s.security_score || 0), 0) / completedScans.length)
    : 0;

  const severityCounts = {
    critical: vulnerabilities.filter((v) => v.severity === "critical").length,
    high: vulnerabilities.filter((v) => v.severity === "high").length,
    medium: vulnerabilities.filter((v) => v.severity === "medium").length,
    low: vulnerabilities.filter((v) => v.severity === "low").length,
    info: vulnerabilities.filter((v) => v.severity === "info").length,
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
            <FileText className="w-8 h-8 text-accent-purple" /> Reports
          </h1>
          <p className="text-text-secondary">
            Aggregate vulnerability data and performance metrics across all your scans.
          </p>
        </div>
        <button onClick={handleExportCSV} className="btn-primary flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </motion.div>

      {/* Aggregate Stats Grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3 text-text-secondary">
            <ShieldCheck className="w-5 h-5 text-accent-cyan" />
            <span className="text-sm font-medium">Completed Scans</span>
          </div>
          <p className="text-3xl font-bold">{completedScans.length}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3 text-text-secondary">
            <TrendingUp className="w-5 h-5 text-accent-cyan" />
            <span className="text-sm font-medium">Average Score</span>
          </div>
          <p className="text-3xl font-bold">{avgScore}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3 text-text-secondary">
            <ShieldAlert className="w-5 h-5 text-severity-critical" />
            <span className="text-sm font-medium">Critical Issues</span>
          </div>
          <p className="text-3xl font-bold">{severityCounts.critical}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3 text-text-secondary">
            <AlertTriangle className="w-5 h-5 text-severity-high" />
            <span className="text-sm font-medium">High Issues</span>
          </div>
          <p className="text-3xl font-bold">{severityCounts.high}</p>
        </div>
      </motion.div>

      {/* Visual Charts */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Severity Doughnut */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 text-white">Severity Breakdown</h2>
          {vulnerabilities.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-text-muted">No data available</div>
          ) : (
            <div className="h-64 relative flex justify-center">
              <Doughnut 
                data={{
                  labels: ["Critical", "High", "Medium", "Low", "Info"],
                  datasets: [{
                    data: [severityCounts.critical, severityCounts.high, severityCounts.medium, severityCounts.low, severityCounts.info],
                    backgroundColor: ["#ff1744", "#ff6d00", "#ffc400", "#00e676", "#00bbf9"],
                    borderWidth: 0,
                    hoverOffset: 4
                  }]
                }} 
                options={{
                  maintainAspectRatio: false,
                  cutout: "70%",
                  plugins: {
                    legend: { position: "right", labels: { color: "rgba(255,255,255,0.7)", padding: 20 } }
                  }
                }} 
              />
            </div>
          )}
        </div>

        {/* Categories Bar */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 text-white">Top Categories</h2>
          {vulnerabilities.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-text-muted">No data available</div>
          ) : (
            <div className="h-64 relative">
              <Bar 
                data={{
                  labels: Object.entries(
                    vulnerabilities.reduce((acc, v) => {
                      acc[v.category] = (acc[v.category] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).sort(([, a], [, b]) => b - a).slice(0, 5).map(([cat]) => cat.replace(/_/g, ' ')),
                  datasets: [{
                    label: "Issues Found",
                    data: Object.entries(
                      vulnerabilities.reduce((acc, v) => {
                        acc[v.category] = (acc[v.category] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).sort(([, a], [, b]) => b - a).slice(0, 5).map(([, count]) => count),
                    backgroundColor: "#9b5de5",
                    borderRadius: 4
                  }]
                }}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "rgba(255,255,255,0.5)", stepSize: 1 } },
                    x: { grid: { display: false }, ticks: { color: "rgba(255,255,255,0.5)", maxRotation: 45, minRotation: 45 } }
                  }
                }}
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* Vulnerability Breakdown */}
      <motion.div variants={fadeUp} className="glass-card overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold">Vulnerability Breakdown</h2>
          <p className="text-sm text-text-secondary mt-1">Total issues found across all your domains.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-severity-critical/10 border border-severity-critical/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-sm text-severity-critical font-semibold uppercase tracking-wider mb-2">Critical</span>
            <span className="text-4xl font-bold text-severity-critical">{severityCounts.critical}</span>
          </div>
          <div className="bg-severity-high/10 border border-severity-high/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-sm text-severity-high font-semibold uppercase tracking-wider mb-2">High</span>
            <span className="text-4xl font-bold text-severity-high">{severityCounts.high}</span>
          </div>
          <div className="bg-severity-medium/10 border border-severity-medium/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-sm text-severity-medium font-semibold uppercase tracking-wider mb-2">Medium</span>
            <span className="text-4xl font-bold text-severity-medium">{severityCounts.medium}</span>
          </div>
          <div className="bg-severity-low/10 border border-severity-low/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-sm text-severity-low font-semibold uppercase tracking-wider mb-2">Low</span>
            <span className="text-4xl font-bold text-severity-low">{severityCounts.low}</span>
          </div>
          <div className="bg-severity-info/10 border border-severity-info/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-sm text-severity-info font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" /> Info
            </span>
            <span className="text-4xl font-bold text-severity-info">{severityCounts.info}</span>
          </div>
        </div>
      </motion.div>

      {/* Categories Summary */}
      <motion.div variants={fadeUp} className="glass-card overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold">Common Categories</h2>
        </div>
        <div className="p-6">
          {vulnerabilities.length === 0 ? (
            <p className="text-text-secondary text-center">No vulnerabilities found yet.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(
                vulnerabilities.reduce((acc, v) => {
                  acc[v.category] = (acc[v.category] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              )
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
                    <span className="font-medium capitalize">{category.replace(/_/g, " ")}</span>
                    <span className="badge badge-info">{count} issues</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
