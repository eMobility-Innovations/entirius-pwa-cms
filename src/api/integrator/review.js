import Cookies from "universal-cookie";
import { enrichmentApi } from "@/api/enrichment/client";

const REVIEW = "/api/integrator/v1/review";
const cookies = new Cookies();

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

/** Keep the authenticated release alive while the document leaves; failure must never block navigation. */
export async function releaseOnLeave(sku) {
  if (!sku) return;
  try {
    const token = cookies.get("token");
    if (!token) return;
    const base = (process.env.VUE_APP_API_URL || "").replace(/\/$/, "");
    await fetch(`${base}${REVIEW}/release/`, {
      method: "POST",
      keepalive: true,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sku }),
    });
  } catch {
    // A closing tab cannot report a failed best-effort release; its reservation also expires server-side.
  }
}
