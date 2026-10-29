// "New" in the Studio: Tasks (templates run on products) and Guided work (workflows).

/** Template keys that are steps of a workflow: they run inside a guided workflow, never on their own. */
export function stepTemplateKeys(workflows) {
  return new Set(workflows.flatMap((workflow) => (workflow.steps || []).map((step) => step.template)));
}

/** Tasks = runnable templates (useAiWorkers) that no workflow uses as a step, in their order. */
export function studioTasks(templates, workflows) {
  const steps = stepTemplateKeys(workflows);
  return templates.filter((template) => !steps.has(template.key));
}
