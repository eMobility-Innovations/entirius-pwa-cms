import { describe, it, expect, vi, beforeEach } from "vitest";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/api/communicator/client", () => ({ communicatorApi: { get } }));
vi.mock("@/stores/leadsChannel", () => ({ useLeadsChannelStore: () => ({ activeChannelIdx: "b2b" }) }));

import { GET_ReviewMessage } from "@/api/communicator/api";

describe("GET_ReviewMessage", () => {
  beforeEach(() => get.mockReset());

  it("opens a draft beyond the first review page with one request", async () => {
    get.mockResolvedValueOnce({ data: { id: 150, status: "review_required" } });
    expect(await GET_ReviewMessage("150")).toEqual({ id: 150, status: "review_required" });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/api/communicator/v2/admin/b2b/review/150/");
  });

  it("returns null once the draft left the review queue", async () => {
    get.mockResolvedValueOnce({ data: { id: 9, status: "approved" } });
    expect(await GET_ReviewMessage(9)).toBeNull();
  });

  it("returns null for an id the channel does not have (404 from the real client shape)", async () => {
    const body = { error: "NOT_FOUND", message: "Message not found." };
    Object.defineProperty(body, "httpStatus", { value: 404 });
    get.mockRejectedValueOnce(body);
    expect(await GET_ReviewMessage(9)).toBeNull();
  });

  it("any other failure is not mistaken for an empty queue", async () => {
    get.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(GET_ReviewMessage(9)).rejects.toEqual({ response: { status: 500 } });
  });
});
