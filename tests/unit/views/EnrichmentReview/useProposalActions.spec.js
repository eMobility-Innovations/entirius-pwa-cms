import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAccept = vi.fn();
const mockReject = vi.fn();
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  POST_AcceptProposal: (...a) => mockAccept(...a),
  POST_RejectProposal: (...a) => mockReject(...a),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));

import { useProposalActions } from "@/views/EnrichmentReview/useProposalActions";

const proposal = (id, status = "pending") => ({ id, status });

function setup() {
  const callbacks = { onApplied: vi.fn(), onRejected: vi.fn(), afterAction: vi.fn() };
  return { callbacks, actions: useProposalActions(callbacks) };
}

describe("useProposalActions", () => {
  beforeEach(() => {
    mockAccept.mockReset();
    mockReject.mockReset();
    notify.mockReset();
  });

  it("Apply hands the applied proposal back, says so and re-reads", async () => {
    mockAccept.mockResolvedValue({ data: proposal(1, "applied") });
    const { callbacks, actions } = setup();
    await actions.accept(proposal(1));

    expect(callbacks.onApplied).toHaveBeenCalledWith(proposal(1, "applied"));
    expect(notify).toHaveBeenCalledWith({ type: "positive", msg: "Proposal accepted." });
    expect(callbacks.afterAction).toHaveBeenCalled();
    expect(actions.busy.value).toBe(false);
  });

  it("an apply the live value moved under waits as drifted; the re-confirm writes through", async () => {
    mockAccept.mockResolvedValueOnce({ data: proposal(1, "drifted") }).mockResolvedValueOnce({ data: proposal(1, "applied") });
    const { callbacks, actions } = setup();
    await actions.accept(proposal(1));
    expect(actions.drifted.value).toEqual(proposal(1, "drifted"));
    expect(callbacks.onApplied).not.toHaveBeenCalled();

    await actions.confirmDrift(proposal(1, "drifted"));
    expect(actions.drifted.value).toBeNull();
    expect(callbacks.onApplied).toHaveBeenCalledWith(proposal(1, "applied"));
  });

  it("Reject sends the reason and hands the proposal back; reject from the drift dialog closes it", async () => {
    mockReject.mockResolvedValue({});
    const { callbacks, actions } = setup();
    await actions.reject({ proposal: proposal(2), reason: "off" });
    expect(mockReject).toHaveBeenCalledWith(2, { reason: "off" });
    expect(callbacks.onRejected).toHaveBeenCalledWith(proposal(2));

    actions.drifted.value = proposal(3, "drifted");
    await actions.rejectDrift({ proposal: proposal(3), reason: "" });
    expect(actions.drifted.value).toBeNull();
    expect(mockReject).toHaveBeenLastCalledWith(3, {});
  });

  it("a failed action is toasted, keeps the proposal and re-reads nothing", async () => {
    mockAccept.mockRejectedValue({ message: "Gone" });
    const { callbacks, actions } = setup();
    await actions.accept(proposal(1));

    expect(notify).toHaveBeenCalledWith({ type: "negative", msg: "Gone" });
    expect(callbacks.onApplied).not.toHaveBeenCalled();
    expect(callbacks.afterAction).not.toHaveBeenCalled();
    expect(actions.busy.value).toBe(false);
  });
});
