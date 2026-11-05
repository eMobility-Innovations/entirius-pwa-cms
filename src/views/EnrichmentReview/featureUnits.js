// The unit each DECIMAL feature is asked in. PIM stores none and the proposal carries none, so without this the
// review shows a bare number. Mirrors `ATTRIBUTE_UNITS` in esc-service-volkanos: a feature missing here shows no unit.
const FEATURE_UNITS = {
  amperage: "A",
  battery_capacity: "Ah",
  cable_length_m: "m",
  charge_time: "h",
  engine_cc: "cc",
  fuel_capacity: "litres",
  height_mm: "mm",
  load_capacity: "kg",
  maximum_climbing_angle: "degrees",
  maximum_load: "kg",
  maximum_range: "km",
  motor_power_rating: "W",
  top_speed: "km/h",
  tyre_height: "mm",
  weight: "kg",
};

export const featureUnit = (featureIdx) => FEATURE_UNITS[featureIdx] ?? null;
