import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises } from "@vue/test-utils";

const mockWorkers = vi.fn();
const mockTemplates = vi.fn();
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  GET_Workers: (...a) => mockWorkers(...a),
  GET_Templates: (...a) => mockTemplates(...a),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleEnabled: () => true }) }));
vi.mock("@/stores/configHealth", () => ({ useConfigHealthStore: () => ({ aiUsable: true }) }));
// The enrichment proposals area of the user: "write", "read" or none.
const grant = vi.hoisted(() => ({ level: "write" }));
vi.mock("@/stores/access", () => ({
  useAccessStore: () => ({
    can: (area, level = "read") => area === "enrichment.proposals" && (grant.level === "write" || (grant.level === "read" && level === "read")),
  }),
}));

import { runnableTemplates, useAiWorkers } from "@/views/Pim/components/enrichment/useAiWorkers";

describe("useAiWorkers", () => {
  beforeEach(() => {
    mockWorkers.mockReset();
    mockTemplates.mockReset();
    mockTemplates.mockResolvedValue({ data: [] });
    notify.mockReset();
    grant.level = "write";
  });

  it("without the enrichment area the AI is absent: nothing loads, nothing toasts", async () => {
    grant.level = "";
    const { enabled, writable } = useAiWorkers();
    await flushPromises();
    expect(enabled.value).toBe(false);
    expect(writable.value).toBe(false);
    expect(mockWorkers).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("read-only on the enrichment area: the AI shows but runs nothing", async () => {
    grant.level = "read";
    mockWorkers.mockResolvedValue({ data: [] });
    const { enabled, writable } = useAiWorkers();
    await flushPromises();
    expect(enabled.value).toBe(true);
    expect(writable.value).toBe(false);
  });

  it("loads the PIM workers once the module is on", async () => {
    mockWorkers.mockResolvedValue({ data: [{ key: "pim.translate" }] });
    const { workers } = useAiWorkers();
    await flushPromises();
    expect(mockWorkers).toHaveBeenCalledWith({ target_module: "pim" });
    expect(workers.value).toEqual([{ key: "pim.translate" }]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("a failed load is toasted, not silently shown as no workers", async () => {
    mockWorkers.mockRejectedValue({ response: { status: 403, data: { detail: "Forbidden" } } });
    const { workers } = useAiWorkers();
    await flushPromises();
    expect(workers.value).toEqual([]);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
  });

  it("loads the templates a run can start from, in their order", async () => {
    mockWorkers.mockResolvedValue({ data: [{ key: "pim.writer" }] });
    mockTemplates.mockResolvedValue({
      data: [
        { key: "b", worker_key: "pim.writer", position: 20, active: true },
        { key: "a", worker_key: "pim.writer", position: 10, active: true },
      ],
    });
    const { templates, allTemplates, reloadTemplates } = useAiWorkers();
    await flushPromises();
    // Every template is loaded (task labels); a run starts only from those of a known worker.
    expect(mockTemplates).toHaveBeenCalledWith();
    expect(templates.value.map((t) => t.key)).toEqual(["a", "b"]);
    expect(allTemplates.value.map((t) => t.key)).toEqual(["b", "a"]);
    mockTemplates.mockResolvedValue({ data: [] });
    await reloadTemplates();
    expect(templates.value).toEqual([]);
  });

  it("templates are optional: a failed load leaves none and says nothing", async () => {
    mockWorkers.mockResolvedValue({ data: [{ key: "pim.writer" }] });
    mockTemplates.mockRejectedValue({ response: { status: 404 } });
    const { templates } = useAiWorkers();
    await flushPromises();
    expect(templates.value).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("runnableTemplates", () => {
  it("drops hidden templates and those whose worker is not active", () => {
    const templates = [
      { key: "off", worker_key: "pim.writer", position: 1, active: false },
      { key: "gone", worker_key: "pim.old", position: 2, active: true },
      { key: "on", worker_key: "pim.writer", position: 3, active: true },
    ];
    expect(runnableTemplates(templates, [{ key: "pim.writer" }]).map((t) => t.key)).toEqual(["on"]);
  });
});
