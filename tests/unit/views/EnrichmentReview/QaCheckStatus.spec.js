import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_Proposal: vi.fn(), POST_ReviseProposal: vi.fn() }));
const spawnNotification = vi.hoisted(() => vi.fn());
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification }) }));

import QaCheckStatus from "@/views/EnrichmentReview/QaCheckStatus.vue";

const RULE = { code: "rule", message: "Say 'affordable'.", span: null };
const CHECKLIST = { code: "checklist", message: "No benefit.", span: null };
const proposal = (extra = {}) => ({ id: 7, status: "pending", proposed_value: { text: "A chair." }, warnings: [], ...extra });
const $t = (key, params) => (params ? `${key}:${params.count}` : key);
const stubs = {
  BasicTooltip: { props: ["text"], template: "<span :title='text'><slot /></span>" },
  BasicButton: { props: ["disabled"], template: "<button :disabled='disabled'><slot /></button>" },
};
const mountWith = (p) => mount(QaCheckStatus, { props: { proposal: p }, global: { stubs, mocks: { $t } } });

describe("QaCheckStatus", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    spawnNotification.mockReset();
  });

  it("not checked: an active check button, no state", () => {
    const w = mountWith(proposal());
    expect(w.find("[data-testid='qa-check-standard']").text()).toBe("enrichment.qa.check");
    expect(w.find("[data-testid='qa-check-standard']").attributes("disabled")).toBeUndefined();
    expect(w.find("[title='enrichment.qa.check_hint']").exists()).toBe(true); // the cost note on hover / focus
    expect(w.find("[data-testid='qa-check-state']").exists()).toBe(false);
    expect(w.find("[data-testid='qa-fix-warnings']").exists()).toBe(false);
  });

  it("checked and clean: the plain ✓ state, no button", () => {
    const w = mountWith(proposal({ standard_checked_at: "2026-10-15T10:00:00Z" }));
    expect(w.find("[data-testid='qa-check-state']").text()).toBe("enrichment.qa.checked_ok");
    expect(w.find("[data-testid='qa-check-standard']").exists()).toBe(false);
  });

  it("checked with warnings: the count in the right plural form and Fix warnings", () => {
    const two = mountWith(proposal({ standard_checked_at: "2026-10-15T10:00:00Z", warnings: [RULE, CHECKLIST] }));
    expect(two.find("[data-testid='qa-check-state']").text()).toBe("enrichment.qa.checked_few:2");
    expect(two.find("[data-testid='qa-fix-warnings']").exists()).toBe(true);
    const one = mountWith(proposal({ standard_checked_at: "2026-10-15T10:00:00Z", warnings: [RULE] }));
    expect(one.find("[data-testid='qa-check-state']").text()).toBe("enrichment.qa.checked_one:1");
  });

  it("deterministic warnings before any check: the check button and Fix warnings", () => {
    const w = mountWith(proposal({ warnings: [RULE] }));
    expect(w.find("[data-testid='qa-check-standard']").exists()).toBe(true);
    expect(w.find("[data-testid='qa-fix-warnings']").exists()).toBe(true);
  });

  it("the check stores the answer's warnings and check time on the card, no new version", async () => {
    api.POST_ReviseProposal.mockResolvedValue({ data: { warnings: [CHECKLIST], standard_checked_at: "2026-10-15T11:00:00Z" } });
    const w = mountWith(proposal());
    await w.vm.checkStandard();
    expect(api.POST_ReviseProposal).toHaveBeenCalledWith(7, { quick_action: "check_standard" });
    expect(w.emitted("updated")[0][0]).toMatchObject({ warnings: [CHECKLIST], standard_checked_at: "2026-10-15T11:00:00Z" });
    expect(api.GET_Proposal).not.toHaveBeenCalled();
    expect(w.emitted("busy").map(([b]) => b)).toEqual([true, false]);
  });

  it("Fix warnings makes a corrected version and hands up the reloaded proposal", async () => {
    api.POST_ReviseProposal.mockResolvedValue({ data: { number: 2 } });
    api.GET_Proposal.mockResolvedValue({ data: proposal({ proposed_value: { text: "Fixed" } }) });
    const w = mountWith(proposal({ warnings: [RULE] }));
    await w.vm.fixWarnings();
    expect(api.POST_ReviseProposal).toHaveBeenCalledWith(7, { quick_action: "fix_warnings" });
    expect(w.emitted("updated")[0][0].proposed_value).toEqual({ text: "Fixed" });
    expect(spawnNotification).toHaveBeenCalledWith({ type: "positive", msg: "enrichment.qa.fixed_toast" });
  });

  it("a failed check says why and keeps the card", async () => {
    api.POST_ReviseProposal.mockRejectedValue(new Error("down"));
    const w = mountWith(proposal());
    await w.vm.checkStandard();
    expect(w.emitted("updated")).toBeUndefined();
    expect(spawnNotification.mock.calls[0][0].type).toBe("negative");
  });

  it("nothing for an applied proposal or a select value", () => {
    expect(mountWith(proposal({ status: "applied" })).find("[data-testid='qa-check']").exists()).toBe(false);
    expect(mountWith(proposal({ proposed_value: { option: "red" } })).find("[data-testid='qa-check']").exists()).toBe(false);
  });
});
