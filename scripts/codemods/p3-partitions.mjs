// P3 sweep partitions (dev-plans § Streams): plan 17 rewrites partition 1, plan 18 partition 2, at the same time.
// Boots are the implementations and the catalogue shows them: neither belongs to a partition.
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PARTITION_2_VIEWS = [
  "Promo", "Atlas", "Faq", "ContactForms", "EnrichmentReview", "EnrichmentSpawnRules", "EnrichmentTasks",
  "LayoutExtenders", "Emails", "Builder", "Authors", "Accounts", "CheckoutOrders", "ContentSets",
  "TranslationDashboard", "Docs", "Home", "Leads", "Communicator", "ChangePassword", "PasswordReset", "SsoCallback",
];
const OUTSIDE = ["src/boots/", "src/views/UiCatalogue/"];

// 1, 2, or null for a file no sweep touches. `file` is relative to the repo root ("src/views/Pim/ProductList.vue").
export function partitionOf(file) {
  if (!file.startsWith("src/") || !file.endsWith(".vue")) return null;
  if (OUTSIDE.some((dir) => file.startsWith(dir))) return null;
  const inPartition2 =
    file === "src/views/Gallery.vue" || PARTITION_2_VIEWS.some((view) => file.startsWith(`src/views/${view}/`));
  return inPartition2 ? 2 : 1;
}

function* vueFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* vueFiles(path);
    else if (entry.name.endsWith(".vue")) yield relative(ROOT, path);
  }
}

// Every swept file, or only those of one partition; sorted, relative to the repo root.
export function partitionFiles(part) {
  const files = [...vueFiles(join(ROOT, "src"))].filter((file) => partitionOf(file) !== null);
  return (part ? files.filter((file) => partitionOf(file) === part) : files).sort();
}
