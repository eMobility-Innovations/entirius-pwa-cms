import { ref, computed } from "vue"
import { GET_FeatureSetRequiredFeatures } from "@/api/pim/api"
import { isNotFound } from "@/api/createClient"

// Per-feature-set required flags arrived with PIM 3.3.0. null = not probed yet, false = older PIM (legacy mode).
// Module state: the probe runs once per session, shared by every view.
const requiredPerFeatureSet = ref(null)

/** A features list of a 3.3.0 PIM carries `is_required_override` on every member; an older one never does. */
export function noteFeatureList(items) {
  if (requiredPerFeatureSet.value !== null || !Array.isArray(items) || !items.length) return
  requiredPerFeatureSet.value = items.some((i) => i && "is_required_override" in i)
}

/**
 * Required features of a set → the answer body, or null in legacy mode. The first call is the probe: 404 marks the
 * session legacy and is never asked again. Any other failure says nothing about the version: null now, asked again.
 */
export async function loadRequiredFeatures(featureSetIdx) {
  if (requiredPerFeatureSet.value === false || !featureSetIdx) return null
  try {
    const { data } = await GET_FeatureSetRequiredFeatures(featureSetIdx)
    requiredPerFeatureSet.value = true
    return data
  } catch (err) {
    if (isNotFound(err)) requiredPerFeatureSet.value = false
    return null
  }
}

export function resetPimCapabilities() {
  requiredPerFeatureSet.value = null
}

export function usePimCapabilities() {
  return {
    requiredPerFeatureSet: computed(() => requiredPerFeatureSet.value === true),
    loadRequiredFeatures,
    noteFeatureList,
  }
}
