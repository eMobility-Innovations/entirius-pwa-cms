// Required features of a feature set (PIM >= 3.3.0): effective flag, create-form rows, attribute payload, tri-state.

const T9N_TYPES = [4, 6]
const TYPE_BOOL = 1
const TYPE_SINGLE = 7
const TYPE_MULTI = 8
const TYPE_JSON = [9, 11]

/** The membership's effective flag when the PIM sends it, else the feature's own default. */
export function effectiveRequired(item) {
  return item?.is_required ?? item?.feature?.is_required ?? false
}

/** Membership override as the tri-state control value; a PIM without the field reads as "inherit". */
export function overrideToState(override) {
  if (override === true) return 'required'
  if (override === false) return 'optional'
  return 'inherit'
}

export function stateToOverride(state) {
  if (state === 'required') return true
  if (state === 'optional') return false
  return null
}

/** An empty, required attribute row for a feature of the required-features answer. */
export function requiredRow(feature) {
  return {
    feature_idx: feature.idx,
    feature_name: feature.name || feature.idx,
    feature_type: feature.feature_type,
    is_required: true,
    value_bool: null,
    value_decimal: null,
    value_txt: null,
    value_txt_t9n: null,
    value_datetime: null,
    value_json: null,
    attribute_idx: null,
    attribute_idxs: [],
  }
}

const hasText = (v) => typeof v === 'string' && v.trim() !== ''

/** Whether the operator gave the row a value (a switch always holds one). */
export function isRowFilled(row) {
  const type = row.feature_type
  if (type === TYPE_BOOL) return true
  if (T9N_TYPES.includes(type)) return Object.values(row.value_txt_t9n || {}).some(hasText)
  if (type === TYPE_SINGLE) return Boolean(row.attribute_idx)
  if (type === TYPE_MULTI) return (row.attribute_idxs || []).length > 0
  if (TYPE_JSON.includes(type)) return row.value_json != null && row.value_json !== ''
  if (row.value_datetime) return true
  if (row.value_decimal != null && row.value_decimal !== '') return true
  return hasText(row.value_txt) || hasText(row.value_txt_t9n)
}

/** `attributes` of the product create payload: the shape AttributeEditor emits, filled rows only. */
export function buildAttributePayload(rows) {
  return rows.filter(isRowFilled).map((r) => ({
    feature_idx: r.feature_idx,
    value_bool: r.value_bool ?? null,
    value_decimal: r.value_decimal ?? null,
    value_txt: r.value_txt ?? null,
    value_txt_t9n: r.value_txt_t9n ?? null,
    value_datetime: r.value_datetime ?? null,
    value_json: r.value_json ?? null,
    attribute_idx: r.attribute_idx ?? null,
    attribute_idxs: r.attribute_idxs || [],
  }))
}

/** Rows of the required-features answer (array or paginated), system features first as the backend orders them. */
export function rowsFromRequired(data) {
  const items = Array.isArray(data) ? data : data?.results || []
  return items.filter((i) => i?.feature?.idx).map((i) => requiredRow(i.feature))
}
