"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      {/* Background decoration */}
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-accent-cyan/[0.03] blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-accent-blue/[0.03] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center justify-center gap-3 mb-10 group"
        >
          <div className="relative">
            <Shield className="w-10 h-10 text-accent-cyan" />
            <div className="absolute inset-0 bg-accent-cyan/20 blur-xl rounded-full" />
          </div>
          <span className="text-2xl font-bold">
            Bug<span className="text-gradient">Hunter</span> AI
          </span>
        </Link>

        {/* Login Card */}
        <div className="glass-card-static p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
            <p className="text-text-secondary">
              Sign in to access your security dashboard
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-severity-critical/10 border border-severity-critical/20 mb-6"
            >
              <AlertCircle className="w-5 h-5 text-severity-critical flex-shrink-0" />
              <p className="text-sm text-severity-critical">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="input-field !pl-12"
                  required
                  id="login-email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-field !pl-12"
                  required
                  id="login-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              id="login-submit"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-text-secondary text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-accent-cyan hover:underline font-medium"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
