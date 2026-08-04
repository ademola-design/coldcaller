import type { SupabaseClient } from "@supabase/supabase-js";

type ToolCallInput = {
  supabase: SupabaseClient;
  leadId: string | null;
  providerCallId: string;
  name: string;
  args: Record<string, unknown>;
};

// Looks up (or lazily creates) the internal `calls` row for this Vapi call,
// so tool handlers have a real calls.id to attach objections/appointments to.
async function getOrCreateCallRow(supabase: SupabaseClient, providerCallId: string, leadId: string | null) {
  const { data: existing } = await supabase
    .from("calls")
    .select("id, lead_id")
    .eq("provider_call_id", providerCallId)
    .maybeSingle();

  if (existing) return existing;

  if (!leadId) {
    throw new Error(`No existing call row for ${providerCallId} and no leadId to create one`);
  }

  const { data: created, error } = await supabase
    .from("calls")
    .insert({ provider_call_id: providerCallId, lead_id: leadId, outcome: "in_progress" })
    .select("id, lead_id")
    .single();

  if (error) throw error;
  return created;
}

export async function handleToolCall({ supabase, leadId, providerCallId, name, args }: ToolCallInput): Promise<string> {
  const callRow = await getOrCreateCallRow(supabase, providerCallId, leadId);
  const resolvedLeadId = leadId ?? callRow.lead_id;

  switch (name) {
    case "save_lead_info": {
      const updatable: Record<string, unknown> = {};
      const allowedFields = [
        "average_monthly_bill",
        "electricity_provider",
        "home_type",
        "owns_roof",
        "roof_type",
        "has_shading_issues",
        "shading_notes",
        "credit_score_above_650",
        "taxable_income_above_45k",
        "already_has_solar",
        "notes",
      ];
      for (const field of allowedFields) {
        if (args[field] !== undefined) updatable[field] = args[field];
      }
      if (args.decision_makers !== undefined) {
        updatable.decision_makers = args.decision_makers;
      }
      if (Object.keys(updatable).length > 0) {
        const { error } = await supabase.from("leads").update(updatable).eq("id", resolvedLeadId);
        if (error) throw error;
      }
      return "Saved.";
    }

    case "log_objection": {
      const { error } = await supabase.from("objection_log").insert({
        call_id: callRow.id,
        category: args.category,
        customer_statement: args.customer_statement,
        agent_response: args.agent_response,
        resolved: args.resolved ?? null,
      });
      if (error) throw error;
      return "Logged.";
    }

    case "book_appointment": {
      const { data: appointment, error: apptError } = await supabase
        .from("appointments")
        .insert({
          lead_id: resolvedLeadId,
          scheduled_at: args.scheduled_at,
          timezone: args.timezone ?? "America/Los_Angeles",
          appointment_type: args.appointment_type ?? "in_home",
          decision_makers_present: args.decision_makers_present ?? null,
          notes: args.notes ?? null,
          status: "scheduled",
        })
        .select("id")
        .single();
      if (apptError) throw apptError;

      const { error: leadError } = await supabase
        .from("leads")
        .update({ status: "appointment_booked" })
        .eq("id", resolvedLeadId);
      if (leadError) throw leadError;

      const { error: callError } = await supabase
        .from("calls")
        .update({ outcome: "appointment_booked", appointment_id: appointment.id })
        .eq("id", callRow.id);
      if (callError) throw callError;

      return `Appointment booked (id: ${appointment.id}).`;
    }

    case "disqualify_lead": {
      const { error: leadError } = await supabase
        .from("leads")
        .update({ status: "disqualified", disqualification_reason: args.reason })
        .eq("id", resolvedLeadId);
      if (leadError) throw leadError;

      const { error: callError } = await supabase
        .from("calls")
        .update({ outcome: "disqualified" })
        .eq("id", callRow.id);
      if (callError) throw callError;

      return "Marked as disqualified.";
    }

    case "log_call_disposition": {
      // Note: calls.summary is populated separately from Vapi's own
      // end-of-call-report analysis, not from these notes.
      const outcome = args.outcome as string;
      const { error: callError } = await supabase.from("calls").update({ outcome }).eq("id", callRow.id);
      if (callError) throw callError;

      const dncOutcomes = ["do_not_call_requested"];
      if (dncOutcomes.includes(outcome)) {
        const { error: leadError } = await supabase
          .from("leads")
          .update({ status: "do_not_call" })
          .eq("id", resolvedLeadId);
        if (leadError) throw leadError;
      } else {
        const { error: leadError } = await supabase
          .from("leads")
          .update({ status: "contacted", notes: args.notes ?? null })
          .eq("id", resolvedLeadId);
        if (leadError) throw leadError;
      }

      return "Disposition logged.";
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
