import { ref, watch } from "vue";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { t } from "@/i18n";
import {
  GET_ProposalRevisions,
  PATCH_Proposal,
  POST_PromoteRule,
  POST_RestoreRevision,
  POST_ReviseProposal,
  PUT_ProposalRules,
} from "@/api/enrichment/api";
import { reviseBody, reviseErrorKey } from "./correction";

// The correction work of one proposal (`proposal` a ref), shared by the card and the full-screen editor: AI
// corrections, the 3 variants to pick from, restore, manual versions, rules and their promotion. Every change that
// moves the value hands the new proposal to `onUpdated`; the versions, once shown, follow the value.
export function useProposalCorrection(proposal, onUpdated) {
  const notify = useNotifyStore();
  const busy = ref(false);
  const revisions = ref(null);
  const candidates = ref([]);

  const id = () => proposal.value.id;

  async function act(work, toastKey = "") {
    busy.value = true;
    try {
      await work();
      if (toastKey) notify.spawnNotification({ type: "positive", msg: t(toastKey) });
      return true;
    } catch (err) {
      const key = reviseErrorKey(err);
      notify.spawnNotification({ type: "negative", msg: key ? t(key) : extractApiMessage(err, t("notifications.error")) });
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function loadRevisions() {
    const { data } = await GET_ProposalRevisions(id());
    revisions.value = data;
  }

  const loadVersions = () => act(loadRevisions);

  // A new value (an AI correction, an edit, a restore, from here or the card's Edit) is a new version.
  watch(
    () => proposal.value.proposed_value,
    () => revisions.value && loadVersions(),
    { deep: true }
  );

  // A new version: its value, and its QA warnings, recomputed per revision (contract A4 § 4).
  const landed = (revision) =>
    onUpdated({ ...proposal.value, proposed_value: revision.value, warnings: revision.warnings ?? proposal.value.warnings });

  const revise = (request) =>
    act(async () => {
      const { data } = await POST_ReviseProposal(id(), reviseBody(request));
      if (data.candidates) candidates.value = data.candidates;
      else landed(data);
    });

  const saveValue = (value, toastKey = "enrichment.review.toast.edited") =>
    act(async () => {
      const { data } = await PATCH_Proposal(id(), { proposed_value: value });
      candidates.value = [];
      onUpdated(data);
    }, toastKey);

  const restore = (number) =>
    act(async () => {
      const { data } = await POST_RestoreRevision(id(), number);
      landed(data);
    }, "enrichment.versions.restored_toast");

  const setRules = (rules) =>
    act(async () => {
      const { data } = await PUT_ProposalRules(id(), rules);
      onUpdated(data);
    });

  const promote = ({ rule, target }) =>
    act(() => POST_PromoteRule(id(), { rule, target }), `enrichment.rules.kept_${target}`);

  return { busy, revisions, candidates, loadVersions, revise, saveValue, restore, setRules, promote };
}
