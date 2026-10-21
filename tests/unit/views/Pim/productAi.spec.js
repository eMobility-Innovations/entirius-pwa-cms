import { describe, it, expect } from "vitest";
import {
  finishedTasks, groupTasks, isActive, isRetryable, outcomeText, taskLabel, taskLanguages, taskOutcome,
} from "@/views/Pim/components/enrichment/productAi";

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

describe("isRetryable", () => {
  it("a failed task, or a done one with failed products, can be tried again", () => {
    expect(isRetryable(task({ status: "failed" }))).toBe(true);
    expect(isRetryable(task({ status: "failed", errors: [] }))).toBe(true);
    expect(isRetryable(task({ counts: { failed: 2, proposed: 1 }, proposal_counts: { pending: 1 } }))).toBe(true);
  });

  it("a task that runs, waits, was cancelled or has nothing failed cannot", () => {
    expect(isRetryable(task({ status: "in_progress" }))).toBe(false);
    expect(isRetryable(task({ status: "open", queued_ahead: 1 }))).toBe(false);
    expect(isRetryable(task({ status: "open", counts: { failed: 1 } }))).toBe(false);
    expect(isRetryable(task({ status: "cancelled", counts: { failed: 1 } }))).toBe(false);
    expect(isRetryable(task({ counts: { proposed: 3, failed: 0 }, proposal_counts: { pending: 3 } }))).toBe(false);
    expect(isRetryable(task())).toBe(false);
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

  it("an open task waiting in the queue is queued with the runs ahead of it; an external worker's open task runs", () => {
    expect(taskOutcome(task({ status: "open", queued_ahead: 2 }))).toEqual({ state: "queued", count: 2 });
    expect(taskOutcome(task({ status: "open", queued_ahead: 0 }))).toEqual({ state: "queued", count: 0 });
    expect(taskOutcome(task({ status: "open", queued_ahead: null }))).toEqual({ state: "running" });
    expect(taskOutcome(task({ status: "in_progress", queued_ahead: null }))).toEqual({ state: "running" });
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
      task({ id: 7, status: "open", queued_ahead: 1 }),
    ];
    const { current, history } = groupTasks(tasks);
    expect(current.map((t) => t.id)).toEqual([3, 7, 4, 5]);
    expect(history.map((t) => t.id)).toEqual([6, 2]);
  });
});

describe("taskLabel", () => {
  const workers = [{ key: "pim.writer", label: "Writer" }];
  const templates = [{ key: "meta", label: "Meta descriptions" }];

  it("the template it ran from, else its worker, else nothing (never the worker key)", () => {
    expect(taskLabel({ type: "pim.writer", params: { template: "meta" } }, workers, templates)).toBe("Meta descriptions");
    expect(taskLabel({ type: "pim.writer", params: {} }, workers, templates)).toBe("Writer");
    expect(taskLabel({ type: "pim.other" }, workers, templates)).toBe("");
    expect(taskLabel(undefined)).toBe("");
  });
});

describe("outcomeText", () => {
  const translator = { key: "pim.translate", kind: "translate" };
  const failure = (code) => [{ code, error_id: "e1" }];

  it("what a run came to, in plain words", () => {
    expect(outcomeText(task({ status: "open", queued_ahead: 0 }))).toBe("Queued — starts next");
    expect(outcomeText(task({ status: "open", queued_ahead: 1 }))).toBe("Queued — 1 run ahead");
    expect(outcomeText(task({ status: "in_progress" }))).toBe("Working on it…");
    expect(outcomeText(task({ proposal_counts: { pending: 2 } }))).toBe("2 proposals to review");
    expect(outcomeText(task({ proposal_counts: { applied: 3 } }))).toBe("Applied");
    expect(outcomeText(task())).toBe("Nothing to do — no proposals");
  });

  it("names a failure by its kind, then the generic reason, never the code", () => {
    const failed = (code) => task({ status: "failed", errors: failure(code) });
    expect(outcomeText(failed("PROVIDER_NOT_CONFIGURED"), translator)).toBe("Failed: Translator not configured on the AI toolbox");
    expect(outcomeText(failed("PROVIDER_NOT_CONFIGURED"))).toBe("Failed: AI provider not configured on the AI toolbox");
    expect(outcomeText(failed("WEIRD"))).toBe("Failed: The AI service reported an error");
  });

  it("a done run with failed products says so after what it proposed", () => {
    const partly = task({ proposal_counts: { pending: 1 }, counts: { failed: 2 }, errors: failure("UPSTREAM_TIMEOUT") });
    expect(outcomeText(partly)).toBe("1 proposal to review · 2 failed: The AI provider did not answer in time");
  });
});
