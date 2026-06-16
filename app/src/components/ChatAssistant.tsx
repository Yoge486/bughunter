"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatAssistantProps {
  scanId: string;
  targetUrl: string;
}

export default function ChatAssistant({ scanId, targetUrl }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hello! I am your BugHunter AI Security Assistant. I've analyzed the scan details for **${targetUrl}**. How can I help you remediate the vulnerabilities found?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId,
          message: userMessage,
          history: messages.map((m) => ({
            role: m.role,
            parts: [{ text: m.content }],
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from AI");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error connecting to the AI server. Please make sure your Gemini API key is valid and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-accent-cyan to-accent-purple flex items-center justify-center shadow-lg hover:shadow-cyan-500/20 text-white cursor-pointer group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
      >
        <MessageSquare className="w-6 h-6 group-hover:rotate-6 transition-transform" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
        </span>
      </motion.button>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black z-40 cursor-pointer"
            />

            {/* Chat Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-[#0d1527]/95 border-l border-white/[0.08] backdrop-blur-xl z-50 flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-accent-cyan/15 to-accent-purple/15 border border-accent-cyan/35 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-accent-cyan animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm flex items-center gap-1.5">
                      BugHunter AI Assistant
                    </h3>
                    <p className="text-xs text-text-secondary truncate max-w-[280px]">
                      Remediating {targetUrl}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-text-muted hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-accent-purple/10 border border-accent-purple/25 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-accent-purple" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-accent-cyan/20 to-accent-purple/10 border border-accent-cyan/30 text-white rounded-tr-none"
                          : "bg-white/[0.03] border border-white/[0.06] text-text-secondary rounded-tl-none"
                      }`}
                    >
                      <ReactMarkdown
                        components={{
                          pre: ({ node: _node, ...props }) => (
                            <div className="relative mt-2 rounded-lg overflow-x-auto bg-black/50 border border-white/[0.08] p-3 font-mono text-xs text-cyan-400">
                              <pre {...props} />
                            </div>
                          ),
                          code: ({ node: _node, ...props }) => (
                            <code className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-xs text-cyan-400" {...props} />
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/25 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-accent-cyan" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-lg bg-accent-purple/10 border border-accent-purple/25 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-accent-purple" />
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-tl-none p-4 flex items-center gap-2 text-sm text-text-secondary">
                      <Loader2 className="w-4 h-4 animate-spin text-accent-cyan" />
                      AI is formulating remediation steps...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <form
                onSubmit={handleSend}
                className="p-4 border-t border-white/[0.08] bg-white/[0.01] flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask how to fix a vulnerability..."
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent-cyan/50"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="w-11 h-11 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-purple flex items-center justify-center text-white disabled:opacity-50 hover:shadow-cyan-500/15 transition-shadow cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
