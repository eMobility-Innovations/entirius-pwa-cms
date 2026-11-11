import { GET_Product } from "@/api/pim/api";
import enrichmentConfig from "@/../__client/configs/__enrichment_config";
import { sourceText } from "./reviewLogic";

// The feature that holds what the shop said about the product (what the AI read) and its language, from the client
// config `enrichment.sourceFeature` (`{ idx, language }`). Not set: the source toggle is not rendered.
const source = () => enrichmentConfig.enrichment?.sourceFeature ?? null;

export const hasSource = () => Boolean(source()?.idx);

/** What the shop said about a proposal's product; "" when it cannot be read. Read on demand, never per page. */
export async function loadSource(proposal) {
  const feature = source();
  if (!feature?.idx) return "";
  try {
    const { data } = await GET_Product(proposal.target_locator.channel, proposal.subject_ref);
    return sourceText(data, feature.idx, feature.language);
  } catch {
    return "";
  }
}
