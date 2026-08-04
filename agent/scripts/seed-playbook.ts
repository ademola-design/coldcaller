// Seeds objection_playbook from supabase/playbook-seed.json.
// Idempotent: clears the table first, then re-inserts, so re-running after
// editing the JSON gives you exactly what's in the file.
//
// Run with: npm run seed-playbook

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSupabaseAdmin } from "../lib/supabase";

async function main() {
  const seedPath = join(process.cwd(), "..", "supabase", "playbook-seed.json");
  const rows = JSON.parse(readFileSync(seedPath, "utf8")) as Array<Record<string, unknown>>;

  const supabase = getSupabaseAdmin();

  const { error: deleteError } = await supabase
    .from("objection_playbook")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteError) throw deleteError;

  const { data, error } = await supabase.from("objection_playbook").insert(rows).select("id");
  if (error) throw error;

  console.log(`Seeded ${data.length} objection playbook entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
