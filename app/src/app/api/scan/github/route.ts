import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes("github.com")) {
      return NextResponse.json(
        { error: "Invalid GitHub URL provided" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse URL: https://github.com/owner/repo
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return NextResponse.json({ error: "Invalid GitHub Repository URL" }, { status: 400 });
    }
    
    const owner = parts[0];
    const repo = parts[1];
    const startTime = Date.now();

    // 1. Fetch Repository Info
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { "User-Agent": "BugHunter-AI" }
    });
    
    if (!repoRes.ok) {
      return NextResponse.json({ error: "Could not access repository. It may be private or not exist." }, { status: 404 });
    }
    
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch;

    // 2. Fetch Repository Tree
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, {
      headers: { "User-Agent": "BugHunter-AI" }
    });
    
    const filesAnalyzed: string[] = [];
    let codebaseContent = "";
    
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      const allFiles = treeData.tree || [];
      
      // Target files that commonly contain vulnerabilities
      const targetExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.php', '.yml', '.yaml', '.json'];
      const targetFiles = ['.env.example', 'Dockerfile', 'docker-compose.yml', 'package.json'];
      
      const filesToFetch = allFiles.filter((f: { type: string, path: string }) => {
        if (f.type !== 'blob') return false;
        // Don't fetch huge vendor folders
        if (f.path.includes('node_modules') || f.path.includes('vendor') || f.path.includes('dist')) return false;
        
        const isTargetExtension = targetExtensions.some(ext => f.path.endsWith(ext));
        const isTargetFile = targetFiles.some(tf => f.path.endsWith(tf));
        return isTargetExtension || isTargetFile;
      }).slice(0, 15); // Limit to 15 files to avoid token limits

      // 3. Fetch file contents
      for (const file of filesToFetch) {
        try {
          const contentRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${file.path}`);
          if (contentRes.ok) {
            const content = await contentRes.text();
            codebaseContent += `\n\n--- FILE: ${file.path} ---\n${content.slice(0, 2000)}`; // Limit size per file
            filesAnalyzed.push(file.path);
          }
        } catch {
          console.error(`Failed to fetch ${file.path}`);
        }
      }
    }

    // 4. Create Scan Record in DB
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

    // 5. Analyze with Gemini
    const vulnerabilities = [];
    let securityScore = 100;

    if (codebaseContent) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
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
          ${codebaseContent}
        `;

        const aiResult = await model.generateContent(prompt);
        let responseText = aiResult.response.text();
        
        // Clean up markdown wrapping if present
        responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
        
        const aiVulns = JSON.parse(responseText);
        
        if (Array.isArray(aiVulns)) {
          for (const v of aiVulns) {
            vulnerabilities.push({
              scan_id: scan.id,
              name: v.name || "Code Vulnerability",
              description: v.description,
              severity: v.severity,
              category: "sast",
              remediation: v.remediation,
              ai_explanation: v.ai_explanation,
            });
            
            // Deduct score
            if (v.severity === "critical") securityScore -= 20;
            if (v.severity === "high") securityScore -= 10;
            if (v.severity === "medium") securityScore -= 5;
            if (v.severity === "low") securityScore -= 2;
          }
        }
      } catch (aiErr) {
        console.error("AI Analysis failed:", aiErr);
        vulnerabilities.push({
          scan_id: scan.id,
          name: "SAST Analysis Failed",
          description: "Could not parse AI response or AI failed.",
          severity: "info",
          category: "sast",
          remediation: "Try again later.",
        });
      }
    } else {
       vulnerabilities.push({
          scan_id: scan.id,
          name: "No Code Found",
          description: "Could not find recognizable code files in this repository.",
          severity: "info",
          category: "sast",
          remediation: "Ensure the repository is public and contains code.",
       });
    }

    securityScore = Math.max(0, securityScore);

    // 6. Save Vulnerabilities
    if (vulnerabilities.length > 0) {
      await supabase.from("vulnerabilities").insert(vulnerabilities);
    }

    // 7. Update Scan Record
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
      vulnerabilities,
      technologies: filesAnalyzed,
      scan_duration_ms: duration,
    });

  } catch (error: unknown) {
    console.error("GitHub Scan Error:", error);
    return NextResponse.json({ error: (error as Error).message || "Internal server error" }, { status: 500 });
  }
}
