// Client-side checks of a new-password form (password reset, change password): every field is filled and the
// confirmation matches. `fields` maps a field name to its value; `confirmPassword` is compared with `newPassword`.
// Returns the per-field `errors` (FormField `error`) and the one-line `summary` for the live region ("" = valid).
export function passwordErrors(t, fields) {
  const empty = Object.keys(fields).filter((name) => !fields[name]);
  if (empty.length) {
    const errors = Object.fromEntries(empty.map((name) => [name, t("common.required")]));
    return { errors, summary: t("user.fill_all_fields") };
  }
  if (fields.newPassword !== fields.confirmPassword) {
    return { errors: { confirmPassword: t("user.passwords_dont_match") }, summary: t("user.passwords_dont_match") };
  }
  return { errors: {}, summary: "" };
}
