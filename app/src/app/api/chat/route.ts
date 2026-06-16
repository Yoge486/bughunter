import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    const { scanId, message, history = [] } = await request.json();

    if (!scanId || !message) {
      return NextResponse.json(
        { error: "scanId and message are required" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key is not configured on the server." },
        { status: 500 }
      );
    }

    // Fetch scan and vulnerabilities to feed as context
    const supabase = await createServerSupabaseClient();
    
    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .select("*")
      .eq("id", scanId)
      .single();

    if (scanError || !scan) {
      return NextResponse.json(
        { error: "Scan not found or unauthorized access" },
        { status: 404 }
      );
    }

    const { data: vulnerabilities } = await supabase
      .from("vulnerabilities")
      .select("*")
      .eq("scan_id", scanId);

    // Build the system instruction with context
    const techStack = scan.technologies ? scan.technologies.join(", ") : "Unknown";
    const vulnsText = vulnerabilities && vulnerabilities.length > 0
      ? vulnerabilities.map((v: { severity: string, name: string, description: string, remediation: string }) => `- [${v.severity.toUpperCase()}] ${v.name}: ${v.description}\n  Remediation: ${v.remediation}`).join("\n")
      : "No security issues were detected on this site.";

    const systemInstruction = `You are BugHunter AI, an advanced security chatbot assistant.
You are helping the user understand and fix the security vulnerabilities found on their site: ${scan.target_url}.

Here is the context of the website scan:
- Target URL: ${scan.target_url}
- Security Score: ${scan.security_score}/100
- Technologies Detected: ${techStack}
- Vulnerabilities Found:
${vulnsText}

Your goal:
1. Provide extremely helpful, clear, and actionable advice to remediate the vulnerabilities list.
2. Give exact code snippets, configuration files (e.g., Nginx header configurations, Apache configs, helmet setup in Express, Next.js header configs) based on the user's technology stack.
3. Be professional, direct, and technical, but keep it accessible for developers.
4. If asked about things unrelated to this website's security, guide the user back to the vulnerabilities and securing their platform.`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction,
    });

    // Clean up history formats to ensure compatibility with Gemini SDK
    const formattedHistory = history.map((h: { role?: string; content?: string; text?: string; parts?: unknown[] }) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: Array.isArray(h.parts) ? h.parts : [{ text: h.content || h.text || "" }]
    }));

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return NextResponse.json({
      reply: responseText,
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "An error occurred during the chatbot response" },
      { status: 500 }
    );
  }
}
