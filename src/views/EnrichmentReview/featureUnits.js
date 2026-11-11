import enrichmentConfig from "@/../__client/configs/__enrichment_config";

// The unit each DECIMAL feature is asked in. PIM stores none and the proposal carries none, so the review reads it
// from the client config map `enrichment.featureUnits` (`{ "<feature idx>": "<unit>" }`); a feature missing there
// shows no unit.
export const featureUnit = (featureIdx) => enrichmentConfig.enrichment?.featureUnits?.[featureIdx] ?? null;
