import { isProductProposal } from "./reviewLogic";

export const createQueueState = () => ({ current: null, history: [], remaining: null, reservedUntil: null });

/** Apply a queue body without recording the same reservation twice when it refreshes. */
export function applyNext(state, response) {
  if (state.current && state.current !== response.sku) state.history.push(state.current);
  state.current = response.sku;
  state.remaining = response.remaining;
  state.reservedUntil = response.reserved_until;
  return state;
}

export const previousSku = (state) => state.history.at(-1) || null;

export function goBack(state) {
  const previous = state.history.pop();
  if (previous) state.current = previous;
  return previous || null;
}

/** The caller records when the card opened or its reservation last refreshed. */
export function needsRefresh(openedAt, now = Date.now(), thresholdMs = 12 * 60 * 1000) {
  if (openedAt == null) return false;
  const opened = typeof openedAt === "number" ? openedAt : Date.parse(openedAt);
  return Number.isFinite(opened) && now - opened >= thresholdMs;
}

export const productsCounterParams = (remaining) => ({ remaining });

export const rowsForSku = (rows, sku) =>
  rows.filter((row) => isProductProposal(row) && row.subject_ref === sku);
