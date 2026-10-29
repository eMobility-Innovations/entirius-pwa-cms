import { reactive, ref, computed } from "vue"
import { t } from "@/i18n"
import { SessionEndedError } from "@/api/createClient"
import { formatError } from "@/utils/formats"

/** Join a DRF field value ([msg] | msg) into a single non-empty string. */
function asMessage(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ")
  if (typeof value === "string") return value
  return ""
}

/** True for a DRF field-error dict: every value is a string or an array of strings. */
function isFieldDict(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false
  const values = Object.values(obj)
  if (!values.length) return false
  return values.every((v) => typeof v === "string" || (Array.isArray(v) && v.every((m) => typeof m === "string")))
}

/** First readable message inside a field dict, or "". */
function firstFieldMessage(dict) {
  if (!isFieldDict(dict)) return ""
  for (const value of Object.values(dict)) {
    const msg = asMessage(value)
    if (msg) return msg
  }
  return ""
}

/** Field errors must never carry an empty msg (an empty msg renders an empty red line). */
function fieldError(msg) {
  return { status: "error", msg: msg || t("notifications.error") }
}

/**
 * Resolve the API error body regardless of how it reached us.
 * - Axios error: the body lives under `err.response.data`.
 * - The createClient token-refresh interceptor rejects non-401/403 with the UNWRAPPED body
 *   (`reject(err.response.data)`), so for those clients `err` itself IS already the body.
 * Recognized unwrapped bodies: v2/legacy envelope (`error`/`debug_id`/`details`/`detail`),
 * DRF-in-envelope `{ meta, data }`, and a raw DRF field dict `{ field: [msg] }`. A bare network
 * `Error` (which also has `message`) matches none of these.
 */
function resolveErrorBody(err) {
  if (err?.response?.data) return err.response.data
  if (!err || typeof err !== "object") return null
  if ("error" in err || "debug_id" in err || "details" in err || "detail" in err) return err
  if ("meta" in err && "data" in err) return err
  if (isFieldDict(err)) return err
  return null
}

// The v2 handler's fixed summary of every DRF ValidationError (django_utils v2_errors).
const GENERIC_VALIDATION_MESSAGE = "Request validation failed."

/**
 * A v2 400's own reason in place of the fixed summary: a service refusal (a ValueError, no field) carries its
 * reason only in `details`. A message the endpoint wrote itself stays first.
 */
function validationReason(data) {
  if (data.message && data.message !== GENERIC_VALIDATION_MESSAGE) return ""
  if (!Array.isArray(data.details)) return ""
  return data.details.find((d) => !d?.field && d?.description)?.description || ""
}

/**
 * Extract a human-readable message from an API error response.
 * v2 shape: `{ error, message, debug_id, details: [...] }`
 * Legacy: `{ detail: "..." | [...pydantic...] }`
 * DRF-in-envelope: `{ meta: { message }, data: { field: [msg] } | { detail } }`
 * Raw DRF: `{ field: [msg] }`
 */
export function extractApiMessage(err, fallback = "") {
  const data = resolveErrorBody(err)
  if (!data) return fallback
  // An access refusal already has its standard toast (createClient): the same text, so the view's toast is covered.
  if (data.accessHandled) return t("access.denied_action")
  const reason = validationReason(data)
  if (reason) return reason
  if (typeof data.message === "string" && data.message) return data.message
  if (typeof data.detail === "string" && data.detail) return data.detail
  if (Array.isArray(data.details) && data.details[0]?.description) return data.details[0].description
  if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg
  if (typeof data.data?.detail === "string" && data.data.detail) return data.data.detail
  const envelopeMsg = firstFieldMessage(data.data)
  if (envelopeMsg) return envelopeMsg
  if (typeof data.meta?.message === "string" && data.meta.message) return data.meta.message
  return firstFieldMessage(data) || fallback
}

/** Optional debug_id for support / log correlation. */
export function extractDebugId(err) {
  return resolveErrorBody(err)?.debug_id || ""
}

export function useFormErrors() {
  const errors = reactive({})
  const lastMessage = ref("")
  const lastDebugId = ref("")

  const hasErrors = computed(() => Object.keys(errors).length > 0)

  const summary = computed(() => {
    const firstKey = Object.keys(errors)[0]
    if (firstKey) return errors[firstKey].msg
    return lastMessage.value
  })

  function handleApiError(err) {
    if (err instanceof SessionEndedError) return
    clearErrors()
    lastMessage.value = extractApiMessage(err)
    lastDebugId.value = extractDebugId(err)
    const data = resolveErrorBody(err)
    if (!data) return
    if (Array.isArray(data.details)) return applyV2Details(data.details)
    if (Array.isArray(data.detail)) return applyPydanticDetail(data.detail)
    if (isFieldDict(data.data)) return applyFieldDict(data.data)
    if (isFieldDict(data)) applyFieldDict(data)
  }

  // v2 format: { error, message, details: [{ field, description, issue }] }
  function applyV2Details(details) {
    for (const d of details) {
      if (d.field) errors[String(d.field).split(".").pop()] = fieldError(d.description || d.message || d.issue)
    }
  }

  // Legacy: { detail: [...pydantic errors...] }
  function applyPydanticDetail(detail) {
    for (const d of detail) {
      const field = d.loc?.[d.loc.length - 1]
      if (field) errors[field] = fieldError(d.msg)
    }
  }

  // DRF: { field: [msg, ...] | msg } — raw or under an { meta, data } envelope
  function applyFieldDict(dict) {
    for (const [field, value] of Object.entries(dict)) {
      errors[field] = fieldError(asMessage(value))
    }
  }

  function getFieldError(name) {
    return errors[name] || null
  }

  function clearFieldError(name) {
    delete errors[name]
  }

  function clearErrors() {
    Object.keys(errors).forEach((k) => delete errors[k])
    lastMessage.value = ""
    lastDebugId.value = ""
  }

  function validateRequired(form, rules) {
    clearErrors()
    let valid = true
    for (const [field, label] of Object.entries(rules)) {
      const val = form[field]
      if (val === null || val === undefined || val === "") {
        errors[field] = { status: "error", msg: `${label} is required` }
        valid = false
      }
    }
    return valid
  }

  // Formats (src/utils/formats.js) before a save: rules = { field: { format, min, max, pattern } }. Keeps the errors
  // already set (run it after validateRequired); an empty value is required's business, a valid one loses its old error.
  function validateFormats(form, rules) {
    let valid = true
    for (const [field, { format, ...limits }] of Object.entries(rules)) {
      const msg = formatError(format, form[field], limits)
      if (msg) errors[field] = fieldError(msg)
      else if (form[field] !== null && form[field] !== undefined && form[field] !== "") delete errors[field]
      valid = valid && !msg
    }
    return valid
  }

  return {
    errors,
    hasErrors,
    summary,
    lastMessage,
    lastDebugId,
    handleApiError,
    getFieldError,
    clearFieldError,
    clearErrors,
    validateRequired,
    validateFormats,
  }
}
