// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

// Stored HTML (page sections and tiles, legal texts) is rendered with `v-html` in a staff session. An account that can
// save content can send any markup through the API, past the editor, so the render side strips what could run script.
// jsdom: the sanitiser needs a spec-faithful parser, which the suite's default environment is not.
describe("sanitizeHtml", () => {
  it("drops event handlers and keeps the element", () => {
    expect(sanitizeHtml('<img src="https://cdn.test/a.png" onerror="alert(1)" alt="A">')).toBe(
      '<img src="https://cdn.test/a.png" alt="A">'
    );
    expect(sanitizeHtml('<p onclick="alert(1)">text</p>')).toBe("<p>text</p>");
  });

  it("drops a javascript: link target and keeps the text", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeHtml('<a href=" jav&#x09;ascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')).toBe("<a>x</a>");
  });

  it("drops script, iframe, object, embed, form and style elements", () => {
    const html =
      '<script>alert(1)</script><iframe src="https://x.test"></iframe><object data="x"></object>' +
      '<embed src="x"><form action="https://x.test"><input name="a"></form><style>p{color:red}</style><p>ok</p>';
    expect(sanitizeHtml(html)).toBe("<p>ok</p>");
  });

  it("drops svg and math, handlers included", () => {
    expect(sanitizeHtml('<svg onload="alert(1)"><a xlink:href="javascript:alert(1)"><text>x</text></a></svg><p>ok</p>')).toBe(
      "<p>ok</p>"
    );
    expect(sanitizeHtml('<math><mtext><img src=x onerror=alert(1)></mtext></math>')).not.toContain("onerror");
  });

  it("keeps only the editor's own styles: nothing that loads a url or lays content over the CMS", () => {
    expect(sanitizeHtml('<p style="background:url(https://x.test/a.png)">a</p>')).toBe("<p>a</p>");
    expect(sanitizeHtml('<p style="background-color:u\\72l(https://x.test/a.png)">a</p>')).toBe("<p>a</p>");
    expect(sanitizeHtml(`<p style="background-image:image-set('https://x.test/a.png' 1x)">a</p>`)).toBe("<p>a</p>");
    expect(sanitizeHtml('<a href="https://x.test" style="position:fixed;inset:0;z-index:99999;color:red">a</a>')).toBe(
      '<a href="https://x.test" style="color:red">a</a>'
    );
    expect(sanitizeHtml('<p class="modal-overlay">a</p>')).toBe("<p>a</p>");
    expect(sanitizeHtml('<table><tbody><tr><td style="min-width: 75px; width: 20%">a</td></tr></tbody></table>')).toContain(
      'style="min-width: 75px; width: 20%"'
    );
    expect(sanitizeHtml('<p style="text-align: center">a</p>')).toBe('<p style="text-align: center">a</p>');
    expect(sanitizeHtml('<span style="color: rgb(255, 0, 0)">a</span>')).toBe('<span style="color: rgb(255, 0, 0)">a</span>');
  });

  it("keeps http, https, mailto and relative links", () => {
    for (const href of ["https://shop.test/a", "http://shop.test/a", "mailto:office@shop.test", "/terms", "#top"]) {
      expect(sanitizeHtml(`<a href="${href}">x</a>`)).toBe(`<a href="${href}">x</a>`);
    }
  });

  it("gives a link that opens a new tab rel noopener noreferrer", () => {
    expect(sanitizeHtml('<a href="https://shop.test/a" target="_blank">x</a>')).toBe(
      '<a href="https://shop.test/a" target="_blank" rel="noopener noreferrer">x</a>'
    );
  });

  it("keeps http and https images and drops any other image source", () => {
    expect(sanitizeHtml('<img src="http://cdn.test/a.png">')).toBe('<img src="http://cdn.test/a.png">');
    expect(sanitizeHtml('<img src="data:image/svg+xml;base64,AAAA">')).toBe("<img>");
    expect(sanitizeHtml('<img src="javascript:alert(1)">')).toBe("<img>");
  });

  it("keeps what the rich-text editor writes", () => {
    const html =
      "<h2>Title</h2><p><strong>b</strong><em>i</em><u>u</u><s>s</s><code>c</code></p>" +
      '<ul><li><p>one</p></li></ul><ol><li><p>two</p></li></ol><blockquote><p>q</p></blockquote><hr>' +
      '<p><mark data-color="#ffff00" style="background-color: #ffff00">m</mark>' +
      '<span data-faq-tooltip="returns">faq</span></p>' +
      '<table><tbody><tr><th colspan="2" rowspan="1"><p>h</p></th></tr><tr><td colspan="1" rowspan="1"><p>c</p></td></tr></tbody></table>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("answers an empty string for no value", () => {
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
  });
});
