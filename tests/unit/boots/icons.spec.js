import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { findIconDefinition } from "@fortawesome/fontawesome-svg-core";
import registerFontAwesome from "@/boots/Icons/fa-icons";
import { ICONS } from "@/boots/Icons/icons";

const app = { component: () => {}, config: { globalProperties: {} } };
registerFontAwesome(app);

describe("icon meaning registry", () => {
  it("points every meaning at a glyph registered in fa-icons.js", () => {
    const unregistered = Object.entries(ICONS).filter(
      ([, iconName]) => !findIconDefinition({ prefix: "fas", iconName })
    );
    expect(unregistered).toEqual([]);
  });

  it("gives every glyph one meaning", () => {
    // A plain reduce, not Object.groupBy: the CMS supports Node 20 (engines).
    const meaningsOf = Object.keys(ICONS).reduce(
      (groups, meaning) => ({ ...groups, [ICONS[meaning]]: [...(groups[ICONS[meaning]] ?? []), meaning] }),
      {}
    );
    const shared = Object.values(meaningsOf).filter((meanings) => meanings.length > 1);
    expect(shared).toEqual([]);
  });

  it("is frozen and reaches templates as $icons", () => {
    expect(Object.isFrozen(ICONS)).toBe(true);
    expect(app.config.globalProperties.$icons).toBe(ICONS);
  });
});

describe("icon props of the boot components", () => {
  // A raw FontAwesome name passed as `icon="…"` resolves to nothing: these components look meanings up only.
  const iconProp = /<(EmptyState|IconButton|BasicButton|FloatingActions)\b[^>]*?\sicon="([^"]+)"/gs;
  const vueFiles = fs
    .readdirSync("src", { recursive: true })
    .filter((file) => file.endsWith(".vue"))
    .map((file) => path.join("src", file));

  it("pass a meaning of icons.js, never a glyph name", () => {
    const glyphs = vueFiles.flatMap((file) =>
      [...fs.readFileSync(file, "utf8").matchAll(iconProp)]
        .filter(([, , icon]) => !Object.hasOwn(ICONS, icon))
        .map(([, tag, icon]) => `${file}: <${tag} icon="${icon}">`)
    );
    expect(glyphs).toEqual([]);
  });

  it("give every icon-only-mobile BasicButton an icon, its only content on a phone", () => {
    const buttons = /<BasicButton\b[^>]*?class="[^"]*\bicon-only-mobile\b[^"]*"[^>]*>/gs;
    const empty = vueFiles.flatMap((file) =>
      [...fs.readFileSync(file, "utf8").matchAll(buttons)]
        .filter(([tag]) => !/\sicon="/.test(tag))
        .map(([tag]) => `${file}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`)
    );
    expect(empty).toEqual([]);
  });
});
