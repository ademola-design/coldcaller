-- ============================================================================
-- AI Cold Caller — Supabase Schema
-- Paste this whole file into the Supabase SQL Editor and run it.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

do $$ begin
  create type lead_status as enum (
    'new',
    'contacted',
    'qualified',
    'disqualified',
    'appointment_booked',
    'appointment_confirmed',
    'completed',
    'closed_won',
    'closed_lost',
    'do_not_call'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type home_type as enum ('single_family', 'condo', 'townhome', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_type as enum ('in_home', 'virtual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_status as enum (
    'scheduled', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type call_outcome as enum (
    'appointment_booked',
    'callback_requested',
    'not_interested',
    'disqualified',
    'voicemail',
    'no_answer',
    'wrong_number',
    'do_not_call_requested',
    'escalated_to_human',
    'in_progress'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type objection_category as enum (
    'early_smokescreen',   -- A.I.R. framework: "not interested", "busy", "send email", etc.
    'installation',        -- roof holes, old roof, leaks, panel appearance
    'financial_roi',       -- ROI, another bill, low bills already
    'ownership_moving',    -- renter, tenant, planning to move
    'timing_life',         -- renovations, life timing
    'trust_reputation',    -- bad experience stories, scam concerns
    'delay_deflection'     -- "just email me", stalling
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- leads: the person being called + everything qualified during the call
-- ----------------------------------------------------------------------------

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),

  -- contact info
  first_name text not null,
  last_name text,
  email text,
  phone_number text not null,
  address text,
  city text,
  state text,
  zip text,

  -- campaign / source
  campaign_name text,

  -- qualifying data (from the call script)
  average_monthly_bill numeric(10,2),
  electricity_provider text,
  home_type home_type,
  owns_roof boolean,
  roof_type text,                  -- shingle, tile, flat, etc.
  has_shading_issues boolean,
  shading_notes text,
  credit_score_above_650 boolean,
  taxable_income_above_45k boolean,
  already_has_solar boolean,
  decision_makers jsonb default '[]'::jsonb,  -- [{"name": "Jane", "relationship": "spouse"}]
  preferred_language text default 'en',

  -- lifecycle
  status lead_status not null default 'new',
  disqualification_reason text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at
  before update on leads
  for each row execute function set_updated_at();

create index if not exists idx_leads_phone on leads (phone_number);
create index if not exists idx_leads_status on leads (status);
create index if not exists idx_leads_email on leads (email);

-- ----------------------------------------------------------------------------
-- appointments: booked consultations tied to a lead
-- ----------------------------------------------------------------------------

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,

  scheduled_at timestamptz not null,
  timezone text default 'America/Los_Angeles',
  consultant_name text,
  appointment_type appointment_type not null default 'in_home',
  status appointment_status not null default 'scheduled',

  decision_makers_present boolean,
  confirmation_call_completed boolean default false,
  reminded_about_decision_makers boolean default false,
  reminded_to_have_utility_bill boolean default false,
  reminded_about_confirmation_call boolean default false,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_appointments_updated_at on appointments;
create trigger trg_appointments_updated_at
  before update on appointments
  for each row execute function set_updated_at();

create index if not exists idx_appointments_lead_id on appointments (lead_id);
create index if not exists idx_appointments_scheduled_at on appointments (scheduled_at);
create index if not exists idx_appointments_status on appointments (status);

-- ----------------------------------------------------------------------------
-- calls: every call attempt the AI agent makes to a lead
-- ----------------------------------------------------------------------------

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  appointment_id uuid references appointments (id) on delete set null,

  provider_call_id text,           -- external call/session id from the voice platform
  direction text not null default 'outbound',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,

  outcome call_outcome not null default 'in_progress',
  recording_link text,
  transcript text,
  summary text,

  created_at timestamptz not null default now()
);

create index if not exists idx_calls_lead_id on calls (lead_id);
create index if not exists idx_calls_appointment_id on calls (appointment_id);
create index if not exists idx_calls_provider_call_id on calls (provider_call_id);

-- ----------------------------------------------------------------------------
-- objection_log: objections raised on a specific call, and how the agent
-- actually responded (this is your "objections and how it handles it" data)
-- ----------------------------------------------------------------------------

create table if not exists objection_log (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls (id) on delete cascade,

  category objection_category not null,
  customer_statement text not null,   -- what the lead said, transcribed
  agent_response text not null,       -- what the agent said back
  resolved boolean,                   -- did the objection get overcome?
  occurred_at timestamptz not null default now()
);

create index if not exists idx_objection_log_call_id on objection_log (call_id);
create index if not exists idx_objection_log_category on objection_log (category);

-- ----------------------------------------------------------------------------
-- objection_playbook: static knowledge base seeded from the objection sheet.
-- The agent looks these up (or they're embedded in its system prompt) to
-- decide how to respond in real time.
-- ----------------------------------------------------------------------------

create table if not exists objection_playbook (
  id uuid primary key default gen_random_uuid(),
  category objection_category not null,
  trigger_phrase text not null,       -- e.g. "I'm not interested"
  response_agree text,                -- the "Agree" half of A.I.R.
  response_resume text,               -- the "Ignore + Resume" / main rebuttal
  framework_step text,                -- free-text note on which step/framework this follows
  sort_order int default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_objection_playbook_category on objection_playbook (category);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- The AI agent backend should use the Supabase service_role key, which
-- bypasses RLS entirely — so these policies only govern the appointments
-- dashboard, accessed by authenticated staff.
-- ----------------------------------------------------------------------------

alter table leads enable row level security;
alter table appointments enable row level security;
alter table calls enable row level security;
alter table objection_log enable row level security;
alter table objection_playbook enable row level security;

drop policy if exists "authenticated read leads" on leads;
create policy "authenticated read leads" on leads
  for select to authenticated using (true);

drop policy if exists "authenticated read appointments" on appointments;
create policy "authenticated read appointments" on appointments
  for select to authenticated using (true);

drop policy if exists "authenticated read calls" on calls;
create policy "authenticated read calls" on calls
  for select to authenticated using (true);

drop policy if exists "authenticated read objection_log" on objection_log;
create policy "authenticated read objection_log" on objection_log
  for select to authenticated using (true);

drop policy if exists "authenticated read objection_playbook" on objection_playbook;
create policy "authenticated read objection_playbook" on objection_playbook
  for select to authenticated using (true);

-- ============================================================================
-- Seed objection_playbook from "2nd day Objection sheet.pdf"
-- ============================================================================

insert into objection_playbook (category, trigger_phrase, response_agree, response_resume, framework_step, sort_order) values
('early_smokescreen', 'I''m not interested.', 'Totally understand, sir. And just to clarify—I''m not trying to sell you anything.', 'All I''m doing is letting you know what''s happening in your area so you''re aware…', 'A.I.R.', 1),
('early_smokescreen', 'I''m busy.', 'Of course, I get that. I''ll keep this super short.', 'You''re probably seeing more solar panels pop up nearby, and that''s what this is about…', 'A.I.R.', 2),
('early_smokescreen', 'Send me an email.', 'Sure… What''s your email? —just to be sure it''s relevant, let me ask you real quick…', 'Before I can get you that email I just need to qualify you here in the system…', 'A.I.R.', 3),
('early_smokescreen', 'Call me back.', 'Of course, I can do that. Just before I let you go—super quick—do you still live at [address]?', 'This will only take 30 seconds and then I''ll let you go, promise…', 'A.I.R.', 4),
('early_smokescreen', 'How did you get my number?', 'Totally fair question—we''re only reaching out to homeowners in your zip code.', 'You actually weren''t "targeted" personally, this is just for homes that qualify…', 'A.I.R.', 5),
('early_smokescreen', 'You''re the 5th person to call me!', 'Yea we''ve been trying to reach you about some important updates regarding the electricity.', 'We''re just doing a short info call to see if your property qualifies.', 'A.I.R.', 6),

('installation', 'I don''t want holes in my roof.', 'Got it, sir. Absolutely. That is exactly the reason why I''m calling you.', 'We actually use a new way of installation with K2 racketing, which ensures proper installation with seals on both the top and bottom. You''re also covered with a 10-year warranty on the roof. If anything were to happen, we''ll replace it, and the finance company also assumes responsibility in that case.', 'Agree -> Answer -> Bridge -> Note -> Fair? -> Resume', 1),
('installation', 'My roof is too old / I''m replacing my roof.', 'Totally understand, sir.', 'In that case, we can actually add a new roof into the project. You may even be able to get the roof done for free. I''m not promising that, but that''s what we''ve seen happen for some of our clients.', 'Agree -> Answer -> Bridge -> Note -> Fair? -> Resume', 2),
('installation', 'I have a flat/tile/special roof.', 'That''s not a problem at all, sir.', 'We can work with all roof types—flat, tile, shingle, anything. We''ve done it all before.', 'Agree -> Answer -> Bridge -> Note -> Fair? -> Resume', 3),
('installation', 'I''m worried about leaks from the installation.', 'Totally fair concern.', 'That''s why we include a workmanship warranty—so if anything goes wrong due to the installation, it''s covered for up to 10 years.', 'Agree -> Answer -> Bridge -> Note -> Fair? -> Resume', 4),
('installation', 'I don''t like how the panels will look.', 'Got it, sir.', 'We can definitely explore placing them on a side of the home that''s less visible, like the back. Also, the panels we use are completely black—they blend in with the roof and are barely noticeable. If we place them on the backside, you''ll almost forget they''re there. And to be honest, it blends in so well it ends up looking clean.', 'Agree -> Answer -> Bridge -> Note -> Fair? -> Resume', 5),

('financial_roi', 'I don''t see the return on investment.', 'Absolutely, sir. I agree.', 'That''s because there actually is no investment. ROI means you''re putting your own money in, but with this, you''re not. What we''re offering today doesn''t require any upfront investment—you''re just shifting where your money goes. Instead of paying the electric company, you''ll save from month one.', 'Agree -> Answer -> Bridge -> Note -> Fair? -> Resume', 1),
('financial_roi', 'I don''t want another bill.', 'Completely understand, sir. A lot of homeowners say the same thing—they don''t want another stressor.', 'That''s why this isn''t about adding a bill. We''re aiming to eliminate your electric bill completely and replace it with one that''s usually 30 to 50% cheaper.', 'Agree -> Answer -> Bridge -> Note -> Fair? -> Resume', 2),
('financial_roi', 'My electricity bills are already low.', 'Got it. If you don''t mind me asking—how much are you currently paying?', 'If >$150: Perfect. We can probably reduce that significantly. If <$60: I''ll be honest, sir, it might not be worth it for you, and we''d likely disqualify the property. If $60-150: In that range, we can usually still help you save and lock in a fixed rate—so you''re not at the mercy of rate hikes every month. Wouldn''t it be nice to just know exactly what you''re paying, no surprises?', 'Conditional on stated bill amount', 3),

('ownership_moving', 'I rent / I''m not the homeowner.', 'Got it—thank you for letting me know.', 'Unfortunately, this program is only available to homeowners. If you have a landlord or know who owns the property, I''d be happy to speak with them to see if they''d be interested. They could benefit from solar while the tenant still pays the bill, which means they get the tax credit and increase the property value.', 'Disqualify path with landlord referral offer', 1),
('ownership_moving', 'I have a tenant living there.', 'That''s totally fine, sir.', 'We''ve helped many landlords install solar on rental properties. The best part is: your tenant continues to pay for power, but you get the financial benefit—like the tax credit and added property value. We''d just need to make sure it''s set up correctly with ownership.', 'Agree -> Answer -> Resume', 2),
('ownership_moving', 'I''m planning to move.', 'Thanks for sharing that, sir. Just so I''m clear—when exactly are you planning to move?', 'If <6 months: Understood, it might make sense to wait until you''re in your new home. If >6 months: Great, that still gives you time to benefit, and when you sell, the new owner benefits too—have you listed the home yet?', 'Conditional on timeframe', 3),

('timing_life', 'I''m planning to do home renovations (kitchen, roof, etc.).', 'Sir, I''m actually glad I caught you right now.', 'We might be able to get that kitchen you''re planning to renovate completely for free. The government is currently incentivizing solar projects, and they allow home renovation work to be bundled into the solar financing—potentially covering 30% of it through the federal tax credit. In some cases, we can even take a portion of our commission to help cover the cost upfront. So this might be the perfect timing.', 'Bridge renovation into solar pitch', 1),

('trust_reputation', 'My cousin/friend had a bad experience with solar.', 'Totally understand, sir. I honestly don''t know what happened with other companies—but I can tell you we''re not here scamming people.', 'We''re just booking appointments with homeowners in your area to see if solar would help them save. That''s it. If they insist: ask what happened, let them speak, then offer to have the engineer walk through everything with the cousin present too.', 'Empathize -> Clarify -> Offer resolution path', 1),

('delay_deflection', 'Can you just send me an email?', 'Yes, absolutely—what''s your email, sir?', 'Perfect. So in order to send you the right information, I do need to ask you a couple of quick questions first—just to make sure your home actually qualifies. Then we can pass that along to the engineer so they can build a personalized report. Normally the engineer does need to swing by to check your meter and some basic info. If everything checks out, they can show you the report right there, and if you still want it by email, we can send it after that.', 'Capture email -> Redirect to qualifying questions -> Bridge to appointment', 1)
on conflict do nothing;
