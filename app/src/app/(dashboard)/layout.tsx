"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  LayoutDashboard,
  Scan,
  History,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scanner", label: "Scanner", icon: Scan },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/history", label: "Scan History", icon: History },
  { href: "/reports", label: "Reports", icon: FileText },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser({
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0],
        });
      }
    };
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-[260px] z-50 flex flex-col
          glass-card-static border-r border-border rounded-none transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo */}
        <div className="p-6 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="relative">
              <Shield className="w-7 h-7 text-accent-cyan" />
              <div className="absolute inset-0 bg-accent-cyan/20 blur-lg rounded-full" />
            </div>
            <span className="text-lg font-bold">
              Bug<span className="text-gradient">Hunter</span>
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-text-secondary hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? "active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-border">
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-accent-cyan/15 flex items-center justify-center border border-accent-cyan/20">
                <User className="w-4 h-4 text-accent-cyan" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.full_name || "User"}
                </p>
                <p className="text-xs text-text-muted truncate">
                  {user?.email || ""}
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-text-muted transition-transform ${profileOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute bottom-full left-0 right-0 mb-2 glass-card p-2"
                >
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-severity-critical hover:bg-severity-critical/10 transition-colors text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen">
        {/* Top Bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-30 px-4 py-3 glass-card-static rounded-none border-b border-border flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent-cyan" />
            <span className="font-bold">BugHunter</span>
          </Link>
          <div className="w-9" />
        </header>

        {/* Page Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="p-6 lg:p-8"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
