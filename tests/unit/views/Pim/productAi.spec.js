import { describe, it, expect } from "vitest";
import { finishedTasks, groupTasks, isActive, taskLabel, taskLanguages, taskOutcome } from "@/views/Pim/components/enrichment/productAi";

const task = (over = {}) => ({ id: 1, type: "pim.meta", status: "done", counts: {}, errors: [], proposal_counts: {}, ...over });

describe("productAi", () => {
  it("open and in_progress tasks are active, finished ones are not", () => {
    expect(["open", "in_progress", "done", "failed"].map((status) => isActive({ status }))).toEqual([true, true, false, false]);
  });

  it("finishedTasks names the tasks that stopped running between two reads", () => {
    const before = [{ id: 1, status: "in_progress" }, { id: 2, status: "open" }, { id: 3, status: "done" }];
    const after = [{ id: 1, status: "done" }, { id: 2, status: "in_progress" }, { id: 3, status: "done" }, { id: 4, status: "failed" }];
    expect(finishedTasks(before, after).map((t) => t.id)).toEqual([1]);
  });

  it("taskLanguages reads languages or the targets of a translation", () => {
    expect(taskLanguages(task({ params: { languages: ["pl"] } }))).toEqual(["pl"]);
    expect(taskLanguages(task({ params: { source_language: "en", target_languages: ["pl", "de"] } }))).toEqual(["pl", "de"]);
    expect(taskLanguages(task())).toEqual([]);
  });
});

describe("taskOutcome", () => {
  it("names what came of a task", () => {
    expect(taskOutcome(task({ status: "in_progress" }))).toEqual({ state: "running" });
    expect(taskOutcome(task({ proposal_counts: { pending: 2, applied: 1 } }))).toEqual({ state: "review", count: 2 });
    expect(taskOutcome(task({ proposal_counts: { applied: 1, rejected: 1 } }))).toEqual({ state: "applied", count: 1 });
    expect(taskOutcome(task({ proposal_counts: { rejected: 1 } })).state).toBe("rejected");
    expect(taskOutcome(task({ proposal_counts: { superseded: 1 } })).state).toBe("replaced");
    expect(taskOutcome(task()).state).toBe("nothing");
    expect(taskOutcome(task({ status: "cancelled" })).state).toBe("cancelled");
  });

  it("a failure carries its first reason; a partial one keeps the result too", () => {
    const errors = [{ subject_ref: "A", code: "PROVIDER_NOT_CONFIGURED", error_id: "abc" }];
    expect(taskOutcome(task({ status: "failed", errors }))).toEqual({ state: "failed", code: "PROVIDER_NOT_CONFIGURED", errorId: "abc" });
    expect(taskOutcome(task({ status: "failed" })).code).toBe("NOT_RECORDED");
    const partial = taskOutcome(task({ counts: { failed: 1 }, errors, proposal_counts: { pending: 1 } }));
    expect(partial).toMatchObject({ state: "review", count: 1, failed: 1, code: "PROVIDER_NOT_CONFIGURED" });
  });
});

describe("groupTasks", () => {
  it("running, to review and the latest failure of a worker stay on top; the handled rest is history", () => {
    const tasks = [
      task({ id: 6, status: "done", proposal_counts: { applied: 1 } }),
      task({ id: 5, type: "pim.translate", status: "failed" }),
      task({ id: 4, status: "done", proposal_counts: { pending: 1 } }),
      task({ id: 3, status: "in_progress" }),
      task({ id: 2, type: "pim.translate", status: "failed" }),
    ];
    const { current, history } = groupTasks(tasks);
    expect(current.map((t) => t.id)).toEqual([3, 4, 5]);
    expect(history.map((t) => t.id)).toEqual([6, 2]);
  });
});

describe("taskLabel", () => {
  const workers = [{ key: "pim.writer", label: "Writer" }];
  const templates = [{ key: "meta", label: "Meta descriptions" }];

  it("the template it ran from, else its worker, else its type", () => {
    expect(taskLabel({ type: "pim.writer", params: { template: "meta" } }, workers, templates)).toBe("Meta descriptions");
    expect(taskLabel({ type: "pim.writer", params: {} }, workers, templates)).toBe("Writer");
    expect(taskLabel({ type: "pim.other" }, workers, templates)).toBe("pim.other");
    expect(taskLabel(undefined)).toBe("");
  });
});
