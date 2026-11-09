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
