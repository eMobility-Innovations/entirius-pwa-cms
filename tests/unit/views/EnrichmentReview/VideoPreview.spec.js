import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockStaged = vi.fn();
vi.mock("@/api/enrichment/api", () => ({ GET_StagedFile: (...a) => mockStaged(...a) }));

import VideoPreview from "@/views/EnrichmentReview/VideoPreview.vue";

describe("VideoPreview", () => {
  beforeEach(() => {
    mockStaged.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:video-1");
    URL.revokeObjectURL = vi.fn();
  });

  it("plays the staged file with controls and offers a download", async () => {
    mockStaged.mockResolvedValue({ data: new Blob(["x"], { type: "video/mp4" }) });
    const w = mount(VideoPreview, { props: { proposalId: 5 } });
    await flushPromises();

    expect(mockStaged).toHaveBeenCalledWith(5);
    const video = w.get("[data-testid='video-preview-player']");
    expect(video.attributes("src")).toBe("blob:video-1");
    expect(video.attributes()).toHaveProperty("controls");
    expect(w.find("[data-testid='video-preview-download']").exists()).toBe(true);

    w.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:video-1");
  });

  it("says so when the staged file cannot be loaded", async () => {
    mockStaged.mockRejectedValue(new Error("404"));
    const w = mount(VideoPreview, { props: { proposalId: 5 } });
    await flushPromises();
    expect(w.find("video").exists()).toBe(false);
    expect(w.text()).toContain("enrichment.video.failed");
  });

  it("drops a late response for an earlier proposal, and one that lands after unmount", async () => {
    const blob = new Blob(["x"], { type: "video/mp4" });
    const pending = [];
    mockStaged.mockImplementation(() => new Promise((r) => pending.push(r)));
    const w = mount(VideoPreview, { props: { proposalId: 5 } });
    await w.setProps({ proposalId: 6 });

    pending[1]({ data: blob });
    await flushPromises();
    pending[0]({ data: blob });
    await flushPromises();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    await w.setProps({ proposalId: 7 });
    w.unmount();
    pending[2]({ data: blob });
    await flushPromises();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
