import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  qualified: "bg-indigo-100 text-indigo-700",
  appointment_booked: "bg-emerald-100 text-emerald-700",
  appointment_confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-teal-100 text-teal-700",
  closed_won: "bg-green-100 text-green-800",
  disqualified: "bg-amber-100 text-amber-800",
  closed_lost: "bg-rose-100 text-rose-700",
  do_not_call: "bg-red-100 text-red-800",
  // call outcomes
  in_progress: "bg-sky-100 text-sky-700",
  callback_requested: "bg-violet-100 text-violet-700",
  not_interested: "bg-rose-100 text-rose-700",
  voicemail: "bg-slate-100 text-slate-600",
  no_answer: "bg-slate-100 text-slate-600",
  wrong_number: "bg-slate-100 text-slate-600",
  do_not_call_requested: "bg-red-100 text-red-800",
  escalated_to_human: "bg-orange-100 text-orange-800",
  scheduled: "bg-emerald-100 text-emerald-700",
  confirmed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-700",
  no_show: "bg-amber-100 text-amber-800",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Nav({ current }: { current: "appointments" | "leads" }) {
  const linkClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-tight text-slate-900">AI Cold Caller</span>
          <nav className="flex gap-1">
            <Link href="/" className={linkClass(current === "appointments")}>
              Appointments
            </Link>
            <Link href="/leads" className={linkClass(current === "leads")}>
              Leads
            </Link>
          </nav>
        </div>
        <form action="/api/signout" method="post">
          <button type="submit" className="text-sm text-slate-500 hover:text-slate-900">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function formatDateTime(iso: string | null, timezone?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

export function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
