import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const responseData = await response.json();
  return responseData.content[0].text;
}

function scanForSecrets(content: string, filePath: string) {
  const secrets = [];
  const patterns = [
    { name: "AWS Access Key", regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g, severity: "critical" },
    { name: "Stripe Secret Key", regex: /sk_(live|test)_[0-9a-zA-Z]{24}/g, severity: "critical" },
    { name: "Google API Key", regex: /AIza[0-9A-Za-z-_]{35}/g, severity: "high" },
    { name: "Generic Secret / Token", regex: /(secret|token|password|api_key|access_token)["'\s:=]+(["'][a-zA-Z0-9\-_]{16,}["'])/gi, severity: "medium" },
    { name: "RSA Private Key", regex: /-----BEGIN RSA PRIVATE KEY-----/g, severity: "critical" }
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern.regex);
    if (matches && matches.length > 0) {
      secrets.push({
        name: `Hardcoded ${pattern.name}`,
        description: `Found potential hardcoded secret matching ${pattern.name} in file: ${filePath}`,
        severity: pattern.severity as "critical"|"high"|"medium"|"low"|"info",
        category: "sast",
        remediation: "Remove the hardcoded secret from the source code. Use environment variables or a secure secrets manager instead.",
        ai_explanation: "Hardcoding secrets into source code allows anyone with access to the codebase to use these credentials, potentially leading to unauthorized access and data breaches."
      });
    }
  }
  return secrets;
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes("github.com")) {
      return NextResponse.json({ error: "Invalid GitHub URL provided" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return NextResponse.json({ error: "Invalid GitHub Repository URL" }, { status: 400 });
    }
    
    const owner = parts[0];
    const repo = parts[1];
    const startTime = Date.now();

    const githubHeaders = {
      "User-Agent": "BugHunter-AI",
      ...(process.env.GITHUB_ACCESS_TOKEN ? { "Authorization": `token ${process.env.GITHUB_ACCESS_TOKEN}` } : {})
    };

    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: githubHeaders });
    
    if (!repoRes.ok) {
      return NextResponse.json({ error: "Could not access repository. It may be private or not exist. If private, configure GITHUB_ACCESS_TOKEN." }, { status: 404 });
    }
    
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch;

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers: githubHeaders });
    
    const filesAnalyzed: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vulnerabilities: any[] = [];
    let scaContent = "";
    const sourceChunks: string[] = [""];
    let currentChunkIndex = 0;
    const CHUNK_LIMIT = 20000; // characters
    
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      const allFiles = treeData.tree || [];
      
      const targetExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.php', '.yml', '.yaml', '.json'];
      const targetFiles = ['.env.example', 'Dockerfile', 'docker-compose.yml', 'package.json', 'requirements.txt', 'go.mod'];
      
      const filesToFetch = allFiles.filter((f: { type: string, path: string, url: string }) => {
        if (f.type !== 'blob') return false;
        if (f.path.includes('node_modules') || f.path.includes('vendor') || f.path.includes('dist') || f.path.includes('.git')) return false;
        
        const isTargetExtension = targetExtensions.some(ext => f.path.endsWith(ext));
        const isTargetFile = targetFiles.some(tf => f.path.endsWith(tf));
        return isTargetExtension || isTargetFile;
      }).slice(0, 30); // Grab up to 30 relevant files to analyze
      
      for (const file of filesToFetch) {
        try {
          const contentRes = await fetch(file.url, { headers: githubHeaders });
          if (contentRes.ok) {
            const blobData = await contentRes.json();
            const content = Buffer.from(blobData.content, 'base64').toString('utf-8');
            filesAnalyzed.push(file.path);

            const fileSecrets = scanForSecrets(content, file.path);
            vulnerabilities.push(...fileSecrets);

            if (file.path.endsWith("package.json") || file.path.endsWith("requirements.txt") || file.path.endsWith("go.mod")) {
              scaContent += `\n\n--- FILE: ${file.path} ---\n${content.slice(0, 4000)}`;
            } else {
              const fileContext = `\n\n--- FILE: ${file.path} ---\n${content.slice(0, 4000)}`;
              if (sourceChunks[currentChunkIndex].length + fileContext.length > CHUNK_LIMIT) {
                if (sourceChunks.length >= 3) continue; // limit to 3 chunks to prevent massive token usage
                sourceChunks.push("");
                currentChunkIndex++;
              }
              sourceChunks[currentChunkIndex] += fileContext;
            }
          }
        } catch {
          console.error(`Failed to fetch ${file.path}`);
        }
      }
    }

    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .insert({
        user_id: user.id,
        target_url: url,
        target_type: "github_repo",
        status: "scanning",
        technologies: filesAnalyzed,
      })
      .select()
      .single();

    if (scanError || !scan) throw new Error("Failed to create scan record");

    let securityScore = 100;

    // Run AI Analysis concurrently
    try {
      const aiPromises = [];

      if (scaContent.trim()) {
        const scaPrompt = `
          Act as an expert Software Composition Analysis (SCA) tool.
          Analyze the following dependency files (e.g., package.json, requirements.txt).
          Identify if any dependencies are severely outdated, deprecated, or likely to have vulnerabilities.
          Provide the output as a valid JSON array of objects. Do not include markdown formatting like \`\`\`json.
          
          Format for each object:
          {
            "name": "Vulnerable Dependency: [Name]",
            "description": "Detailed explanation of the issue with this dependency version",
            "severity": "critical|high|medium|low|info",
            "category": "sast",
            "remediation": "How to fix this issue (e.g., Upgrade to version X.Y.Z)",
            "ai_explanation": "A friendly explanation of why this dependency is risky"
          }
          
          If no vulnerabilities are found, return an empty array [].
          
          CODE:
          ${scaContent}
        `;
        aiPromises.push(callClaude(scaPrompt));
      }

      for (const chunk of sourceChunks) {
        if (!chunk.trim()) continue;
        const sastPrompt = `
          Act as an expert Static Application Security Testing (SAST) tool.
          Analyze the following source code snippets from a GitHub repository for security vulnerabilities (e.g., hardcoded secrets, SQL injection, XSS, insecure dependencies, bad practices).
          
          Provide the output as a valid JSON array of objects. Do not include markdown formatting like \`\`\`json.
          
          Format for each object:
          {
            "name": "Short title of vulnerability",
            "description": "Detailed explanation of the issue found in the code",
            "severity": "critical|high|medium|low|info",
            "category": "sast",
            "remediation": "How to fix this issue in the code",
            "ai_explanation": "A friendly explanation of why this is a risk"
          }
          
          If no vulnerabilities are found, return an empty array [].
          
          CODEBASE TO ANALYZE:
          ${chunk}
        `;
        aiPromises.push(callClaude(sastPrompt));
      }

      const results = await Promise.allSettled(aiPromises);

      for (const res of results) {
        if (res.status === "fulfilled") {
          let responseText = res.value;
          responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
          try {
            const aiVulns = JSON.parse(responseText);
            if (Array.isArray(aiVulns)) {
              vulnerabilities.push(...aiVulns);
            }
          } catch (e) {
            console.error("Failed to parse chunk", e);
          }
        }
      }
    } catch (aiErr) {
      console.error("Claude AI Analysis failed:", aiErr);
    }

    // Attach scan_id and deduct score
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalVulns = vulnerabilities.map((v: any) => {
      if (v.severity === "critical") securityScore -= 20;
      if (v.severity === "high") securityScore -= 10;
      if (v.severity === "medium") securityScore -= 5;
      if (v.severity === "low") securityScore -= 2;

      return {
        scan_id: scan.id,
        name: v.name || "Code Vulnerability",
        description: v.description,
        severity: v.severity || "medium",
        category: "sast",
        remediation: v.remediation,
        ai_explanation: v.ai_explanation,
      };
    });

    // Deduplicate vulnerabilities by name to avoid identical AI findings across chunks
    const uniqueVulns = finalVulns.filter((v, index, self) => 
      index === self.findIndex((t) => (t.name === v.name))
    );

    securityScore = Math.max(0, securityScore);

    if (uniqueVulns.length > 0) {
      await supabase.from("vulnerabilities").insert(uniqueVulns);
    }

    const duration = Date.now() - startTime;
    await supabase
      .from("scans")
      .update({
        status: "completed",
        security_score: securityScore,
        scan_duration_ms: duration,
      })
      .eq("id", scan.id);

    return NextResponse.json({
      id: scan.id,
      target_url: url,
      security_score: securityScore,
      vulnerabilities: uniqueVulns,
      technologies: filesAnalyzed,
      scan_duration_ms: duration,
    });

  } catch (error: unknown) {
    console.error("GitHub Scan Error:", error);
    return NextResponse.json({ error: (error as Error).message || "Internal server error" }, { status: 500 });
  }
}
