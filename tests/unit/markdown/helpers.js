import { CASES } from "../fixtures/markdown/corpus";

/** HTML of every corpus case rendered one by one with `render(md)`, as one text for a file snapshot. */
export function renderAll(render) {
  return Object.entries(CASES)
    .map(([name, md]) => `<!-- ${name} -->\n${render(md)}`)
    .join("\n\n");
}

/** What must never reach the DOM of a sanitised place. */
export function unsafeIn(root) {
  const found = [];
  if (root.querySelector("script, iframe, object, embed, style")) found.push("active element");
  root.querySelectorAll("*").forEach((el) => {
    for (const attr of el.attributes) {
      if (/^on/i.test(attr.name)) found.push(`${el.tagName}.${attr.name}`);
      if (/^(href|src)$/i.test(attr.name) && /^\s*(javascript|data|vbscript):/i.test(attr.value)) found.push(`${el.tagName}.${attr.name}`);
    }
  });
  return found;
}

/** Shared behaviour assertions on a rendered root (cases rendered together from FULL or alone). */
export function expectRenderedCorpus(root) {
  expect([...root.querySelectorAll("h1")].map((h) => h.textContent)).toContain("Title one");
  expect(root.querySelector("h2").textContent).toBe("Section two");
  expect(root.textContent).toContain("Zażółć gęślą jaźń");
  expect(root.querySelectorAll("table th")).toHaveLength(3);
  expect([...root.querySelectorAll("table td")].map((c) => c.textContent)).toContain("Łódź");
  expect(root.querySelector("ul ul li").textContent).toContain("nested a");
  expect(root.querySelector("ol ol li").textContent).toContain("inner one");
  expect(root.querySelector("ol[start='5']")).not.toBeNull();
  expect(root.querySelectorAll("ol")).toHaveLength(3);
  expect(root.querySelector("pre code").textContent).toContain("const a = 1 < 2");
  expect(root.querySelector("p code").textContent).toBe("npm run build");
  expect(root.querySelector("a[href='https://example.com/a?b=1&c=2']").textContent).toBe("plain");
  expect(root.querySelector("a[href='https://example.com']").getAttribute("title")).toBe("The title");
  expect(root.querySelector("a[href='https://example.com/path']")).not.toBeNull();
  expect(root.querySelector("img[src='https://example.com/i.png']").getAttribute("alt")).toBe("alt text");
  expect(root.querySelector("blockquote blockquote").textContent).toContain("nested quote");
  expect(root.querySelector("a[href='https://example.com/ref']")).not.toBeNull();
  expect(root.querySelector("strong").textContent).toBe("bold");
  expect(root.querySelector("del")?.textContent).toBe("struck");
}
