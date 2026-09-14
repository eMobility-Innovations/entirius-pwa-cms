import { t } from "@/i18n";

export function errorMessage(error) {
  return (
    error?.response?.data?.detail ||
    error?.error?.message ||
    error?.message ||
    t("access.update_failed")
  );
}
