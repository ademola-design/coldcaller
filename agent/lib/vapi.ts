const VAPI_BASE_URL = "https://api.vapi.ai";

function vapiHeaders() {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error("Missing VAPI_API_KEY env var");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export type StartCallParams = {
  leadId: string;
  phoneNumber: string; // E.164, e.g. +14155551234
  firstName: string;
  lastName?: string | null;
  address?: string | null;
};

// Starts an outbound call. customer.externalId carries our lead id so the
// webhook can correlate tool calls / end-of-call reports back to the lead
// without us needing a separate mapping table.
export async function startOutboundCall(params: StartCallParams) {
  const res = await fetch(`${VAPI_BASE_URL}/call`, {
    method: "POST",
    headers: vapiHeaders(),
    body: JSON.stringify({
      assistantId: process.env.VAPI_ASSISTANT_ID,
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      customer: {
        number: params.phoneNumber,
        name: [params.firstName, params.lastName].filter(Boolean).join(" "),
        externalId: params.leadId,
      },
      assistantOverrides: {
        variableValues: {
          firstName: params.firstName,
          lastName: params.lastName ?? "",
          address: params.address ?? "",
          // Redundant with customer.externalId — gives the webhook a second
          // way to resolve the lead if the customer object is ever absent.
          leadId: params.leadId,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // Vapi returns {message, error, ...}; prefer its human-readable message
    // over dumping the whole payload into the dashboard's error toast.
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      const message = Array.isArray(parsed.message) ? parsed.message.join("; ") : parsed.message;
      detail = message || parsed.error || body;
    } catch {
      // non-JSON body — keep the raw text
    }
    throw new Error(`Vapi (${res.status}): ${detail}`);
  }

  return res.json() as Promise<{ id: string; status: string }>;
}

export async function createAssistant(config: Record<string, unknown>) {
  const res = await fetch(`${VAPI_BASE_URL}/assistant`, {
    method: "POST",
    headers: vapiHeaders(),
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vapi assistant creation failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<{ id: string }>;
}

export async function updateAssistant(assistantId: string, config: Record<string, unknown>) {
  const res = await fetch(`${VAPI_BASE_URL}/assistant/${assistantId}`, {
    method: "PATCH",
    headers: vapiHeaders(),
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vapi assistant update failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<{ id: string }>;
}
