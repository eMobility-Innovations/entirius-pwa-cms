import { GET_Workers } from "@/api/enrichment/api";
import { listOf } from "@/api/enrichment/listOf";
import { workerOf } from "./reviewLogic";

// The AI model behind a proposal, read from its worker (`source` = "worker:<key>@v<n>"): the worker's current model,
// "" when it uses the toolbox default, null when the worker is unknown. The workers load once per page session.
let workers = null;

function loadWorkers() {
  workers ??= GET_Workers()
    .then(({ data }) => listOf(data))
    .catch(() => {
      workers = null; // a failure is not remembered
      return [];
    });
  return workers;
}

/** The model of the proposal's worker: a name, "" (toolbox default) or null (no worker known). */
export async function modelOf(source) {
  const key = workerOf(source).replace(/@v\d+$/, "");
  if (!key) return null;
  const worker = (await loadWorkers()).find((w) => w.key === key);
  return worker ? worker.model || "" : null;
}

/** Test seam: forget the loaded workers. */
export const clearWorkerCache = () => {
  workers = null;
};
