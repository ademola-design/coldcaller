export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "disqualified"
  | "appointment_booked"
  | "appointment_confirmed"
  | "completed"
  | "closed_won"
  | "closed_lost"
  | "do_not_call";

export type CallOutcome =
  | "appointment_booked"
  | "callback_requested"
  | "not_interested"
  | "disqualified"
  | "voicemail"
  | "no_answer"
  | "wrong_number"
  | "do_not_call_requested"
  | "escalated_to_human"
  | "in_progress";

export type Lead = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone_number: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  campaign_name: string | null;
  average_monthly_bill: number | null;
  electricity_provider: string | null;
  home_type: string | null;
  owns_roof: boolean | null;
  roof_type: string | null;
  has_shading_issues: boolean | null;
  shading_notes: string | null;
  credit_score_above_650: boolean | null;
  taxable_income_above_45k: boolean | null;
  already_has_solar: boolean | null;
  decision_makers: Array<{ name?: string; relationship?: string }> | null;
  status: LeadStatus;
  disqualification_reason: string | null;
  notes: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  lead_id: string;
  scheduled_at: string;
  timezone: string | null;
  consultant_name: string | null;
  appointment_type: "in_home" | "virtual";
  status: "scheduled" | "confirmed" | "rescheduled" | "completed" | "cancelled" | "no_show";
  decision_makers_present: boolean | null;
  notes: string | null;
  created_at: string;
  leads?: Lead | null;
};

export type Call = {
  id: string;
  lead_id: string;
  appointment_id: string | null;
  provider_call_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  outcome: CallOutcome;
  recording_link: string | null;
  transcript: string | null;
  summary: string | null;
};

export type ObjectionLog = {
  id: string;
  call_id: string;
  category: string;
  customer_statement: string;
  agent_response: string;
  resolved: boolean | null;
  occurred_at: string;
};
