import { describe, it, expect } from "vitest";
import {
  effectiveRequired,
  overrideToState,
  stateToOverride,
  requiredRow,
  isRowFilled,
  buildAttributePayload,
  rowsFromRequired,
} from "@/views/Pim/helpers/requiredFeatures";
import { useFormErrors } from "@/composables/useFormErrors";

describe("effectiveRequired", () => {
  it("prefers the membership flag, falls back to the feature's own", () => {
    expect(effectiveRequired({ is_required: false, feature: { is_required: true } })).toBe(false);
    expect(effectiveRequired({ is_required: true, feature: { is_required: false } })).toBe(true);
    expect(effectiveRequired({ feature: { is_required: true } })).toBe(true);
    expect(effectiveRequired({})).toBe(false);
  });
});

describe("tri-state mapping", () => {
  it("round-trips inherit / required / optional", () => {
    expect(overrideToState(null)).toBe("inherit");
    expect(overrideToState(undefined)).toBe("inherit");
    expect(overrideToState(true)).toBe("required");
    expect(overrideToState(false)).toBe("optional");
    expect(["inherit", "required", "optional"].map(stateToOverride)).toEqual([null, true, false]);
  });
});

describe("attribute payload", () => {
  const name = { ...requiredRow({ idx: "name", name: "Name", feature_type: 4 }) };

  it("rows come from the required-features answer, array or paginated", () => {
    const items = [{ feature: { idx: "name", name: "Name", feature_type: 4 }, source: "system" }];
    expect(rowsFromRequired(items)).toHaveLength(1);
    expect(rowsFromRequired({ results: items })[0].is_required).toBe(true);
    expect(rowsFromRequired(null)).toEqual([]);
  });

  it("an empty translatable row is not filled, a typed one is sent in the editor's shape", () => {
    expect(isRowFilled(name)).toBe(false);
    name.value_txt_t9n = { pl: "Krzesło" };
    expect(isRowFilled(name)).toBe(true);
    expect(buildAttributePayload([name])).toEqual([
      {
        feature_idx: "name",
        value_bool: null,
        value_decimal: null,
        value_txt: null,
        value_txt_t9n: { pl: "Krzesło" },
        value_datetime: null,
        value_json: null,
        attribute_idx: null,
        attribute_idxs: [],
      },
    ]);
  });

  it("select, number and text types count their own value", () => {
    expect(isRowFilled({ feature_type: 7, attribute_idx: "red" })).toBe(true);
    expect(isRowFilled({ feature_type: 8, attribute_idxs: [] })).toBe(false);
    expect(isRowFilled({ feature_type: 2, value_decimal: 0 })).toBe(true);
    expect(isRowFilled({ feature_type: 3, value_txt: "  " })).toBe(false);
    expect(buildAttributePayload([{ feature_type: 3, feature_idx: "a", value_txt: "" }])).toEqual([]);
  });
});

describe("REQUIRED_FEATURE_MISSING mapping", () => {
  it("attributes.<idx> details become field errors keyed by the feature idx", () => {
    const formErrors = useFormErrors();
    formErrors.handleApiError({
      response: {
        data: {
          error: "VALIDATION_ERROR",
          message: "Validation failed",
          details: [
            { field: "attributes.name", location: "body", issue: "REQUIRED_FEATURE_MISSING", description: "Name is required" },
            { field: "attributes.color", location: "body", issue: "UNRESOLVED_ATTRIBUTE", description: "Unknown value" },
          ],
        },
      },
    });
    expect(formErrors.getFieldError("name").msg).toBe("Name is required");
    expect(formErrors.getFieldError("color").msg).toBe("Unknown value");
  });
});
