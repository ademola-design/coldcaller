# AI Cold Caller

An AI voice agent that cold-calls solar leads, follows the sales script, handles
objections using the A.I.R. framework and category-specific rebuttals, and never
gives up on booking an appointment short of a hard disqualifier (renter, DNC
request, bill too low, etc.). Calls are triggered manually from the dashboard —
there is no autodialer.

## Structure

Two independent apps, deployed as two separate Vercel projects from this one repo
(set each project's **Root Directory** to `agent` or `dashboard`):

- **`agent/`** — the voice agent service. Holds the Vapi assistant config, the
  webhook that receives live tool calls + end-of-call reports from Vapi, and the
  endpoint the dashboard hits to start an outbound call.
- **`dashboard/`** — staff-facing app showing leads, appointments, call
  recordings/transcripts, and objection history. Has the "Call Now" button.
- **`supabase/schema.sql`** — run this in the Supabase SQL editor once, before
  either app needs a working database.

## Build stages

1. ✅ Supabase schema
2. ✅ Repo scaffold (this stage)
3. Agent service: Vapi webhook handlers + call trigger endpoint
4. Vapi assistant system prompt, built from the sales script + objection sheet
5. Dashboard: leads/appointments/calls views + manual call trigger
6. Deployment: env vars on Vercel, verify both apps live

## Environment variables

### `agent/` (Vercel project #1)

| Var | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (secret — full DB access) |
| `VAPI_API_KEY` | Vapi dashboard |
| `VAPI_ASSISTANT_ID` | Created once the assistant is configured (stage 4) |
| `VAPI_PHONE_NUMBER_ID` | Vapi dashboard, once a number is provisioned |
| `AGENT_SERVICE_API_KEY` | Any random secret you generate — shared with the dashboard |
| `VAPI_WEBHOOK_SECRET` | Vapi dashboard — used to verify inbound webhooks |

### `dashboard/` (Vercel project #2)

| Var | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (public) |
| `AGENT_SERVICE_URL` | The deployed URL of the `agent` Vercel project |
| `AGENT_SERVICE_API_KEY` | Same value as `agent`'s `AGENT_SERVICE_API_KEY` |

Copy `.env.example` to `.env.local` in each app for local dev — `.env.local` is
gitignored and never committed.

## Local dev

```bash
cd agent && npm install && npm run dev   # http://localhost:3000
cd dashboard && npm install && npm run dev   # runs on 3000 too — use a different port if running both
```
