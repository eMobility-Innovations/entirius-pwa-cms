import { pimApi } from './client'

const PIM = '/api/pim/v2/admin'

// --- Products ---

export const GET_Products = (channelIdx, params) =>
  pimApi.get(`${PIM}/${channelIdx}/products/`, { params })

export const GET_Product = (channelIdx, sku) =>
  pimApi.get(`${PIM}/${channelIdx}/products/${sku}/`)

export const POST_Product = (channelIdx, data) =>
  pimApi.post(`${PIM}/${channelIdx}/products/`, data)

export const PATCH_Product = (channelIdx, sku, data) =>
  pimApi.patch(`${PIM}/${channelIdx}/products/${sku}/`, data)

export const DELETE_Product = (channelIdx, sku) =>
  pimApi.delete(`${PIM}/${channelIdx}/products/${sku}/`)

export const POST_BulkUpdateProducts = (channelIdx, data) =>
  pimApi.post(`${PIM}/${channelIdx}/products/bulk/`, data)

// Quality gaps (highlighter) — bulk findings for a page of product PKs.
// Returns { results: { "<pk>": [ {definition_key, label_t9n, severity, language, inherited, source_channel} ] } }.
// Sparse (OK products absent); soft-compat — old PIM lacks the endpoint (404 → caller falls back to {}).
export const GET_BulkProductGaps = (channelIdx, productIds, params = {}) =>
  pimApi.get(`${PIM}/${channelIdx}/gaps/findings/`, {
    params: { product_ids: Array.isArray(productIds) ? productIds.join(',') : productIds, ...params },
  })

// Quality gaps — rule CRUD + recompute/status (global, NOT channel-scoped — etap-06).
// Old PIM lacks these endpoints (404) → capability probe + screen self-guard fall back gracefully.

export const GET_GapDefinitions = (params = {}) =>
  pimApi.get(`${PIM}/gap-definitions/`, { params })

export const GET_GapDefinition = (key) =>
  pimApi.get(`${PIM}/gap-definitions/${key}/`)

export const POST_GapDefinition = (data) =>
  pimApi.post(`${PIM}/gap-definitions/`, data)

export const PATCH_GapDefinition = (key, data) =>
  pimApi.patch(`${PIM}/gap-definitions/${key}/`, data)

export const DELETE_GapDefinition = (key) =>
  pimApi.delete(`${PIM}/gap-definitions/${key}/`)

// Rules-changed-vs-recomputed signal (drives the "not recomputed since [date]" alert).
export const GET_GapsStatus = () =>
  pimApi.get(`${PIM}/gaps/status/`)

// Trigger a full recompute (async → 202 {status, running}; idempotent → already_running).
export const POST_GapsRecompute = () =>
  pimApi.post(`${PIM}/gaps/recompute/`)

// Quality gaps settings (global, featureset-cascade etap-04). Old PIM lacks the endpoint →
// callers hide on any failure (interceptor strips .response on non-401/403 — gate on success only).
export const GET_GapSettings = () =>
  pimApi.get(`${PIM}/gaps/settings/`)

export const PATCH_GapSettings = (data) =>
  pimApi.patch(`${PIM}/gaps/settings/`, data)

// --- Categories ---

export const GET_Categories = (channelIdx, params) =>
  pimApi.get(`${PIM}/${channelIdx}/categories/`, { params })

export const GET_Category = (channelIdx, idx) =>
  pimApi.get(`${PIM}/${channelIdx}/categories/${idx}/`)

export const POST_Category = (channelIdx, data) =>
  pimApi.post(`${PIM}/${channelIdx}/categories/`, data)

export const PATCH_Category = (channelIdx, idx, data) =>
  pimApi.patch(`${PIM}/${channelIdx}/categories/${idx}/`, data)

export const DELETE_Category = (channelIdx, idx) =>
  pimApi.delete(`${PIM}/${channelIdx}/categories/${idx}/`)

export const PATCH_CategoriesReorder = (channelIdx, data) =>
  pimApi.patch(`${PIM}/${channelIdx}/categories/reorder/`, data)

export const GET_CategoryProducts = (channelIdx, idx, params) =>
  pimApi.get(`${PIM}/${channelIdx}/categories/${idx}/products/`, { params })

export const PATCH_CategoryProductsReorder = (channelIdx, idx, data) =>
  pimApi.patch(`${PIM}/${channelIdx}/categories/${idx}/products/reorder/`, data)

// --- Feature Sets (global CRUD + channel-scoped read) ---

export const GET_FeatureSets = (channelIdx, params) =>
  pimApi.get(`${PIM}/${channelIdx}/feature-sets/`, { params })

export const GET_FeatureSet = (channelIdx, idx) =>
  pimApi.get(`${PIM}/${channelIdx}/feature-sets/${idx}/`)

export const GET_FeatureSetFeatures = (channelIdx, idx) =>
  pimApi.get(`${PIM}/${channelIdx}/feature-sets/${idx}/features/`)

export const GET_FeatureSetsGlobal = (params) =>
  pimApi.get(`${PIM}/feature-sets/`, { params })

export const GET_FeatureSetGlobal = (idx) =>
  pimApi.get(`${PIM}/feature-sets/${idx}/`)

export const POST_FeatureSet = (data) =>
  pimApi.post(`${PIM}/feature-sets/`, data)

export const PATCH_FeatureSet = (idx, data) =>
  pimApi.patch(`${PIM}/feature-sets/${idx}/`, data)

export const DELETE_FeatureSet = (idx) =>
  pimApi.delete(`${PIM}/feature-sets/${idx}/`)

export const GET_FeatureSetFeaturesGlobal = (idx, params) =>
  pimApi.get(`${PIM}/feature-sets/${idx}/features/`, { params })

export const POST_FeatureSetFeatures = (idx, data) =>
  pimApi.post(`${PIM}/feature-sets/${idx}/features/`, data)

export const DELETE_FeatureSetFeatures = (idx, data) =>
  pimApi.delete(`${PIM}/feature-sets/${idx}/features/`, { data })

export const PATCH_FeatureSetFeaturesReorder = (idx, data) =>
  pimApi.patch(`${PIM}/feature-sets/${idx}/features/reorder/`, data)

// PIM >= 3.3.0: per-set required override of one member ({ is_required: true | false | null }, null = inherit the
// feature's own flag). A system feature answers 400.
export const PATCH_FeatureSetFeature = (idx, featureIdx, data) =>
  pimApi.patch(`${PIM}/feature-sets/${idx}/features/${featureIdx}/`, data)

// PIM >= 3.3.0: [{ feature, source: "system" | "feature" | "feature_set" }]. An older PIM answers 404.
export const GET_FeatureSetRequiredFeatures = (idx) =>
  pimApi.get(`${PIM}/feature-sets/${idx}/required-features/`)

// --- Features (global CRUD) ---

export const GET_Features = (params, channelIdx) =>
  channelIdx
    ? pimApi.get(`${PIM}/${channelIdx}/features/`, { params })
    : pimApi.get(`${PIM}/features/`, { params })

export const GET_Feature = (idx) =>
  pimApi.get(`${PIM}/features/${idx}/`)

export const POST_Feature = (data) =>
  pimApi.post(`${PIM}/features/`, data)

export const PATCH_Feature = (idx, data) =>
  pimApi.patch(`${PIM}/features/${idx}/`, data)

export const DELETE_Feature = (idx) =>
  pimApi.delete(`${PIM}/features/${idx}/`)

export const GET_FeatureAttributes = (idx, channelIdx, params = {}) =>
  channelIdx
    ? pimApi.get(`${PIM}/${channelIdx}/features/${idx}/attributes/`, { params })
    : pimApi.get(`${PIM}/features/${idx}/attributes/`, { params })

// --- Attributes (global CRUD, composite key) ---

export const GET_Attributes = (params) =>
  pimApi.get(`${PIM}/attributes/`, { params })

export const POST_Attribute = (data) =>
  pimApi.post(`${PIM}/attributes/`, data)

export const GET_Attribute = (featureIdx, idx) =>
  pimApi.get(`${PIM}/attributes/${featureIdx}/${idx}/`)

export const PATCH_Attribute = (featureIdx, idx, data) =>
  pimApi.patch(`${PIM}/attributes/${featureIdx}/${idx}/`, data)

export const DELETE_Attribute = (featureIdx, idx) =>
  pimApi.delete(`${PIM}/attributes/${featureIdx}/${idx}/`)

export const PATCH_AttributesReorder = (data) =>
  pimApi.patch(`${PIM}/attributes/reorder/`, data)

// --- Attributes Groups (global CRUD) ---

export const GET_AttributesGroups = (params) =>
  pimApi.get(`${PIM}/attributes-groups/`, { params })

export const GET_AttributesGroup = (idx) =>
  pimApi.get(`${PIM}/attributes-groups/${idx}/`)

export const POST_AttributesGroup = (data) =>
  pimApi.post(`${PIM}/attributes-groups/`, data)

export const PATCH_AttributesGroup = (idx, data) =>
  pimApi.patch(`${PIM}/attributes-groups/${idx}/`, data)

export const DELETE_AttributesGroup = (idx) =>
  pimApi.delete(`${PIM}/attributes-groups/${idx}/`)

// --- Pictures ---

export const POST_UploadPicture = (formData) =>
  pimApi.post(`${PIM}/pictures/upload/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })

export const GET_ProductPictures = (channelIdx, sku, params) =>
  pimApi.get(`${PIM}/${channelIdx}/products/${sku}/pictures/`, { params })

export const POST_ProductPicture = (channelIdx, sku, data) =>
  pimApi.post(`${PIM}/${channelIdx}/products/${sku}/pictures/`, data)

export const PATCH_ProductPicture = (channelIdx, sku, pk, data) =>
  pimApi.patch(`${PIM}/${channelIdx}/products/${sku}/pictures/${pk}/`, data)

export const DELETE_ProductPicture = (channelIdx, sku, pk) =>
  pimApi.delete(`${PIM}/${channelIdx}/products/${sku}/pictures/${pk}/`)

// --- Videos ---

export const GET_ProductVideos = (channelIdx, sku, params) =>
  pimApi.get(`${PIM}/${channelIdx}/products/${sku}/videos/`, { params })

export const POST_ProductVideo = (channelIdx, sku, data) =>
  pimApi.post(`${PIM}/${channelIdx}/products/${sku}/videos/`, data)

export const PATCH_ProductVideo = (channelIdx, sku, pk, data) =>
  pimApi.patch(`${PIM}/${channelIdx}/products/${sku}/videos/${pk}/`, data)

export const DELETE_ProductVideo = (channelIdx, sku, pk) =>
  pimApi.delete(`${PIM}/${channelIdx}/products/${sku}/videos/${pk}/`)

// --- Files ---

export const POST_UploadFile = (formData) =>
  pimApi.post(`${PIM}/files/upload/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })

export const GET_ProductFiles = (channelIdx, sku, params) =>
  pimApi.get(`${PIM}/${channelIdx}/products/${sku}/files/`, { params })

export const POST_ProductFile = (channelIdx, sku, data) =>
  pimApi.post(`${PIM}/${channelIdx}/products/${sku}/files/`, data)

export const DELETE_ProductFile = (channelIdx, sku, pk) =>
  pimApi.delete(`${PIM}/${channelIdx}/products/${sku}/files/${pk}/`)

export const PATCH_File = (pk, data) =>
  pimApi.patch(`${PIM}/files/${pk}/`, data)

export const POST_FilesCategory = (data) =>
  pimApi.post(`${PIM}/files-categories/`, data)

// --- File Categories ---

export const GET_FilesCategories = (params) =>
  pimApi.get(`${PIM}/files-categories/`, { params })

// --- Links ---

export const GET_ProductLinks = (channelIdx, sku, params) =>
  pimApi.get(`${PIM}/${channelIdx}/products/${sku}/links/`, { params })

export const POST_ProductLink = (channelIdx, sku, data) =>
  pimApi.post(`${PIM}/${channelIdx}/products/${sku}/links/`, data)

export const PATCH_ProductLink = (channelIdx, sku, pk, data) =>
  pimApi.patch(`${PIM}/${channelIdx}/products/${sku}/links/${pk}/`, data)

export const DELETE_ProductLink = (channelIdx, sku, pk) =>
  pimApi.delete(`${PIM}/${channelIdx}/products/${sku}/links/${pk}/`)

export const GET_LinkTypes = (params) =>
  pimApi.get(`${PIM}/link-types/`, { params })

// --- Channels ---

export const GET_Channels = (params) =>
  pimApi.get(`${PIM}/channels/`, { params })

// --- Inheritance ---

export const POST_CopyTranslations = (channelIdx, sku, data) =>
  pimApi.post(`${PIM}/${channelIdx}/products/${sku}/copy-translations/`, data)

export const POST_CopyAttributes = (channelIdx, sku, data) =>
  pimApi.post(`${PIM}/${channelIdx}/products/${sku}/copy-attributes/`, data)

export const POST_ToggleMediaOverride = (channelIdx, sku, data) =>
  pimApi.post(`${PIM}/${channelIdx}/products/${sku}/toggle-media-override/`, data)

export const POST_AddToChannel = (channelIdx, sku, data) =>
  pimApi.post(`${PIM}/${channelIdx}/products/${sku}/add-to-channel/`, data)

export const POST_ToggleOverride = (channelIdx, sku, data) =>
  pimApi.post(`${PIM}/${channelIdx}/products/${sku}/toggle-override/`, data)
