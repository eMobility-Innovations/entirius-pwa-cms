import { GET_Product } from "@/api/pim/api";
import { sourceText } from "./reviewLogic";

const SOURCE_FEATURE = "idosell_hints"; // what the shop said about the product: what the AI read
const SOURCE_LANGUAGE = "en";

/** What the shop said about a proposal's product; "" when it cannot be read. Read on demand, never per page. */
export async function loadSource(proposal) {
  try {
    const { data } = await GET_Product(proposal.target_locator.channel, proposal.subject_ref);
    return sourceText(data, SOURCE_FEATURE, SOURCE_LANGUAGE);
  } catch {
    return "";
  }
}
