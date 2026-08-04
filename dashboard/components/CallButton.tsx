"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CallButton({ leadId, disabled }: { leadId: string; disabled?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "calling" | "started">("idle");
  const [error, setError] = useState<string | null>(null);

  async function triggerCall() {
    setState("calling");
    setError(null);

    const res = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Call failed to start");
      setState("idle");
      return;
    }

    setState("started");
    router.refresh();
  }

  if (disabled) {
    return <span className="text-xs text-slate-400">Do not call</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={triggerCall}
        disabled={state !== "idle"}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {state === "calling" ? "Starting…" : state === "started" ? "Call started" : "Call now"}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
