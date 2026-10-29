import { ref } from "vue";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { t } from "@/i18n";
import { POST_RejectProposal } from "@/api/enrichment/api";
import { acceptChosen } from "./applyMode";

// Apply and Reject of proposal cards reviewed in place (a product's AI drawer, a finished run on Runs): one action at a
// time (`busy`); an apply the live value moved under waits in `drifted` for the DriftModal's conscious re-confirm.
// `onApplied` / `onRejected` get the proposal (the caller drops its card); `afterAction` runs after any action that
// went through (re-read the counts). `act` wraps the caller's own actions (Apply all) the same way.
export function useProposalActions({ onApplied, onRejected, afterAction = () => {} }) {
  const notify = useNotifyStore();
  const busy = ref(false);
  const drifted = ref(null);
  const toast = (key) => notify.spawnNotification({ type: "positive", msg: t(key) });

  async function act(work) {
    busy.value = true;
    try {
      await work();
      afterAction();
    } catch (err) {
      notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, t("notifications.error")) });
    } finally {
      busy.value = false;
    }
  }

  function applied(proposal) {
    onApplied(proposal);
    toast("enrichment.review.toast.accepted");
  }

  const accept = (proposal) =>
    act(async () => {
      const { data } = await acceptChosen(proposal);
      if (data.status === "drifted") drifted.value = data;
      else applied(data);
    });

  // The second apply of a drifted proposal writes through.
  const confirmDrift = (proposal) =>
    act(async () => {
      const { data } = await acceptChosen(proposal);
      drifted.value = null;
      applied(data);
    });

  const reject = ({ proposal, reason }) =>
    act(async () => {
      await POST_RejectProposal(proposal.id, reason ? { reason } : {});
      onRejected(proposal);
      toast("enrichment.review.toast.rejected");
    });

  function rejectDrift(payload) {
    drifted.value = null;
    return reject(payload);
  }

  return { busy, drifted, act, accept, confirmDrift, reject, rejectDrift };
}
