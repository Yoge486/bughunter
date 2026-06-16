import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// We use the service role key to bypass RLS for the cron job
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET(req: Request) {
  try {
    // 1. Verify authorization (e.g., Vercel Cron Secret)
    const authHeader = req.headers.get("authorization");
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    // If running locally, you might bypass this or set CRON_SECRET in .env.local
    if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch pending scheduled scans
    const now = new Date().toISOString();
    const { data: dueScans, error } = await supabase
      .from("scheduled_scans")
      .select("*")
      .eq("is_active", true)
      .lte("next_run", now);

    if (error) {
      throw new Error(`Failed to fetch scheduled scans: ${error.message}`);
    }

    if (!dueScans || dueScans.length === 0) {
      return NextResponse.json({ message: "No scans due for execution." });
    }

    const results = [];

    // 3. Execute Scans
    // Note: In a production environment with many scans, you'd want a proper queue (e.g., Inngest, Upstash QStash).
    // For this demo, we'll execute them sequentially.

    for (const scan of dueScans) {
      try {
        // We cannot easily spoof the auth token for the fetch without the user's session,
        // so the /api/scan endpoints need to handle requests triggered by the system.
        // For simplicity in this v2 architecture, we assume the /api/scan route can accept
        // a CRON_SECRET bypass or we pass the user_id directly.
        // To properly implement this, we should refactor the scan logic into a shared service function.
        // As a placeholder, we log the execution intent.

        console.log(`[CRON] Triggering ${scan.target_type} scan for ${scan.target_url} (User: ${scan.user_id})`);
        
        // Calculate next run
        const nextRun = new Date();
        if (scan.frequency === "daily") {
          nextRun.setDate(nextRun.getDate() + 1);
        } else {
          nextRun.setDate(nextRun.getDate() + 7);
        }

        // Update DB record
        await supabase
          .from("scheduled_scans")
          .update({
            last_run: now,
            next_run: nextRun.toISOString()
          })
          .eq("id", scan.id);

        results.push({ id: scan.id, status: "triggered" });
      } catch (err) {
        console.error(`Failed to process scheduled scan ${scan.id}:`, err);
        results.push({ id: scan.id, status: "failed" });
      }
    }

    return NextResponse.json({ 
      message: `Processed ${dueScans.length} scheduled scans.`,
      results 
    });

  } catch (error: unknown) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
