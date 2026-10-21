import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AiTaskList from "@/views/Pim/components/enrichment/AiTaskList.vue";

const AiTaskRow = { name: "AiTaskRow", props: ["task", "worker", "selected", "retrying", "usable"], emits: ["select", "retry"], template: "<li />" };
const task = (id, over = {}) => ({ id, type: "pim.meta", status: "done", counts: {}, errors: [], proposal_counts: {}, ...over });
const TASKS = [task(3, { status: "in_progress" }), task(2, { proposal_counts: { applied: 1 } }), task(1)];

const mountList = (props = {}) =>
  mount(AiTaskList, {
    props: { tasks: TASKS, workers: [{ key: "pim.meta", label: "Meta" }], ...props },
    global: { stubs: { AiTaskRow, BasicButton: { template: "<button><slot /></button>" } } },
  });

describe("AiTaskList", () => {
  it("lists what matters; the handled tasks fold into History", async () => {
    const w = mountList();
    expect(w.findAllComponents(AiTaskRow).map((r) => r.props("task").id)).toEqual([3]);
    expect(w.find("[data-testid='ai-tasks-history']").text()).toContain('{"count":2}');
    await w.find("[data-testid='ai-tasks-history']").trigger("click");
    expect(w.findAllComponents(AiTaskRow).map((r) => r.props("task").id)).toEqual([3, 2, 1]);
    expect(w.findAllComponents(AiTaskRow)[0].props("worker")).toEqual({ key: "pim.meta", label: "Meta" });
  });

  it("selecting a task filters to it; selecting it again shows all", async () => {
    const w = mountList({ selected: 3 });
    w.findComponent(AiTaskRow).vm.$emit("select", 3);
    w.findComponent(AiTaskRow).vm.$emit("select", 4);
    expect(w.emitted("select")).toEqual([[null], [4]]);
  });

  it("says when nothing runs or waits", () => {
    const w = mountList({ tasks: [task(1)] });
    expect(w.find("[data-testid='ai-tasks-idle']").exists()).toBe(true);
  });

  it("a row's Try again goes up with its task, from the current list and from History; the row knows its request is out", async () => {
    const failed = task(4, { status: "failed" });
    const handled = task(1, { counts: { failed: 1 }, proposal_counts: { applied: 1 } });
    const w = mountList({ tasks: [failed, task(3, { status: "in_progress", type: "pim.tags" }), handled], retrying: [4], usable: false });
    await w.find("[data-testid='ai-tasks-history']").trigger("click");
    const rows = w.findAllComponents(AiTaskRow);
    expect(rows.map((r) => [r.props("task").id, r.props("retrying"), r.props("usable")])).toEqual([
      [3, false, false],
      [4, true, false],
      [1, false, false],
    ]);

    rows[1].vm.$emit("retry", failed);
    rows[2].vm.$emit("retry", handled);
    expect(w.emitted("retry")).toEqual([[failed], [handled]]);
  });

  it("rows are usable unless told otherwise", () => {
    const w = mountList();
    expect(w.findComponent(AiTaskRow).props("usable")).toBe(true);
    expect(w.findComponent(AiTaskRow).props("retrying")).toBe(false);
  });
});
