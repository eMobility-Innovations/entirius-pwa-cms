import { describe, it, expect } from "vitest";
import { createApp, h, resolveComponent } from "vue";
import { createPinia } from "pinia";

import registerBootComponents from "@/boots/register-elems";

// Mirrors the first paint of an unauthenticated visit: the app-shell logo plus the
// credential input and submit button Login-wall renders.
const FirstPaintLike = {
  render() {
    return h("div", [
      h(resolveComponent("BasicLogo"), { size: 22, variant: "full" }),
      h(resolveComponent("BasicInput"), { label: "Username" }),
      h(resolveComponent("BasicButton"), null, () => "Sign in"),
    ]);
  },
};

const mountApp = (rootComponent) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp(rootComponent);
  app.use(createPinia());
  registerBootComponents(app);
  app.mount(host);
  return { app, host };
};

describe("boot component registration", () => {
  it("paints logo, input and button on the first render, without waiting for a chunk to resolve", () => {
    const { app, host } = mountApp(FirstPaintLike);

    // No await anywhere: an async-registered component would still be a placeholder comment here.
    expect(host.querySelector(".basic-logo")).not.toBeNull();
    expect(host.querySelector("input.input-field")).not.toBeNull();
    expect(host.querySelector("button.button-basic").textContent).toContain("Sign in");

    app.unmount();
    host.remove();
  });
});
