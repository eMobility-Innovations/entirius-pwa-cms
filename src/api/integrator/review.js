import { enrichmentApi } from "@/api/enrichment/client";

const REVIEW = "/api/integrator/v1/review";

export const getReviewProduct = (sku) =>
  enrichmentApi.get(`${REVIEW}/product/${encodeURIComponent(sku)}/`);

// body: { sku, reason? }
export const sendBack = (data) =>
  enrichmentApi.post(`${REVIEW}/send-back/`, data);

export const getMissing = (sku) =>
  enrichmentApi.get(`${REVIEW}/missing/${encodeURIComponent(sku)}/`);

// body: { sku, feature_idx, value }
export const fillMissing = (data) =>
  enrichmentApi.post(`${REVIEW}/fill/`, data);

export const POST_ReviewNext = (after) =>
  enrichmentApi.post(`${REVIEW}/next/`, after ? { after } : {});

export const POST_ReviewRelease = (sku) => enrichmentApi.post(`${REVIEW}/release/`, { sku });

export const POST_ReviewSkip = (sku, note) =>
  enrichmentApi.post(`${REVIEW}/skip/`, { sku, ...(note?.trim() ? { note: note.trim() } : {}) });

export const GET_ReviewSkipped = (params) => enrichmentApi.get(`${REVIEW}/skipped/`, { params });

export const POST_ReviewUnskip = (sku) => enrichmentApi.post(`${REVIEW}/unskip/`, { sku });

export const GET_ReviewCounts = () => enrichmentApi.get(`${REVIEW}/counts/`);

/**
 * Sends the release through the shared enrichment client, so its session handling (the pre-request
 * expiring-session check and the 401 retry) applies. The keepalive fetch request outlives the closing
 * tab; failure must never block navigation.
 */
export async function releaseOnLeave(sku) {
  if (!sku) return;
  try {
    await enrichmentApi.post(`${REVIEW}/release/`, { sku }, { adapter: "fetch", fetchOptions: { keepalive: true } });
  } catch {
    // A closing tab cannot report a failed best-effort release; its reservation also expires server-side.
  }
}
