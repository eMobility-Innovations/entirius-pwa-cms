// Browser-side probes, injected with `page.addScriptTag({ path })` and called as `window.visualProbes.*`.
(() => {
  // Normalises a value through a probe element (no transition: main.scss animates colours on [data-theme] *).
  function normaliser() {
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.transition = "none";
    const normalise = (property, value) => {
      probe.style[property] = "";
      probe.style[property] = value;
      return getComputedStyle(probe)[property];
    };
    return { normalise, dispose: () => probe.remove() };
  }

  // expected = { <css property>: { <--token>: <source value> } } → tokens whose computed value on <html> differs.
  function resolveTokens(expected) {
    const { normalise, dispose } = normaliser();
    const html = getComputedStyle(document.documentElement);
    const mismatches = Object.entries(expected).flatMap(([property, tokens]) =>
      Object.entries(tokens)
        .map(([name, value]) => ({ name, expected: value, actual: html.getPropertyValue(name).trim() }))
        .filter(({ actual, expected: value }) => !actual || normalise(property, actual) !== normalise(property, value))
        .map((row) => ({ ...row, actual: row.actual || "(not defined)" }))
    );
    dispose();
    return mismatches;
  }

  function colourClassifier(colorTokenNames) {
    const { normalise, dispose } = normaliser();
    const html = getComputedStyle(document.documentElement);
    const values = colorTokenNames.map((name) => normalise("color", html.getPropertyValue(name).trim()));
    dispose();
    // A token may carry its own alpha (the hairline, the overlays): its exact value is the token, not a tint.
    const exact = new Set(values);
    const tokens = new Set(values.map((value) => `rgb(${channels(value).slice(0, 3).join(", ")})`));
    return (color) => {
      const [r, g, b, a] = channels(color);
      if (a === 0) return "transparent";
      if (exact.has(color)) return "token";
      if (!tokens.has(`rgb(${r}, ${g}, ${b})`)) return "off-token";
      return a === 1 ? "token" : "tint";
    };
  }

  // `rgb(r, g, b)` / `rgba(r, g, b, a)`, or `color(srgb r g b / a)` (0–1 channels) from color-mix().
  function channels(color) {
    const [r, g, b, a = 1] = (color.match(/[\d.]+/g) || []).map(Number);
    const scale = color.startsWith("color(srgb") ? 255 : 1;
    return [...[r, g, b].map((c) => Math.round(c * scale)), a];
  }

  const describe = (el) =>
    [el.tagName.toLowerCase(), ...(typeof el.className === "string" ? el.className.trim().split(/\s+/) : [])]
      .filter(Boolean)
      .join(".");
  const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());

  function visibleElements() {
    return [...document.querySelectorAll("body *")]
      .map((el) => ({ el, style: getComputedStyle(el), box: el.getBoundingClientRect() }))
      .filter(({ style, box }) => box.width > 0 && box.height > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0);
  }

  // A background marked `data-census="data"` is data, not styling (a stored colour in the ColorInput swatch); any
  // other inline background — a script-bound colour — is measured like a stylesheet one.
  const isDataColour = (el) => el.dataset?.census === "data";
  function colourSamples({ el, style }) {
    const samples = isDataColour(el) ? [] : [["background-color", style.backgroundColor]];
    if (hasOwnText(el)) samples.push(["color", style.color]);
    if (parseFloat(style.borderTopWidth) > 0) samples.push(["border-color", style.borderTopColor]);
    return samples.map(([property, value]) => ({ property, value, el }));
  }

  function groupOffToken(samples) {
    const groups = new Map();
    for (const { property, value, el } of samples) {
      const entry = groups.get(`${property}|${value}`) || { property, value, count: 0, samples: [] };
      entry.count += 1;
      if (entry.samples.length < 3) entry.samples.push(describe(el));
      groups.set(`${property}|${value}`, entry);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  }

  const distinct = (values) => [...new Set(values)].sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
  const firstFamily = (style) => style.fontFamily.split(",")[0].trim().replace(/["']/g, "");

  // A radius or font size of an element that is not on its scale (`scale` = { radius: [px…], fontSize: [px…] }).
  // Text inside an SVG (the logo wordmark) is part of the drawing, sized in its viewBox: not UI type.
  const isUiText = (el) => hasOwnText(el) && !(el instanceof SVGElement);
  function offScale(elements, scale) {
    const corners = (style) =>
      new Set([style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius]);
    const samples = elements.flatMap(({ el, style }) => [
      ...[...corners(style)].map((value) => ({ property: "border-radius", value, el })),
      ...(isUiText(el) ? [{ property: "font-size", value: style.fontSize, el }] : []),
    ]);
    const allowed = { "border-radius": new Set(["0px", ...scale.radius]), "font-size": new Set(scale.fontSize) };
    return groupOffToken(samples.filter(({ property, value }) => !allowed[property].has(value)));
  }

  // Census of every visible element against the theme's semantic colour tokens and the radius / type scales.
  function census(colorTokenNames, scale) {
    const classify = colourClassifier(colorTokenNames);
    const elements = visibleElements();
    const samples = elements.flatMap(colourSamples);
    const tints = {};
    samples.filter((s) => classify(s.value) === "tint").forEach((s) => (tints[s.value] = (tints[s.value] || 0) + 1));
    return {
      elements: elements.length,
      offToken: groupOffToken(samples.filter((s) => classify(s.value) === "off-token")),
      offScale: offScale(elements, scale),
      tints,
      radii: distinct(elements.map(({ style }) => style.borderTopLeftRadius)),
      fontSizes: distinct(elements.map(({ style }) => style.fontSize)),
      fontFamilies: distinct(elements.map(({ style }) => firstFamily(style))),
    };
  }

  // Elements carrying data-fid → their box and radius (layer 2).
  function fidBoxes() {
    return [...document.querySelectorAll("[data-fid]")].map((el) => {
      const box = el.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      return { id: el.dataset.fid, x: box.x, y: box.y, width: box.width, height: box.height, radius };
    });
  }

  window.visualProbes = { resolveTokens, census, fidBoxes };
})();
