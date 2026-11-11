import { GET_Proposals } from "@/api/enrichment/api";
import { acceptChosen } from "./applyMode";
import { acceptOrder } from "./reviewLogic";

const MAX_PROPOSALS = 100; // the API's page limit; a product has far fewer pending proposals

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
