import { ref } from "vue";
import { t } from "@/i18n";
import { useNotifyStore } from "@/stores/notify";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import { refusedExpiryIssue } from "./tokens";

// The submit of a token dialog: `submit(payload)` is the page's call (it hands a raw token straight to SecretReveal —
// the dialog never sees it). Success closes the dialog. A refusal that names a field (an expiry issue code, a name)
// stays open with the field error (`fields`: the ones the dialog shows); any other failure closes it with the server's
// message.
export function useTokenDialog(close, fields) {
  const formErrors = useFormErrors();
  const notify = useNotifyStore();
  const busy = ref(false);

  const expiryError = () => formErrors.getFieldError("expires_at")?.msg || "";

  function setExpiryIssue(issue) {
    formErrors.errors.expires_at = { status: "error", msg: t(`access.tokens.expiry_errors.${issue}`) };
  }

  function showRefusal(err) {
    formErrors.handleApiError(err);
    const issue = refusedExpiryIssue(err);
    if (issue) setExpiryIssue(issue);
    if (fields.some((field) => formErrors.getFieldError(field))) return;
    notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, t("notifications.error")) });
    close();
  }

  async function run(submit, payload) {
    busy.value = true;
    try {
      await submit(payload);
      close();
    } catch (err) {
      showRefusal(err);
    } finally {
      busy.value = false;
    }
  }

  return { formErrors, busy, expiryError, setExpiryIssue, run };
}
