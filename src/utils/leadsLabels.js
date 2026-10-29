import { t } from "@/i18n";

// No raw enum value or backend status reaches the screen: each one has an i18n label, the raw value is the fallback.
const label = (key, fallback) => (t(key) === key ? fallback : t(key));

export const legalBasisLabel = (value) => label(`leads.legal_basis.${value}`, value);

export const stageKindLabel = (value) => label(`leads.stage_kind.${value}`, value);

export const statusLabel = (value) => label(`leads.status.${value}`, value);

export const templateKindLabel = (value) => label(`communicator.template.kinds.${value}`, value);

export const suppressionKindLabel = (value) => label(`communicator.suppressions.kinds.${value}`, value);

// One wording for a waiting mail's departure: Review, the Inbox summary, the waiting table and the thread say the same.
export const sendStateLabel = ({ state, time, window }) =>
  t(`leads.send_state.${window ? "held_window" : state}`, { time, window });

// The same state as one sentence with the slot a held mail waits for — the confirmation after Send and the Inbox.
export const sendStateSentence = (sendState) =>
  sendState.next ? t("leads.send_state.with_next", { state: sendStateLabel(sendState), time: sendState.next }) : sendStateLabel(sendState);

// A raw service word ("no_eligible_contact", "None") read as words: a label when there is one, else spaced out.
const humanize = (value) => String(value).replace(/_/g, " ");
const blockReasonLabel = (value) => label(`leads.block_reason.${value}`, humanize(value));
const basisLabel = (value) => humanize(legalBasisLabel(value)).toLowerCase();
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Activity messages are written by the service ("stage new -> replied"): each known shape becomes a sentence built
// from labels; anything else keeps its words without snake_case or ASCII arrows. The raw value stays in the API.
const ACTIVITY_SHAPES = [
  [/^draft (\w+)$/, ([status]) => t("leads.activity.draft", { status: statusLabel(status) })],
  [/^stage (\S+) -> (\S+)$/, ([from, to]) => t("leads.activity.stage", { from: humanize(from), to: humanize(to) })],
  [/^legal basis (None|) -> (\S+)$/, ([, to]) => t("leads.activity.legal_basis_set", { to: basisLabel(to) })],
  [/^legal basis (\S+) -> (\S+)$/, ([from, to]) => t("leads.activity.legal_basis_changed", { from: basisLabel(from), to: basisLabel(to) })],
  [/^blocked: (\w+)$/, ([reason]) => t("leads.activity.blocked", { reason: blockReasonLabel(reason) })],
];

export function activityText(message) {
  if (!message) return "";
  for (const [shape, sentence] of ACTIVITY_SHAPES) {
    const match = shape.exec(message);
    if (match) return sentence(match.slice(1));
  }
  return capitalize(humanize(message).replace(/ -> /g, " → "));
}
