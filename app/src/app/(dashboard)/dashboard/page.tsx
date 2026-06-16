"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Scan,
  Shield,
  AlertTriangle,
  FileText,
  TrendingUp,
  ArrowRight,
  ExternalLink,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

interface ScanRecord {
  id: string;
  target_url: string;
  security_score: number | null;
  status: string;
  created_at: string;
}

function ScoreColor(score: number | null) {
  if (score === null) return "#64748b";
  if (score >= 90) return "#00e676";
  if (score >= 70) return "#ffc400";
  return "#ff1744";
}

function ScoreLabel(score: number | null) {
  if (score === null) return "N/A";
  if (score >= 90) return "Secure";
  if (score >= 70) return "Medium";
  return "High Risk";
}

export default function DashboardPage() {
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [historicalScans, setHistoricalScans] = useState<ScanRecord[]>([]);
  const [stats, setStats] = useState({
    totalScans: 0,
    avgScore: 0,
    vulnerabilities: 0,
    reports: 0,
  });
  const [quickUrl, setQuickUrl] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Fetch recent scans
      const { data: scans } = await supabase
        .from("scans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (scans) {
        setRecentScans(scans);

        // Calculate stats
        const completedScans = scans.filter(
          (s: ScanRecord) => s.status === "completed" && s.security_score !== null
        );
        const avgScore =
          completedScans.length > 0
            ? Math.round(
                completedScans.reduce(
                  (sum: number, s: ScanRecord) => sum + (s.security_score || 0),
                  0
                ) / completedScans.length
              )
            : 0;

        // Fetch vulnerability count
        const { count: vulnCount } = await supabase
          .from("vulnerabilities")
          .select("*", { count: "exact", head: true });

        setStats({
          totalScans: scans.length,
          avgScore,
          vulnerabilities: vulnCount || 0,
          reports: completedScans.length,
        });
      }

      // Fetch historical scans for chart (last 10 completed scans)
      const { data: chartData } = await supabase
        .from("scans")
        .select("*")
        .eq("status", "completed")
        .not("security_score", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (chartData) {
        setHistoricalScans([...chartData].reverse());
      }
    };

    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuickScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickUrl) {
      router.push(`/scanner?url=${encodeURIComponent(quickUrl)}`);
    }
  };

  const statCards = [
    {
      icon: Scan,
      label: "Total Scans",
      value: stats.totalScans,
      color: "#00f5d4",
    },
    {
      icon: AlertTriangle,
      label: "Vulnerabilities",
      value: stats.vulnerabilities,
      color: "#ff6d00",
    },
    {
      icon: TrendingUp,
      label: "Avg Score",
      value: stats.avgScore || "—",
      color: "#00bbf9",
    },
    {
      icon: FileText,
      label: "Reports",
      value: stats.reports,
      color: "#9b5de5",
    },
  ];

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.5)",
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.5)",
        },
      },
    },
  };

  const lineChartData = {
    labels: historicalScans.map((s) => {
      try {
        const urlObj = new URL(s.target_url);
        return `${urlObj.hostname.slice(0, 15)} (${new Date(
          s.created_at
        ).toLocaleDateString(undefined, { month: "short", day: "numeric" })})`;
      } catch {
        return `${s.target_url.slice(0, 15)} (${new Date(
          s.created_at
        ).toLocaleDateString(undefined, { month: "short", day: "numeric" })})`;
      }
    }),
    datasets: [
      {
        fill: true,
        label: "Security Score",
        data: historicalScans.map((s) => s.security_score || 0),
        borderColor: "#00f5d4",
        backgroundColor: "rgba(0, 245, 212, 0.05)",
        tension: 0.4,
      },
    ],
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={stagger}
      className="max-w-6xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-text-secondary">
          Overview of your security scanning activity
        </p>
      </motion.div>

      {/* Quick Scan */}
      <motion.div variants={fadeUp}>
        <form
          onSubmit={handleQuickScan}
          className="glass-card p-6 flex flex-col sm:flex-row gap-4"
        >
          <div className="flex-1 relative">
            <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="url"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="Enter website URL to scan"
              className="input-field !pl-12"
              required
              id="quick-scan-url"
            />
          </div>
          <button
            type="submit"
            className="btn-primary flex items-center gap-2 whitespace-nowrap cursor-pointer"
            id="quick-scan-btn"
          >
            <Scan className="w-4 h-4" /> Quick Scan
          </button>
        </form>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statCards.map((stat, i) => (
          <div key={i} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `${stat.color}12`,
                  border: `1px solid ${stat.color}25`,
                }}
              >
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-text-secondary mt-1">{stat.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Trend Chart */}
      {historicalScans.length > 1 && (
        <motion.div variants={fadeUp} className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 text-white">Security Score Trend</h2>
          <div className="h-64 w-full relative">
            <Line data={lineChartData} options={chartOptions} />
          </div>
        </motion.div>
      )}

      {/* Recent Scans */}
      <motion.div variants={fadeUp} className="glass-card overflow-hidden">
        <div className="p-6 flex items-center justify-between border-b border-border">
          <h2 className="text-lg font-semibold">Recent Scans</h2>
          <Link
            href="/history"
            className="text-sm text-accent-cyan hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentScans.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Scans Yet</h3>
            <p className="text-text-secondary mb-6">
              Start by scanning a website to see results here
            </p>
            <Link
              href="/scanner"
              className="btn-primary inline-flex items-center gap-2"
            >
              <Scan className="w-4 h-4" /> Start Your First Scan
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Website</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((scan) => (
                  <tr key={scan.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <ExternalLink className="w-4 h-4 text-text-muted flex-shrink-0" />
                        <span className="truncate max-w-[250px]">
                          {scan.target_url}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="font-bold font-mono"
                        style={{ color: ScoreColor(scan.security_score) }}
                      >
                        {scan.security_score ?? "—"}
                      </span>
                      <span
                        className="text-xs ml-2"
                        style={{ color: ScoreColor(scan.security_score) }}
                      >
                        {ScoreLabel(scan.security_score)}
                      </span>
                    </td>
                    <td>
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
                    </td>
                    <td>
                      <div className="flex items-center gap-2 text-text-secondary text-sm">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(scan.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/history/${scan.id}`}
                        className="text-accent-cyan text-sm hover:underline"
                      >
                        Details
                      </Link>
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
