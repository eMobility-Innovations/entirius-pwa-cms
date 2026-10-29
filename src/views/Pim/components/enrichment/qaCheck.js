import { GET_ProfileSettings } from "@/api/enrichment/api";

// A run's guidelines check (`params.qa_check`): true / false = this run decides, null = the Settings default applies
// (the key is left out). The default is read once per page session; unknown (no access, a failure) reads as off.
let defaultCheck = null;

/** The task params of a run's choice: `{ qa_check }` when it made one, else `{}`. */
export const qaCheckParams = (value) => (typeof value === "boolean" ? { qa_check: value } : {});

/** The Settings default of the automatic check (false when it cannot be read). */
export function loadQaCheckDefault() {
  defaultCheck ??= GET_ProfileSettings()
    .then(({ data }) => !!data.qa_check)
    .catch(() => {
      defaultCheck = null;
      return false;
    });
  return defaultCheck;
}

/** Test seam: forget the loaded default. */
export const clearQaCheckDefault = () => {
  defaultCheck = null;
};
