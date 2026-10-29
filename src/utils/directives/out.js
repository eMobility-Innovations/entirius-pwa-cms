export const out = {
  mounted(el, binding) {
    const handler = (e) => {
      // The path, not el.contains(): a click can re-render its own target (a flatpickr day) and detach it first.
      if (!e.composedPath().includes(el)) {
        if (typeof binding.value === "function") {
          binding.value();
        } else if (typeof binding.value === "string" && binding.instance) {
          binding.instance[binding.value] = false;
        }
      }
    };
    el._outHandler = handler;
    document.addEventListener("click", handler);
  },

  unmounted(el) {
    document.removeEventListener("click", el._outHandler);
    el._outHandler = null;
  },
};
