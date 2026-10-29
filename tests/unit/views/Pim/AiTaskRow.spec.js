import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import AiTaskRow from "@/views/Pim/components/enrichment/AiTaskRow.vue";
import BasicButton from "@/boots/BasicButton/index.vue";
import { READONLY } from "@/composables/useReadonly";

// The outcome line is productAi.outcomeText, in the real English texts; the rest of the row goes through the $t stub.
const $t = (key, params) => (params ? `${key}::${JSON.stringify(params)}` : key);

const task = (over = {}) => ({
  id: 9, type: "pim.translate", status: "done", created_at: new Date().toISOString(),
  params: { target_languages: ["pl", "en"] }, counts: {}, errors: [], proposal_counts: {}, ...over,
});
const mountRow = (over, worker = { key: "pim.translate", label: "Translate", kind: "translate" }) =>
  mount(AiTaskRow, {
    props: { task: task(over), worker },
    global: { mocks: { $t }, stubs: { Tag: { props: ["label"], template: "<i>{{ label }}</i>" }, RouterLink: { props: ["to"], template: "<a><slot /></a>" } } },
  });
const outcome = (w) => w.find("[data-testid='ai-task-outcome']").text();

describe("AiTaskRow", () => {
  it("names a run by its template and shows what a finished run cost", () => {
    const w = mount(AiTaskRow, {
      props: { task: task({ cost_usd: "0.0800", cost_complete: true }), worker: null, label: "Meta descriptions" },
      global: { mocks: { $t }, stubs: { Tag: true, RouterLink: true, BasicTooltip: { template: "<span><slot /></span>" } } },
    });
    expect(w.find(".ai-task__label").text()).toBe("Meta descriptions");
    expect(w.find("[data-testid='ai-task-cost']").text()).toBe("$0.08");
  });

  it("a writer's All languages is named, not shown as *", () => {
    const w = mountRow({ params: { languages: ["*"] } });
    expect(w.findAll("i").map((n) => n.text())).toEqual(["enrichment.run.all_languages"]);
  });

  it("a running task shows no cost yet", () => {
    const w = mountRow({ status: "in_progress" });
    expect(w.find("[data-testid='ai-task-cost']").exists()).toBe(false);
  });

  it("a queued task says how many runs wait before it, or that it starts next; no cost yet", () => {
    const waiting = mountRow({ status: "open", queued_ahead: 2 });
    expect(outcome(waiting)).toBe("Queued — 2 runs ahead");
    expect(waiting.find(".ai-task__icon--info").exists()).toBe(true);
    expect(waiting.find("[data-testid='ai-task-cost']").exists()).toBe(false);
    expect(outcome(mountRow({ status: "open", queued_ahead: 0 }))).toBe("Queued — starts next");
  });

  it("shows the worker label, its languages as chips and a relative time", () => {
    const w = mountRow();
    expect(w.text()).toContain("Translate");
    expect(w.findAll("i").map((n) => n.text())).toEqual(["PL", "EN"]);
    expect(w.find(".ai-task__time").text()).not.toBe("");
  });

  it("says how many proposals wait for review, with the plural form, and marks it with an accent count pill", () => {
    const w = mountRow({ proposal_counts: { pending: 3 } });
    expect(outcome(w)).toBe("3 proposals to review");
    expect(w.find("[data-testid='ai-task-review']").text()).toBe("3");
    expect(w.find(".ai-task__icon").exists()).toBe(false);
  });

  it("a neutral outcome keeps the muted info icon; no review pill", () => {
    const w = mountRow({ proposal_counts: { rejected: 1 } });
    expect(w.find(".ai-task__icon--neutral").exists()).toBe(true);
    expect(w.find("[data-testid='ai-task-review']").exists()).toBe(false);
  });

  it("names a failure by the kind-specific reason, then the generic one, then a code-free sentence", () => {
    const errors = (code) => [{ subject_ref: "A", code, error_id: "e1" }];
    expect(outcome(mountRow({ status: "failed", errors: errors("PROVIDER_NOT_CONFIGURED") }))).toBe(
      "Failed: Translator not configured on the AI toolbox"
    );
    expect(outcome(mountRow({ status: "failed", errors: errors("UPSTREAM_TIMEOUT") }))).toBe("Failed: The AI provider did not answer in time");
    const unknown = mountRow({ status: "failed", errors: errors("WEIRD") });
    expect(outcome(unknown)).toBe("Failed: The AI service reported an error");
    // The code stays at hand for support, in the tooltip only.
    expect(unknown.find("[data-testid='ai-task-outcome']").attributes("title")).toBe("WEIRD");
  });

  it("a task of no known template or worker is a generic AI task, never its worker key", () => {
    const w = mountRow({ type: "article.outline" }, null);
    expect(w.find(".ai-task__label").text()).toBe("enrichment.ai.task_generic");
  });

  it("clicking the row selects the task (its proposals show below it); no link away to another page", async () => {
    const w = mountRow();
    await w.find(".ai-task__select").trigger("click");
    expect(w.emitted("select")[0]).toEqual([9]);
    expect(w.find("a").exists()).toBe(false);
  });

  describe("Try again", () => {
    const Button = {
      props: { disabled: Boolean, loading: Boolean, mutates: Boolean },
      emits: ["click"],
      template: "<button :disabled='disabled || loading' :data-loading='String(loading)' :data-mutates='String(mutates)' @click=\"$emit('click')\"><slot /></button>",
    };
    const mountRetry = (over, props = {}) =>
      mount(AiTaskRow, {
        props: { task: task(over), worker: null, ...props },
        global: { mocks: { $t }, stubs: { Tag: true, RouterLink: true, BasicButton: Button } },
      });
    const retryButton = (w) => w.find("[data-testid='ai-task-retry-9']");

    it("a failed task has it, and a done task whose products partly failed", () => {
      expect(retryButton(mountRetry({ status: "failed", errors: [{ code: "UPSTREAM_TIMEOUT" }] })).text()).toBe("enrichment.ai.try_again");
      expect(retryButton(mountRetry({ counts: { failed: 2 }, proposal_counts: { pending: 1 } })).exists()).toBe(true);
    });

    it("a task that runs, waits, was cancelled or came to nothing failed has none", () => {
      for (const over of [
        { status: "in_progress" },
        { status: "open", queued_ahead: 0 },
        { status: "cancelled" },
        { proposal_counts: { applied: 1 } },
        { proposal_counts: { pending: 2 } },
        {},
      ]) {
        expect(retryButton(mountRetry(over)).exists()).toBe(false);
      }
    });

    it("sits outside the select area (no button inside a button), is a write action and asks to retry this task", async () => {
      const w = mountRetry({ status: "failed" });
      expect(w.find(".ai-task__select").find("button").exists()).toBe(false);
      expect(retryButton(w).attributes("data-mutates")).toBe("true");
      await retryButton(w).trigger("click");
      expect(w.emitted("retry")).toEqual([[expect.objectContaining({ id: 9, status: "failed" })]]);
      expect(w.emitted("select")).toBeUndefined();
    });

    it("shows loading and takes no click while its request is out", async () => {
      const w = mountRetry({ status: "failed" }, { retrying: true });
      expect(retryButton(w).attributes("data-loading")).toBe("true");
      expect(retryButton(w).attributes("disabled")).toBeDefined();
      await retryButton(w).trigger("click");
      expect(w.emitted("retry")).toBeUndefined();
    });

    it("is disabled while the AI toolbox cannot take a run", () => {
      expect(retryButton(mountRetry({ status: "failed" }, { usable: false })).attributes("disabled")).toBeDefined();
      expect(retryButton(mountRetry({ status: "failed" })).attributes("disabled")).toBeUndefined();
    });

    it("is hidden on a read-only page", () => {
      const mountReal = (readonly) =>
        mount(AiTaskRow, {
          props: { task: task({ status: "failed" }), worker: null },
          global: {
            mocks: { $t },
            provide: { [READONLY]: ref(readonly) },
            stubs: { Tag: true, RouterLink: true, BasicButton: false },
            components: { BasicButton },
          },
        });
      expect(mountReal(true).find("[data-testid='ai-task-retry-9']").exists()).toBe(false);
      expect(mountReal(false).find("[data-testid='ai-task-retry-9']").exists()).toBe(true);
    });
  });
});
