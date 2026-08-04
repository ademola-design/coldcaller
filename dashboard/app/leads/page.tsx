import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav, StatusBadge, EmptyState } from "@/components/ui";
import { CallButton } from "@/components/CallButton";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = createClient();

  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });

  const leads = (data ?? []) as Lead[];

  return (
    <>
      <Nav current="leads" />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">{leads.length} total</p>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Could not load leads: {error.message}
          </p>
        )}

        <div className="mt-6">
          {leads.length === 0 ? (
            <EmptyState
              title="No leads yet"
              hint="Add rows to the leads table in Supabase, then use “Call now” to start a call."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 font-medium">Bill</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-medium text-slate-900 underline-offset-2 hover:underline"
                        >
                          {lead.first_name} {lead.last_name ?? ""}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{lead.phone_number}</td>
                      <td className="px-4 py-3 text-slate-600">{lead.address ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {lead.average_monthly_bill != null ? `$${lead.average_monthly_bill}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-4 py-3">
                        <CallButton leadId={lead.id} disabled={lead.status === "do_not_call"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
