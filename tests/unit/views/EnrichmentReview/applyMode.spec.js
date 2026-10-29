import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAccept = vi.fn(() => Promise.resolve({ data: {} }));
vi.mock("@/api/enrichment/api", () => ({ POST_AcceptProposal: (...a) => mockAccept(...a) }));

import { acceptChosen, canReplace, chooseMode, modeOf } from "@/views/EnrichmentReview/applyMode";

const picture = (id) => ({ id, apply_modes: ["add", "replace"] });

describe("applyMode", () => {
  beforeEach(() => mockAccept.mockClear());

  it("only a proposal that offers replace has a choice; nothing picked = add", () => {
    expect(canReplace(picture(1))).toBe(true);
    expect(canReplace({ id: 2, apply_modes: [] })).toBe(false);
    expect(canReplace({ id: 3 })).toBe(false);
    expect(modeOf(picture(1))).toBe("add");
  });

  it("the pick is kept per proposal and sent with its accept", async () => {
    chooseMode(picture(10), "replace");
    await acceptChosen(picture(10));
    await acceptChosen(picture(11));
    expect(mockAccept.mock.calls).toEqual([[10, { mode: "replace" }], [11, { mode: "add" }]]);
  });

  it("a proposal without a choice is accepted as before (no body)", async () => {
    chooseMode({ id: 20 }, "replace");
    await acceptChosen({ id: 20, apply_modes: [] });
    expect(mockAccept.mock.calls).toEqual([[20]]);
  });
});
