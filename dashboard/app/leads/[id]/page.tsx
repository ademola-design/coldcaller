import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav, StatusBadge, formatDateTime, formatDuration } from "@/components/ui";
import { CallButton } from "@/components/CallButton";
import type { Lead, Call, ObjectionLog, Appointment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", params.id).maybeSingle();
  if (!lead) notFound();

  const typedLead = lead as Lead;

  const [{ data: callsData }, { data: apptsData }] = await Promise.all([
    supabase.from("calls").select("*").eq("lead_id", params.id).order("started_at", { ascending: false }),
    supabase.from("appointments").select("*").eq("lead_id", params.id).order("scheduled_at", { ascending: false }),
  ]);

  const calls = (callsData ?? []) as Call[];
  const appointments = (apptsData ?? []) as Appointment[];

  const callIds = calls.map((c) => c.id);
  const { data: objectionsData } = callIds.length
    ? await supabase.from("objection_log").select("*").in("call_id", callIds).order("occurred_at", { ascending: true })
    : { data: [] };

  const objections = (objectionsData ?? []) as ObjectionLog[];
  const objectionsByCall = objections.reduce<Record<string, ObjectionLog[]>>((acc, o) => {
    (acc[o.call_id] ||= []).push(o);
    return acc;
  }, {});

  return (
    <>
      <Nav current="leads" />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link href="/leads" className="text-sm text-slate-500 hover:text-slate-900">
          ← Leads
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {typedLead.first_name} {typedLead.last_name ?? ""}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {typedLead.phone_number}
              {typedLead.email ? ` · ${typedLead.email}` : ""}
            </p>
            {typedLead.address && <p className="text-sm text-slate-500">{typedLead.address}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={typedLead.status} />
            <CallButton leadId={typedLead.id} disabled={typedLead.status === "do_not_call"} />
          </div>
        </div>

        {typedLead.status === "disqualified" && typedLead.disqualification_reason && (
          <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-medium">Disqualified:</span> {typedLead.disqualification_reason}
          </p>
        )}

        <Section title="Qualifying details">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Field label="Monthly bill" value={typedLead.average_monthly_bill != null ? `$${typedLead.average_monthly_bill}` : null} />
            <Field label="Provider" value={typedLead.electricity_provider} />
            <Field label="Home type" value={typedLead.home_type?.replace(/_/g, " ")} />
            <Field label="Owns roof" value={boolLabel(typedLead.owns_roof)} />
            <Field label="Roof type" value={typedLead.roof_type} />
            <Field label="Shading issues" value={boolLabel(typedLead.has_shading_issues)} />
            <Field label="Credit > 650" value={boolLabel(typedLead.credit_score_above_650)} />
            <Field label="Income > $45k" value={boolLabel(typedLead.taxable_income_above_45k)} />
            <Field label="Already has solar" value={boolLabel(typedLead.already_has_solar)} />
          </dl>
          {typedLead.decision_makers && typedLead.decision_makers.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Decision makers</p>
              <p className="mt-1 text-sm text-slate-900">
                {typedLead.decision_makers
                  .map((d) => [d.name, d.relationship ? `(${d.relationship})` : null].filter(Boolean).join(" "))
                  .join(", ")}
              </p>
            </div>
          )}
          {typedLead.notes && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{typedLead.notes}</p>
            </div>
          )}
        </Section>

        {appointments.length > 0 && (
          <Section title="Appointments">
            <ul className="space-y-2">
              {appointments.map((appt) => (
                <li key={appt.id} className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDateTime(appt.scheduled_at, appt.timezone)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {appt.appointment_type.replace(/_/g, "-")}
                      {appt.decision_makers_present != null &&
                        ` · decision makers ${appt.decision_makers_present ? "confirmed" : "not confirmed"}`}
                    </p>
                  </div>
                  <StatusBadge status={appt.status} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title={`Call history (${calls.length})`}>
          {calls.length === 0 ? (
            <p className="text-sm text-slate-500">No calls yet.</p>
          ) : (
            <ul className="space-y-4">
              {calls.map((call) => (
                <li key={call.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{formatDateTime(call.started_at)}</p>
                      <p className="text-xs text-slate-500">{formatDuration(call.duration_seconds)}</p>
                    </div>
                    <StatusBadge status={call.outcome} />
                  </div>

                  {call.summary && <p className="mt-3 text-sm text-slate-700">{call.summary}</p>}

                  {call.recording_link && (
                    <audio controls preload="none" src={call.recording_link} className="mt-3 w-full">
                      <a href={call.recording_link}>Download recording</a>
                    </audio>
                  )}

                  {objectionsByCall[call.id]?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Objections ({objectionsByCall[call.id].length})
                      </p>
                      <ul className="mt-2 space-y-2">
                        {objectionsByCall[call.id].map((o) => (
                          <li key={o.id} className="rounded-md bg-slate-50 p-3">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                                {o.category.replace(/_/g, " ")}
                              </span>
                              {o.resolved != null && (
                                <span
                                  className={`text-[10px] font-medium uppercase tracking-wide ${
                                    o.resolved ? "text-emerald-600" : "text-rose-600"
                                  }`}
                                >
                                  {o.resolved ? "resolved" : "unresolved"}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-slate-900">
                              <span className="text-slate-400">Lead:</span> {o.customer_statement}
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              <span className="text-slate-400">Agent:</span> {o.agent_response}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {call.transcript && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-900">
                        Transcript
                      </summary>
                      <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                        {call.transcript}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-slate-500">{title}</h2>
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-5">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

function boolLabel(value: boolean | null | undefined) {
  if (value == null) return null;
  return value ? "Yes" : "No";
}
