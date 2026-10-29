import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockStatus = vi.fn();
const mockResume = vi.fn();
const mockNotify = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  GET_WorkersStatus: (...a) => mockStatus(...a),
  POST_ResumeWorker: (...a) => mockResume(...a),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: mockNotify }) }));

import WorkerAlerts from "@/views/EnrichmentReview/WorkerAlerts.vue";

const BasicButton = {
  props: { mutates: Boolean, loading: Boolean },
  emits: ["click"],
  template: "<button :data-mutates=\"String(mutates)\" @click=\"$emit('click')\"><slot /></button>",
};
const row = (over = {}) => ({
  key: "pim.writer", label: "Product texts", mode: "internal", state: "running", paused_reason: "", paused_at: null,
  online_instances: 1, queued_units: 0, oldest_queued_age_s: null, leased_units: 0, failed_units_24h: 0,
  nobody_taking: false, ...over,
});
const PAUSED = row({ state: "paused", paused_reason: "5 work units failed in a row. Check the cause, then resume." });
const STALE = row({ key: "n8n.seo", label: "SEO texts", mode: "external", nobody_taking: true, queued_units: 4, oldest_queued_age_s: 1200 });

const mountAlerts = () => mount(WorkerAlerts, { global: { stubs: { BasicButton } } });

describe("WorkerAlerts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockStatus.mockReset();
    mockResume.mockReset();
    mockNotify.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("shows nothing while every worker is fine", async () => {
    mockStatus.mockResolvedValue({ data: [row()] });
    const w = mountAlerts();
    await flushPromises();
    expect(w.find("[data-testid='worker-alerts']").exists()).toBe(false);
  });

  it("one line per paused worker (with Resume) and per worker nobody takes work from (without)", async () => {
    mockStatus.mockResolvedValue({ data: [row({ key: "ok" }), PAUSED, STALE] });
    const w = mountAlerts();
    await flushPromises();
    expect(w.find("[data-testid='worker-alert-ok']").exists()).toBe(false);
    expect(w.get("[data-testid='worker-alert-pim.writer']").text()).toContain(
      "Product texts is paused: 5 work units failed in a row. Check the cause, then resume."
    );
    expect(w.get("[data-testid='worker-resume-pim.writer']").attributes("data-mutates")).toBe("true");
    expect(w.get("[data-testid='worker-alert-n8n.seo']").text()).toContain("Nobody is taking SEO texts work — 4 waiting for 20 min");
    expect(w.find("[data-testid='worker-resume-n8n.seo']").exists()).toBe(false);
  });

  it("Resume resumes the worker, its line goes away and the operator is told", async () => {
    mockStatus.mockResolvedValueOnce({ data: [PAUSED] }).mockResolvedValue({ data: [row()] });
    mockResume.mockResolvedValue({ data: row() });
    const w = mountAlerts();
    await flushPromises();
    await w.get("[data-testid='worker-resume-pim.writer']").trigger("click");
    await flushPromises();
    expect(mockResume).toHaveBeenCalledWith("pim.writer");
    expect(w.find("[data-testid='worker-alerts']").exists()).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: "positive" }));
  });

  it("a failed Resume keeps the line and says so", async () => {
    mockStatus.mockResolvedValue({ data: [PAUSED] });
    mockResume.mockRejectedValue(new Error("boom"));
    const w = mountAlerts();
    await flushPromises();
    await w.get("[data-testid='worker-resume-pim.writer']").trigger("click");
    await flushPromises();
    expect(w.find("[data-testid='worker-alert-pim.writer']").exists()).toBe(true);
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
  });

  it("re-reads every few seconds; a failed read keeps the last lines", async () => {
    mockStatus.mockResolvedValueOnce({ data: [PAUSED] }).mockRejectedValueOnce(new Error("down")).mockResolvedValue({ data: [row()] });
    const w = mountAlerts();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(15000);
    expect(mockStatus).toHaveBeenCalledTimes(2);
    expect(w.find("[data-testid='worker-alert-pim.writer']").exists()).toBe(true);
    await vi.advanceTimersByTimeAsync(15000);
    expect(mockStatus).toHaveBeenCalledTimes(3);
    expect(w.find("[data-testid='worker-alerts']").exists()).toBe(false);
  });

  it("stops on unmount, and a read on its way when leaving never lands nor re-arms", async () => {
    let answer;
    mockStatus.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    const w = mountAlerts();
    w.unmount();
    answer({ data: [PAUSED] });
    await flushPromises();
    await vi.advanceTimersByTimeAsync(60000);
    expect(mockStatus).toHaveBeenCalledTimes(1);
  });
});
