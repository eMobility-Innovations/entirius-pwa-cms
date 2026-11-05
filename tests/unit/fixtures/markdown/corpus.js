// One markdown corpus for every place the CMS renders markdown with `marked` (Docs, MarkdownField, ProposalEditor,
// TextArtifact). Each place renders all of it and keeps the HTML in a file snapshot, so a `marked` bump shows every
// visible difference. Add a case here and refresh the snapshots deliberately (`vitest -u`), never to hide a diff.
export const CASES = {
  headings: "# Title one\n\n## Section two\n\n### Sub three\n\nSetext heading\n---\n\n## Zażółć gęślą jaźń",
  paragraphs: "First paragraph\nsecond line of it\n\nSecond paragraph with trailing spaces  \nand a hard break",
  emphasis: "**bold** and *italic* and ~~struck~~ and ***both***, snake_case_word, 2 * 3 * 4",
  bullets: "- one\n- two\n  - nested a\n  - nested b\n    - deeper\n- three",
  numbered: "1. first\n2. second\n   1. inner one\n   2. inner two\n3. third\n\nbetween lists\n\n5. starts at five\n6. six",
  tasks: "- [x] done\n- [ ] open",
  table: "| Name | Qty | Note |\n|:-----|----:|:----:|\n| Sofa | 2 | **new** |\n| Łódź | 10 | a \\| pipe |",
  code_inline: "Use `npm run build` and `<div>` here.",
  code_block: "```js\nconst a = 1 < 2 && \"x\";\nconsole.log(a);\n```\n\n    indented code\n    second line\n\n```\nno language <b>x</b>\n```",
  links: "[plain](https://example.com/a?b=1&c=2) and [titled](https://example.com \"The title\") and [mail](mailto:a@b.pl) and [rel](/docs/page#anchor)",
  autolink: "Bare https://example.com/path and <https://example.org> and www.example.net and a@b.pl",
  link_javascript: "[click](javascript:alert(1)) and [data](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==) and [mixed](JaVaScRiPt:alert(2))",
  images: "![alt text](https://example.com/i.png \"img title\") and ![local](/media/a.jpg) and ![js](javascript:alert(3))",
  blockquote: "> quoted line\n> second\n>\n> > nested quote\n\nafter",
  rule: "above\n\n---\n\nbelow\n\n***",
  html_script: "before\n\n<script>alert('xss')</script>\n\nafter",
  html_onerror: "<img src=x onerror=\"alert('xss')\">\n\ntext <img src=\"y\" onerror=alert(1)> inline",
  html_other: "<iframe src=\"https://evil.example\"></iframe>\n\n<a href=\"javascript:alert(4)\" onclick=\"alert(5)\">raw link</a>\n\n<div style=\"position:fixed;top:0\" onmouseover=\"alert(6)\">box</div>\n\n<b>raw bold</b> and <details><summary>s</summary>d</details>",
  entities: "AT&T &amp; &copy; &lt;tag&gt; 5 < 6 > 4 \"quotes\" 'apos' &#8364; \\*escaped\\*",
  polish: "Zażółć gęślą jaźń: ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ - **pogrubienie** i `kod`",
  reference: "[ref link][r1] and ![ref img][r2]\n\n[r1]: https://example.com/ref\n[r2]: /media/ref.png",
  mixed_list_para: "Intro:\n\n- item with para\n\n  second para in item\n- item two\n\nOutro",
};

export const EMPTY = ["", null, undefined];

/** All cases in one document, a `<!-- name -->`-free join: cases are separated by a rule-less blank line. */
export const FULL = Object.values(CASES).join("\n\n");

/** Cases whose markdown carries active content; sanitised places must render none of it. */
export const HOSTILE = ["link_javascript", "images", "html_script", "html_onerror", "html_other"];
