import { describe, it, expect } from "vitest"
import { extractApiMessage, extractDebugId, useFormErrors } from "@/composables/useFormErrors"
import { SessionEndedError } from "@/api/createClient"

// The token-refresh interceptor (createClient) rejects non-401/403 with the UNWRAPPED v2 body,
// so enrichment/quality catch blocks receive the envelope directly (no `.response`). These guard
// that error helpers read the message from BOTH the axios-wrapped and unwrapped shapes.

const V2_BODY = {
  error: "VALIDATION_ERROR",
  message: "Cannot apply: SKU 'X' on channel 'default' no longer exists in 'pim'.",
  debug_id: "47c23ec9",
  details: [{ field: null, description: "Cannot apply: SKU 'X' ..." }],
}

const DRF_ENVELOPE = { meta: { message: "Validation failed" }, data: { code: ["This code already exists."] } }
const RAW_DRF = { name: ["This field is required."] }

describe("extractApiMessage", () => {
  it("reads message from an axios-wrapped error (err.response.data)", () => {
    expect(extractApiMessage({ response: { data: V2_BODY } })).toBe(V2_BODY.message)
  })

  it("reads message from the UNWRAPPED v2 envelope (interceptor reject shape)", () => {
    expect(extractApiMessage(V2_BODY)).toBe(V2_BODY.message)
  })

  it("a v2 400 tells the service's own reason, not the fixed summary", () => {
    const body = {
      error: "VALIDATION_ERROR",
      message: "Request validation failed.",
      debug_id: "ab12cd34",
      details: [{ field: null, location: "body", issue: "INVALID", description: "only pending or drifted proposals can be revised" }],
    }
    expect(extractApiMessage(body)).toBe("only pending or drifted proposals can be revised")
    expect(extractApiMessage({ response: { data: body } })).toBe("only pending or drifted proposals can be revised")
  })

  it("a v2 400 with field errors only keeps the summary (the fields show their own)", () => {
    const body = { error: "VALIDATION_ERROR", message: "Request validation failed.", details: [{ field: "name", description: "too short" }] }
    expect(extractApiMessage(body)).toBe("Request validation failed.")
  })

  it("falls back to details[0].description when no top-level message", () => {
    const body = { error: "X", details: [{ description: "field is required" }] }
    expect(extractApiMessage(body)).toBe("field is required")
  })

  it("returns the fallback for a bare network Error (not mistaken for a body)", () => {
    expect(extractApiMessage(new Error("Network Error"), "fallback")).toBe("fallback")
  })

  it("returns the fallback for null/undefined", () => {
    expect(extractApiMessage(null, "fb")).toBe("fb")
  })

  it("reads the first field message from a DRF envelope { meta, data: { field: [msg] } }", () => {
    expect(extractApiMessage(DRF_ENVELOPE)).toBe("This code already exists.")
    expect(extractApiMessage({ response: { data: DRF_ENVELOPE } })).toBe("This code already exists.")
  })

  it("falls back to meta.message when the envelope data has no field errors", () => {
    expect(extractApiMessage({ meta: { message: "Bad input" }, data: {} })).toBe("Bad input")
  })

  it("reads data.detail from a DRF envelope { meta, data: { detail } }", () => {
    expect(extractApiMessage({ meta: {}, data: { detail: "Not found." } })).toBe("Not found.")
  })

  it("reads the first field message from a raw DRF dict { field: [msg] }", () => {
    expect(extractApiMessage(RAW_DRF)).toBe("This field is required.")
    expect(extractApiMessage({ response: { data: RAW_DRF } })).toBe("This field is required.")
  })

  it("reads the first pydantic msg from legacy { detail: [...] }", () => {
    expect(extractApiMessage({ detail: [{ loc: ["body", "name"], msg: "field required" }] })).toBe("field required")
  })
})

describe("extractDebugId", () => {
  it("reads debug_id from the unwrapped envelope", () => {
    expect(extractDebugId(V2_BODY)).toBe("47c23ec9")
  })
  it("reads debug_id from the axios-wrapped error", () => {
    expect(extractDebugId({ response: { data: V2_BODY } })).toBe("47c23ec9")
  })
})

describe("useFormErrors.handleApiError", () => {
  // FIX-04d review: the ignored error cleared the form before the check returned.
  it("ignores a SessionEndedError without touching the form state", () => {
    const fe = useFormErrors()
    fe.handleApiError({ error: "VALIDATION_ERROR", message: "bad", details: [{ field: "name", description: "too short" }] })

    fe.handleApiError(new SessionEndedError())

    expect(fe.lastMessage.value).toBe("bad")
    expect(fe.summary.value).toBe("too short")
    expect(fe.getFieldError("name")).toEqual({ status: "error", msg: "too short" })
  })

  it("populates field errors from an unwrapped v2 envelope", () => {
    const fe = useFormErrors()
    fe.handleApiError({ error: "VALIDATION_ERROR", message: "bad", details: [{ field: "name", description: "too short" }] })
    expect(fe.lastMessage.value).toBe("bad")
    expect(fe.getFieldError("name")).toEqual({ status: "error", msg: "too short" })
  })

  it("populates field errors from a DRF envelope { meta, data: { field: [msg] } }", () => {
    const fe = useFormErrors()
    fe.handleApiError(DRF_ENVELOPE)
    expect(fe.getFieldError("code")).toEqual({ status: "error", msg: "This code already exists." })
    expect(fe.summary.value).toBe("This code already exists.")
  })

  it("populates field errors from a raw DRF dict { field: [msg] }", () => {
    const fe = useFormErrors()
    fe.handleApiError(RAW_DRF)
    expect(fe.getFieldError("name")).toEqual({ status: "error", msg: "This field is required." })
  })

  it("guarantees a non-empty msg when the backend omits the description", () => {
    const fe = useFormErrors()
    fe.handleApiError({ error: "X", details: [{ field: "sku" }] })
    expect(fe.getFieldError("sku").msg).toBeTruthy()
  })

  it("normalizes nested field paths (data.code -> code)", () => {
    const fe = useFormErrors()
    fe.handleApiError({ error: "X", details: [{ field: "data.code", message: "dup" }] })
    expect(fe.getFieldError("code")).toEqual({ status: "error", msg: "dup" })
  })
})

describe("validateFormats (plan 61)", () => {
  const RULES = { value: { format: "money" }, ean: { format: "ean" }, max_used: { format: "integer", min: 1 } }

  it("blocks the save with a field error per invalid value", () => {
    const { validateFormats, getFieldError } = useFormErrors()
    expect(validateFormats({ value: "2.345", ean: "5901234123458", max_used: "0" }, RULES)).toBe(false)
    expect(getFieldError("value").msg).toBe("Enter an amount with at most two decimal places, e.g. 232.00")
    expect(getFieldError("ean").msg).toMatch(/check digit/)
    expect(getFieldError("max_used").msg).toBe("Enter 1 or more")
  })

  it("passes valid and empty values, keeps a required error and clears a fixed one", () => {
    const { validateRequired, validateFormats, getFieldError } = useFormErrors()
    validateRequired({ ean: "" }, { ean: "EAN" })
    validateFormats({ value: "2.345" }, RULES)
    expect(getFieldError("value")).not.toBeNull()
    expect(validateFormats({ value: "232.00", ean: "", max_used: null }, RULES)).toBe(true)
    expect(getFieldError("ean").msg).toBe("EAN is required")
    expect(getFieldError("value")).toBeNull()
  })
})
