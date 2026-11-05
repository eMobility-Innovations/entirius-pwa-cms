import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { findIconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import * as solid from "@fortawesome/free-solid-svg-icons";
import registerFontAwesome from "@/boots/Icons/fa-icons";
import { ICONS } from "@/boots/Icons/icons";
import { panels } from "@/configs/access";
import { buildNavRoutes, LEADS_SETTINGS_SECTIONS } from "@/components/Navigation/nav-routes";

// Guards the Font Awesome upgrade: a renamed or dropped icon is `undefined` in `library.add` and renders an empty
// box without any error. The registry (fa-icons.js) is read as text so a bad import is caught by name.
const registerSource = fs.readFileSync("src/boots/Icons/fa-icons.js", "utf8");
const importBlock = registerSource.match(/import\s*\{([^}]+)\}\s*from\s*"@fortawesome\/free-solid-svg-icons"/)[1];
const importedNames = importBlock.split(",").map((name) => name.trim()).filter(Boolean);

const app = { component: () => {}, config: { globalProperties: {} } };
registerFontAwesome(app);

const isRegistered = (iconName) => Boolean(findIconDefinition({ prefix: "fas", iconName }));

const srcFiles = fs
  .readdirSync("src", { recursive: true })
  .filter((file) => /\.(vue|js)$/.test(file))
  .map((file) => path.join("src", file));
const readSrc = (file) => fs.readFileSync(file, "utf8");

describe("Font Awesome registry (fa-icons.js)", () => {
  it("imports a defined icon for every name", () => {
    const missing = importedNames.filter((name) => solid[name] === undefined);
    expect(missing).toEqual([]);
  });

  it("gives every imported icon an iconName and an svg path", () => {
    const broken = importedNames.filter((name) => {
      const def = solid[name];
      return !def || typeof def.iconName !== "string" || typeof def.icon?.[4] !== "string" || !def.icon[4];
    });
    expect(broken).toEqual([]);
  });

  it("registers every imported icon in the library", () => {
    const unregistered = importedNames.filter((name) => !isRegistered(solid[name].iconName));
    expect(unregistered).toEqual([]);
  });

  it("imports the same set it adds to the library", () => {
    const addBlock = registerSource.match(/library\.add\(([^)]+)\)/)[1];
    const added = addBlock.split(",").map((name) => name.trim()).filter(Boolean);
    expect([...added].sort()).toEqual([...importedNames].sort());
  });
});

describe("icon names used in src/ are registered", () => {
  const navEntries = [...buildNavRoutes(), ...LEADS_SETTINGS_SECTIONS];

  it("every glyph of the meaning registry (icons.js)", () => {
    expect(Object.values(ICONS).filter((name) => !isRegistered(name))).toEqual([]);
  });

  it("every panel glyph (configs/access.js)", () => {
    const missing = panels.filter((panel) => !isRegistered(panel.icon)).map((panel) => `${panel.idx}: ${panel.icon}`);
    expect(missing).toEqual([]);
  });

  it("every navigation glyph (nav-routes.js)", () => {
    const missing = navEntries.filter((entry) => entry.icon && !isRegistered(entry.icon)).map((e) => `${e.route}: ${e.icon}`);
    expect(missing).toEqual([]);
  });

  it("every literal `icon: \"name\"` / `icon=\"name\"` in src is a meaning or a registered glyph", () => {
    const literal = /(?<![:\w])icon(?::\s*|=)["']([a-z][a-zA-Z0-9-]*)["']/g;
    const unknown = srcFiles.flatMap((file) =>
      [...readSrc(file).matchAll(literal)]
        .map(([, name]) => name)
        .filter((name) => !Object.hasOwn(ICONS, name) && !isRegistered(name))
        .map((name) => `${file}: ${name}`)
    );
    expect(unknown).toEqual([]);
  });

  it("every name in a ternary `:icon=\"a ? 'x' : 'y'\"` is a meaning or a registered glyph", () => {
    const ternary = /:icon="([^"]*\?[^"]*)"/g;
    const unknown = srcFiles.flatMap((file) =>
      [...readSrc(file).matchAll(ternary)]
        .flatMap(([, expression]) => [...expression.replace(/[!=]==?\s*'[^']*'/g, "").matchAll(/'([a-zA-Z][a-zA-Z0-9-]*)'/g)].map(([, name]) => name))
        .filter((name) => !Object.hasOwn(ICONS, name) && !isRegistered(name))
        .map((name) => `${file}: ${name}`)
    );
    expect(unknown).toEqual([]);
  });

  it("every glyph ProductFiles.vue picks by file type", () => {
    const source = readSrc("src/views/Pim/components/ProductFiles.vue");
    const fileIcons = [...source.matchAll(/return "(file[a-z-]*)"/g)].map(([, name]) => name);
    expect(fileIcons.length).toBeGreaterThan(1);
    expect(fileIcons.filter((name) => !isRegistered(name))).toEqual([]);
  });
});

describe("FontAwesomeIcon renders the registered icons", () => {
  // The global test setup stubs FontAwesomeIcon; here the real component draws the svg.
  const render = (icon) =>
    mount(FontAwesomeIcon, { props: { icon }, global: { stubs: { FontAwesomeIcon: false } } });

  it.each([
    ["a meaning glyph", ICONS.edit, "pen"],
    ["a panel glyph", "boxes-stacked", "boxes-stacked"],
    ["the alias faShoppingCart (shopping-cart)", "shopping-cart", "shopping-cart"],
    ["the alias faCheckSquare (square-check)", ICONS.checkboxOn, "square-check"],
  ])("%s", (_label, icon, dataIcon) => {
    const wrapper = render(icon);
    const svg = wrapper.find("svg");
    expect(svg.exists()).toBe(true);
    expect(svg.attributes("data-icon")).toBe(dataIcon);
    expect(svg.find("path").attributes("d")).toMatch(/^M/);
  });

  it("renders an empty component for an icon that is not registered", () => {
    expect(render("no-such-icon-xyz").find("svg").exists()).toBe(false);
  });
});
