import { getSupabaseAdmin } from "@/lib/supabase";
import { startOutboundCall } from "@/lib/vapi";

export async function POST(req: Request) {
  const expectedKey = process.env.AGENT_SERVICE_API_KEY;
  const receivedKey = req.headers.get("x-agent-api-key");
  if (!expectedKey || receivedKey !== expectedKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const leadId = body?.leadId;
  if (!leadId || typeof leadId !== "string") {
    return Response.json({ error: "leadId is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, first_name, last_name, phone_number, address, status")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.status === "do_not_call") {
    return Response.json({ error: "Lead has requested no further contact" }, { status: 409 });
  }

  const vapiCall = await startOutboundCall({
    leadId: lead.id,
    phoneNumber: lead.phone_number,
    firstName: lead.first_name,
    lastName: lead.last_name,
    address: lead.address,
  });

  const { error: insertError } = await supabase.from("calls").insert({
    provider_call_id: vapiCall.id,
    lead_id: lead.id,
    outcome: "in_progress",
    started_at: new Date().toISOString(),
  });
  if (insertError) throw insertError;

  if (lead.status === "new") {
    await supabase.from("leads").update({ status: "contacted" }).eq("id", lead.id);
  }

  return Response.json({ callId: vapiCall.id });
}
