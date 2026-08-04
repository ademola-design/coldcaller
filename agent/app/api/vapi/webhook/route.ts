import { getSupabaseAdmin } from "@/lib/supabase";
import { handleToolCall } from "@/lib/toolHandlers";

// Vapi sends every server message (tool-calls, end-of-call-report,
// status-update) to this single endpoint. Shapes verified against Vapi's
// OpenAPI spec: message.toolCallList[].function is NOT how tool calls are
// shaped here — Vapi's `tool-calls` message carries `toolCallList` with
// {id, name, arguments} where `arguments` is a JSON-encoded string.

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export async function POST(req: Request) {
  const expectedSecret = process.env.VAPI_WEBHOOK_SECRET;
  const receivedSecret = req.headers.get("x-vapi-secret");
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return unauthorized();
  }

  const body = await req.json();
  const message = body?.message;
  if (!message?.type) {
    return Response.json({ ok: true });
  }

  const supabase = getSupabaseAdmin();
  const leadId: string | null = message.customer?.externalId ?? null;
  const providerCallId: string | undefined = message.call?.id;

  switch (message.type) {
    case "tool-calls": {
      if (!providerCallId) {
        return Response.json({ results: [] });
      }

      const toolCallList: Array<{ id: string; name: string; arguments: string }> = message.toolCallList ?? [];

      const results = await Promise.all(
        toolCallList.map(async (call) => {
          try {
            const args = call.arguments ? JSON.parse(call.arguments) : {};
            const result = await handleToolCall({
              supabase,
              leadId,
              providerCallId,
              name: call.name,
              args,
            });
            return { toolCallId: call.id, name: call.name, result };
          } catch (err) {
            return {
              toolCallId: call.id,
              name: call.name,
              error: err instanceof Error ? err.message : "Tool call failed",
            };
          }
        })
      );

      return Response.json({ results });
    }

    case "end-of-call-report": {
      if (!providerCallId) return Response.json({ ok: true });

      const startedAt: string | undefined = message.startedAt;
      const endedAt: string | undefined = message.endedAt;
      const durationSeconds =
        startedAt && endedAt
          ? Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
          : null;

      const recordingLink: string | undefined = message.artifact?.recordingUrl;
      const transcript: string | undefined = message.artifact?.transcript;
      const summary: string | undefined = message.analysis?.summary;

      await supabase
        .from("calls")
        .update({
          ended_at: endedAt ?? new Date().toISOString(),
          duration_seconds: durationSeconds,
          recording_link: recordingLink ?? null,
          transcript: transcript ?? null,
          summary: summary ?? null,
        })
        .eq("provider_call_id", providerCallId);

      return Response.json({ ok: true });
    }

    default:
      return Response.json({ ok: true });
  }
}
