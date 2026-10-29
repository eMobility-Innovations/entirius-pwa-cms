import { reactive } from "vue";
import { t } from "@/i18n";
import { pluralKey } from "@/utils/plural";
import { createLimiter } from "@/utils/limit";
import { GET_Proposals } from "@/api/enrichment/api";
import { taskLabel } from "@/views/Pim/components/enrichment/productAi";
import { runUidOf } from "./reviewLogic";

// One AI run in people's words, the same on the Review strip, the Review rows, the Runs rows and the run's drawer:
// what ran (`runName`) and what it covered (`runScope`) — "Opis produktu · Orion Command Sofa", "Opis produktu ·
// 12 products". A task carries its products' SKUs only: a one-product run is named by its product once a proposal
// told its name (`noteProductNames` from proposals at hand, `loadProductNames` asks one proposal of the run).

// SKU → product name, for the page session.
const productNames = reactive({});
const asked = new Set();
const limit = createLimiter(4);

const onlyRef = (task) => {
  const refs = task?.scope_spec?.refs || [];
  return refs.length === 1 && !runUidOf({ subject_ref: refs[0] }) ? refs[0] : "";
};

/** What ran: its template, else its worker, else its Studio step ("Article: Outline"), else "AI task" — never a key. */
export function runName(task, workers = [], templates = []) {
  const named = taskLabel(task, workers, templates);
  if (named) return named;
  const stepKey = `enrichment.review.step.${task?.params?.step}`;
  const step = t(stepKey);
  return step === stepKey ? t("enrichment.tasks.generic") : t("enrichment.tasks.studio_step", { step });
}

/** What it covered: an article's topic, one product by name (else its SKU), "12 products", or "Started by a rule". */
export function runScope(task) {
  const topic = task?.params?.brief?.topic;
  if (topic) return topic;
  const ref = onlyRef(task);
  if (ref) return productNames[ref] || ref;
  const count = (task?.scope_spec?.refs || []).length;
  if (count > 1) return t(`enrichment.tasks.products_${pluralKey(count)}`, { count });
  return task?.params?.spawn_rule ? t("enrichment.tasks.from_rule") : "";
}

/** "Opis produktu · Orion Command Sofa". */
export const runTitle = (task, workers = [], templates = []) =>
  [runName(task, workers, templates), runScope(task)].filter(Boolean).join(" · ");

/** A product by its name once a proposal told it, else its SKU. */
export const productName = (ref) => productNames[ref] || ref;

/** Product names the caller already holds: the proposals on screen. */
export function noteProductNames(proposals) {
  for (const { subject_ref: ref, subject_label: label } of proposals) {
    if (ref && label && label !== ref) productNames[ref] = label;
  }
}

/** The names of the one-product runs' products not known yet: one proposal of each run tells it. */
export async function loadProductNames(tasks) {
  const missing = new Map(); // SKU → the first run of it
  for (const task of tasks) {
    const ref = onlyRef(task);
    if (ref && !(ref in productNames) && !asked.has(ref) && !missing.has(ref)) missing.set(ref, task.id);
  }
  missing.forEach((_id, ref) => asked.add(ref));
  await Promise.all([...missing].map(([ref, taskId]) => limit(() => askName(ref, taskId))));
}

async function askName(ref, taskId) {
  try {
    const { data } = await GET_Proposals({ task: taskId, status: "all", page_size: 1 });
    noteProductNames(data.results || []);
  } catch {
    asked.delete(ref); // asked again on the next load
  }
}

/** Test seam: forget every name. */
export function resetProductNames() {
  Object.keys(productNames).forEach((ref) => delete productNames[ref]);
  asked.clear();
}
