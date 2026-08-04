// One-time (or re-run-on-change) script that creates or updates the Vapi
// assistant from the config in lib/assistantConfig.ts, so the assistant is
// defined in code instead of hand-edited in the Vapi dashboard.
//
// Requires the agent app to already be deployed (or tunneled, e.g. ngrok)
// since Vapi needs to reach AGENT_PUBLIC_URL/api/vapi/webhook from the
// internet. Run with: npm run setup-assistant

import { buildAssistantConfig } from "../lib/assistantConfig";
import { createAssistant, updateAssistant } from "../lib/vapi";

async function main() {
  const publicUrl = process.env.AGENT_PUBLIC_URL;
  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;

  if (!publicUrl) {
    throw new Error(
      "Missing AGENT_PUBLIC_URL — set it to the deployed agent app's URL (e.g. https://your-agent.vercel.app) in agent/.env.local"
    );
  }
  if (!webhookSecret) {
    throw new Error("Missing VAPI_WEBHOOK_SECRET in agent/.env.local — generate any random string");
  }

  const config = buildAssistantConfig({
    serverUrl: `${publicUrl.replace(/\/$/, "")}/api/vapi/webhook`,
    webhookSecret,
  });

  const existingId = process.env.VAPI_ASSISTANT_ID;

  if (existingId) {
    console.log(`Updating existing assistant ${existingId}...`);
    const result = await updateAssistant(existingId, config);
    console.log(`Updated assistant ${result.id}`);
  } else {
    console.log("Creating new assistant...");
    const result = await createAssistant(config);
    console.log(`Created assistant ${result.id}`);
    console.log(`\nAdd this to agent/.env.local and your Vercel env vars:\nVAPI_ASSISTANT_ID=${result.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
