import { createClient } from "@/lib/supabase/server";

// Proxies the "call now" action to the agent service. Runs server-side so
// AGENT_SERVICE_API_KEY is never exposed to the browser, and re-checks the
// session so an unauthenticated request can't dial anyone.
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const serviceUrl = process.env.AGENT_SERVICE_URL;
  const serviceKey = process.env.AGENT_SERVICE_API_KEY;

  if (!serviceUrl || !serviceKey) {
    return Response.json(
      { error: "Agent service is not configured (AGENT_SERVICE_URL / AGENT_SERVICE_API_KEY)" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.leadId) {
    return Response.json({ error: "leadId is required" }, { status: 400 });
  }

  const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/api/calls/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-api-key": serviceKey,
    },
    body: JSON.stringify({ leadId: body.leadId }),
  });

  const data = await res.json().catch(() => ({}));
  return Response.json(data, { status: res.status });
}
