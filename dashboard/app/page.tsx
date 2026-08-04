import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav, StatusBadge, EmptyState, formatDateTime } from "@/components/ui";
import type { Appointment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("*, leads(*)")
    .order("scheduled_at", { ascending: true });

  const appointments = (data ?? []) as Appointment[];

  const now = Date.now();
  const upcoming = appointments.filter((a) => new Date(a.scheduled_at).getTime() >= now);
  const past = appointments.filter((a) => new Date(a.scheduled_at).getTime() < now);

  return (
    <>
      <Nav current="appointments" />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Appointments</h1>
          <p className="text-sm text-slate-500">
            {upcoming.length} upcoming · {appointments.length} total
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Could not load appointments: {error.message}
          </p>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-medium text-slate-500">Upcoming</h2>
          <div className="mt-2">
            {upcoming.length === 0 ? (
              <EmptyState
                title="No upcoming appointments"
                hint="Appointments appear here as soon as the agent books one on a call."
              />
            ) : (
              <AppointmentTable appointments={upcoming} />
            )}
          </div>
        </section>

        {past.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-medium text-slate-500">Past</h2>
            <div className="mt-2">
              <AppointmentTable appointments={past} />
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function AppointmentTable({ appointments }: { appointments: Appointment[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">When</th>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">Address</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {appointments.map((appt) => {
            const lead = appt.leads;
            return (
              <tr key={appt.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                  {formatDateTime(appt.scheduled_at, appt.timezone)}
                </td>
                <td className="px-4 py-3">
                  {lead ? (
                    <Link href={`/leads/${lead.id}`} className="text-slate-900 underline-offset-2 hover:underline">
                      {lead.first_name} {lead.last_name ?? ""}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{lead?.address ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{lead?.phone_number ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{appt.appointment_type.replace(/_/g, "-")}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={appt.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
