import { GET_Proposals } from "@/api/enrichment/api";
import { isConflict } from "@/api/createClient";
import { acceptChosen } from "./applyMode";
import { acceptOrder } from "./reviewLogic";

const MAX_PROPOSALS = 100; // the API's page limit; a product has far fewer pending proposals
// Enrichment _lock_unchanged has no dedicated error code in 2.3.0.
const PROPOSAL_CHANGED = "proposal changed meanwhile";

export function isDecidedElsewhere(err) {
  if (isConflict(err)) return true;
  const status = err?.httpStatus ?? err?.response?.status;
  const body = err?.response?.data ?? err;
  return status === 400 && body?.error === "VALIDATION_ERROR" && Array.isArray(body.details) &&
    body.details.some((d) => typeof d?.description === "string" && d.description.startsWith(PROPOSAL_CHANGED));
}

// Apply every pending proposal of a product, the feature set first. They are read fresh, not taken from the page:
// a product's proposals can sit on two pages. Stops at a drifted proposal, which needs a conscious re-confirm, and
// reports it; an error leaves what was applied applied and rethrows.
export async function acceptProduct(subjectRef) {
  const params = { subject_ref: subjectRef, status: "pending", page_size: MAX_PROPOSALS };
  const { data } = await GET_Proposals(params);
  let accepted = 0;
  for (const proposal of acceptOrder(data.results || [])) {
    const { data: result } = await acceptChosen(proposal);
    if (result.status === "drifted") return { accepted, drifted: result };
    accepted += 1;
  }
  return { accepted, drifted: null };
}
