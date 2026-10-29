// Shared constants for the PriceFighter panel (GapTable, Strategies, DecisionHistory).

export const PF_PAGE_SIZE = 20

// Decision.recommendation values (6) — badge variant per value.
// Consistent 4-tier colour hierarchy (shared by Gap Table recommendations and
// Strategies strategy badges). Orange (warning) is RESERVED for genuine caution —
// so it reads the same as the "Clamped ..." constraint badges — never for a normal move.
//   positive (green)     = price moves up / margin-favourable  → raise
//   info (blue)   = active price action, no alarm        → compete, revert_baseline
//   neutral (grey)       = passive / no real move               → hold, no_recommendation
//   warning (orange)     = caution (price war / constraint)     → hold_at_floor
export const RECOMMENDATION_VARIANTS = {
  raise: 'positive',
  compete: 'info',
  hold: 'neutral',
  hold_at_floor: 'warning',
  revert_baseline: 'info',
  no_recommendation: 'neutral',
}
export const RECOMMENDATIONS = Object.keys(RECOMMENDATION_VARIANTS)

// PricingRule.strategy values (3) — a subset of RECOMMENDATION_VARIANTS' keys/colors.
export const STRATEGIES = ['hold', 'compete', 'raise']

// Money/gap formatter shared by every PriceFighter view — an em dash for missing
// values, two decimals for numbers, the raw value for anything non-numeric.
export function pfFormat(val) {
  if (val === null || val === undefined || val === '') return '—'
  const n = Number(val)
  return Number.isFinite(n) ? n.toFixed(2) : val
}
