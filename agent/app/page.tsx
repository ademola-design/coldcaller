export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>AI Cold Caller — Agent Service</h1>
      <p>This deployment has no UI. It exposes:</p>
      <ul>
        <li><code>GET /api/health</code></li>
        <li><code>POST /api/vapi/webhook</code> — Vapi tool calls + end-of-call reports</li>
        <li><code>POST /api/calls/trigger</code> — start an outbound call to a lead</li>
      </ul>
    </main>
  );
}
