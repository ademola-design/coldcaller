# AI Cold Caller

An AI voice agent that cold-calls solar leads, follows the sales script, handles
objections using the A.I.R. framework and category-specific rebuttals, and keeps
working the objection rather than accepting the first "no" — short of a hard
disqualifier (renter, do-not-call request, bill too low to be worth it). Calls
are triggered manually from the dashboard; there is no autodialer.

## Structure

Two independent apps, deployed as two separate Vercel projects from this one
repo (each project sets its **Root Directory** to `agent` or `dashboard`):

- **`agent/`** — the voice agent service. Holds the assistant config (system
  prompt + tools), the webhook receiving live tool calls and end-of-call reports
  from Vapi, and the endpoint the dashboard hits to start an outbound call.
- **`dashboard/`** — staff app showing appointments, leads, call recordings,
  transcripts, and objection history. Has the "Call now" button.
- **`supabase/`** — `schema.sql` (run once in the Supabase SQL editor) and
  `playbook-seed.json` (the objection sheet as structured data).

## How a call flows

```
Dashboard "Call now"
  → dashboard /api/call            (adds the shared secret server-side)
  → agent /api/calls/trigger       (looks up lead, refuses do_not_call)
  → Vapi POST /call                (customer.externalId = our lead id)
  → live conversation
      ├─ agent /api/vapi/webhook   tool-calls → save_lead_info, log_objection,
      │                            book_appointment, disqualify_lead,
      │                            log_call_disposition  → Supabase
      └─ end-of-call-report        → recording URL, transcript, summary
```

`customer.externalId` is what ties a Vapi call back to a lead row, so no
separate mapping table is needed.

## Deployment

Order matters: the assistant can't be created until the agent app has a public
URL for Vapi to send webhooks to.

### 1. Database

Run `supabase/schema.sql` in the Supabase SQL editor. Then create your login
user under **Authentication → Users → Add user** (tick "Auto Confirm User") —
the dashboard is gated behind Supabase Auth.

### 2. Push to GitHub

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 3. Deploy `agent` (Vercel project #1)

Import the repo, set **Root Directory** to `agent`, and add these env vars:

| Var | Value |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | The **secret** key (`sb_secret_…`) — bypasses RLS, server-only |
| `VAPI_API_KEY` | Vapi private key |
| `VAPI_PHONE_NUMBER_ID` | Vapi phone number id |
| `VAPI_ASSISTANT_ID` | Leave blank for now — filled in at step 4 |
| `AGENT_SERVICE_API_KEY` | Shared secret; must match the dashboard's copy |
| `VAPI_WEBHOOK_SECRET` | Shared secret; verifies webhooks really came from Vapi |

Deploy, then confirm `https://<agent-url>/api/health` returns `{"ok":true}`.

### 4. Create the Vapi assistant

Put the deployed URL into `agent/.env.local` as `AGENT_PUBLIC_URL`, then:

```bash
cd agent && npm run setup-assistant
```

It prints a `VAPI_ASSISTANT_ID`. Add that to **both** `agent/.env.local` and the
`agent` Vercel project's env vars, then redeploy. Re-run this command any time
you change the system prompt or tools in `lib/assistantConfig.ts` — it updates
the existing assistant in place.

### 5. Deploy `dashboard` (Vercel project #2)

Import the same repo again, set **Root Directory** to `dashboard`:

| Var | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The **publishable** key (`sb_publishable_…`) |
| `AGENT_SERVICE_URL` | The deployed agent URL from step 3 |
| `AGENT_SERVICE_API_KEY` | Same value as the agent's |

## Key handling

- The **secret** Supabase key bypasses RLS entirely. It belongs only in the
  `agent` project's server env — never in `dashboard`, never in anything
  prefixed `NEXT_PUBLIC_` (those are shipped to the browser).
- The **publishable** key is safe in the browser; RLS restricts it to
  authenticated reads.
- `.env.local` is gitignored. `.env.example` files are committed templates and
  must stay blank.

## Local dev

```bash
cd agent && npm install && npm run dev                    # :3000
cd dashboard && npm install && npm run dev -- --port 3100 # :3100
```

"Call now" needs `AGENT_SERVICE_URL` set, so it only works locally once the
agent is deployed (or tunnelled with ngrok).

## Maintenance

- **Change what the agent says** — edit `agent/lib/assistantConfig.ts`, then
  re-run `npm run setup-assistant`.
- **Change the objection reference data** — edit `supabase/playbook-seed.json`,
  then `cd agent && npm run seed-playbook`. Note this table is a queryable
  reference copy; the agent's live behavior comes from the system prompt.
