import { reviewsApi } from "./client";

const REVIEWS = "/api/reviews/v2/admin";
const TRANSLATOR = "/api/reviews-translator/v2/admin";

// --- Moderation queue ---

export const GET_Reviews = (params) =>
  reviewsApi.get(`${REVIEWS}/reviews/`, { params });

export const GET_Review = (id) => reviewsApi.get(`${REVIEWS}/reviews/${id}/`);

export const PATCH_Review = (id, data) =>
  reviewsApi.patch(`${REVIEWS}/reviews/${id}/`, data);

export const DELETE_Review = (id) =>
  reviewsApi.delete(`${REVIEWS}/reviews/${id}/`);

export const POST_ApproveReview = (id) =>
  reviewsApi.post(`${REVIEWS}/reviews/${id}/approve/`);

export const POST_RejectReview = (id, data = {}) =>
  reviewsApi.post(`${REVIEWS}/reviews/${id}/reject/`, data);

export const POST_ArchiveReview = (id) =>
  reviewsApi.post(`${REVIEWS}/reviews/${id}/archive/`);

export const POST_RequeueReview = (id) =>
  reviewsApi.post(`${REVIEWS}/reviews/${id}/requeue/`);

// Bulk acts on explicit ids (DataTable selection), max 500 per call.
export const POST_BulkApproveReviews = (ids) =>
  reviewsApi.post(`${REVIEWS}/reviews/bulk-approve/`, { ids });

export const POST_BulkRejectReviews = (ids, reason = "") =>
  reviewsApi.post(`${REVIEWS}/reviews/bulk-reject/`, { ids, reason });

export const POST_BulkArchiveReviews = (ids) =>
  reviewsApi.post(`${REVIEWS}/reviews/bulk-archive/`, { ids });

// --- Translations (manual) ---

export const GET_ReviewTranslations = (id) =>
  reviewsApi.get(`${REVIEWS}/reviews/${id}/translations/`);

export const POST_ReviewTranslation = (id, data) =>
  reviewsApi.post(`${REVIEWS}/reviews/${id}/translations/`, data);

export const PATCH_ReviewTranslation = (id, language, data) =>
  reviewsApi.patch(`${REVIEWS}/reviews/${id}/translations/${language}/`, data);

export const DELETE_ReviewTranslation = (id, language) =>
  reviewsApi.delete(`${REVIEWS}/reviews/${id}/translations/${language}/`);

// --- Merchant reply ---

export const PUT_ReviewReply = (id, data) =>
  reviewsApi.put(`${REVIEWS}/reviews/${id}/reply/`, data);

export const DELETE_ReviewReply = (id) =>
  reviewsApi.delete(`${REVIEWS}/reviews/${id}/reply/`);

// Reply translations - 404 until the reply itself exists.
export const POST_ReviewReplyTranslation = (id, data) =>
  reviewsApi.post(`${REVIEWS}/reviews/${id}/reply/translations/`, data);

export const PATCH_ReviewReplyTranslation = (id, language, data) =>
  reviewsApi.patch(`${REVIEWS}/reviews/${id}/reply/translations/${language}/`, data);

// --- Photos ---

export const POST_ApproveReviewImage = (id, imageId) =>
  reviewsApi.post(`${REVIEWS}/reviews/${id}/images/${imageId}/approve/`);

export const POST_RejectReviewImage = (id, imageId) =>
  reviewsApi.post(`${REVIEWS}/reviews/${id}/images/${imageId}/reject/`);

export const DELETE_ReviewImage = (id, imageId) =>
  reviewsApi.delete(`${REVIEWS}/reviews/${id}/images/${imageId}/`);

// --- Products (pool aggregates) ---

export const GET_ReviewProducts = (params) =>
  reviewsApi.get(`${REVIEWS}/products/`, { params });

// --- AI translation (django-reviews-translator) ---

export const POST_TranslateReview = (channelIdx, id, data) =>
  reviewsApi.post(`${TRANSLATOR}/${channelIdx}/reviews/${id}/translate/`, data);
