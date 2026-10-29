import { reactive } from "vue";
import { POST_AcceptProposal } from "@/api/enrichment/api";

// Add or replace (plan 25): a media proposal whose `apply_modes` offers "replace" (a picture made from one of the
// product's pictures) lands next to the original or in its place. The operator's pick is kept per proposal id for this
// page, so every Apply of it — the card's button, the Focus-mode key, the drift re-confirm — sends the same choice.
// Nothing picked = "add": a result never overwrites without an explicit choice. A bulk apply never sends a mode.
export const MODE_ADD = "add";
export const MODE_REPLACE = "replace";

const chosen = reactive({});

export const canReplace = (proposal) => (proposal?.apply_modes || []).includes(MODE_REPLACE);

export const modeOf = (proposal) => (canReplace(proposal) && chosen[proposal.id]) || MODE_ADD;

export function chooseMode(proposal, mode) {
  chosen[proposal.id] = mode;
}

/** Accept one proposal with the picked mode — `{ mode }` only when it offers a choice (else a plain accept). */
export function acceptChosen(proposal) {
  if (!canReplace(proposal)) return POST_AcceptProposal(proposal.id);
  return POST_AcceptProposal(proposal.id, { mode: modeOf(proposal) });
}
