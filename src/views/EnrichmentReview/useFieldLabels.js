import { reactive } from "vue";
import { t, getLang } from "@/i18n";
import { GET_Features } from "@/api/pim/api";

// Human names of PIM fields ("Meta opis", not "meta_description"): the PIM feature catalogue, loaded once per page
// session and shared by every proposal view. Until it arrives (or if it fails) the CMS's own label stands in.
const state = reactive({ features: {}, loading: null });

async function load() {
  try {
    const { data } = await GET_Features({ page_size: 500 });
    state.features = Object.fromEntries((data.results || []).map((f) => [f.idx, f]));
  } catch {
    state.features = {};
  }
}

export function useFieldLabels() {
  if (!state.loading) state.loading = load();

  function feature(idx) {
    return state.features[idx] || null;
  }

  function fieldLabel(idx) {
    if (!idx) return "";
    const named = feature(idx);
    const local = named?.name_t9n?.[getLang().toLowerCase()];
    if (local || named?.name) return local || named.name;
    const key = `pim.${idx}`;
    const label = t(key);
    return label === key ? idx : label;
  }

  /** The heading of a proposal: its field's name, else its Studio step ("Outline"), else its kind ("Product video"). */
  function proposalField(proposal) {
    const label = fieldLabel(proposal.target_locator?.feature_idx);
    if (label) return label;
    const stepKey = `enrichment.review.step.${proposal.target_locator?.step}`;
    const step = t(stepKey);
    if (step !== stepKey) return step;
    const key = `enrichment.review.kind.${proposal.target_kind}`;
    const kind = t(key);
    return kind === key ? proposal.target_kind : kind;
  }

  return { feature, fieldLabel, proposalField };
}
