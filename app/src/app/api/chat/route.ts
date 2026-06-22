import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { scanId, message, history = [] } = await request.json();

    if (!scanId || !message) {
      return NextResponse.json(
        { error: "scanId and message are required" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Anthropic API key is not configured on the server." },
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

    // Format history safely for Anthropic: must start with user, alternate roles, and have non-empty content
    const formattedHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const h of history) {
      const role = h.role === "assistant" ? "assistant" : "user";
      const content = h.content || h.text || "";
      if (!content.trim()) continue;

      if (formattedHistory.length === 0) {
        if (role === "user") {
          formattedHistory.push({ role, content });
        }
      } else {
        const last = formattedHistory[formattedHistory.length - 1];
        if (last.role === role) {
          last.content += "\n" + content;
        } else {
          formattedHistory.push({ role, content });
        }
      }
    }

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [...formattedHistory];
    if (messages.length > 0 && messages[messages.length - 1].role === "user") {
      messages[messages.length - 1].content += "\n" + message;
    } else {
      messages.push({ role: "user", content: message });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: systemInstruction,
        messages: messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Anthropic API error: ${response.status} - ${errorText}` },
        { status: 500 }
      );
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        if (!reader) {
          controller.close();
          return;
        }

        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed.startsWith("data: ")) {
                const dataStr = trimmed.slice(6);
                if (dataStr === "[DONE]") continue;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.type === "content_block_delta" && data.delta?.text) {
                    controller.enqueue(encoder.encode(data.delta.text));
                  }
                } catch {
                  // Ignore JSON parse errors for incomplete lines
                }
              }
            }
          }
          if (buffer.trim().startsWith("data: ")) {
            const dataStr = buffer.trim().slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.type === "content_block_delta" && data.delta?.text) {
                controller.enqueue(encoder.encode(data.delta.text));
              }
            } catch {}
          }
        } catch (e) {
          controller.error(e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "An error occurred during the chatbot response" },
      { status: 500 }
    );
  }
}
