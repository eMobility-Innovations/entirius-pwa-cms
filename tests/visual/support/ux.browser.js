// Browser-side `@ux` measurements, injected with `page.addScriptTag({ path })` and called as
// `window.uxProbes.measure({ viewportWidth, mobile })`. Measures only what a user can see: display:none,
// visibility:hidden, opacity 0, aria-hidden/inert subtrees, visually-hidden a11y text, closed off-canvas layers and
// content clipped away entirely (collapsed accordions, scrolled-out table cells) are skipped.
(() => {
  const INTERACTIVE = 'button, a[href], [role="button"], input:not([type="hidden"]), select';
  const ROLES = ["button", "link", "tab", "menuitem", "option", "checkbox", "switch", "radio", "treeitem"];
  const NATIVE = "button, a[href], input, select, textarea, label, summary, [contenteditable]";
  const SEMANTIC = `${NATIVE}, ${ROLES.map((role) => `[role="${role}"]`)}`;
  const CLICKABLE_ROW = '[role="row"], [role="gridcell"], tr, td'; // a row click duplicates the row's own actions
  const JOINED = '[role="tablist"], [role="radiogroup"], [role="group"], [role="toolbar"], [class*="segmented"]';
  const DELETE_ICON = '.icon-bin, .icon-trash, [data-icon="trash"], [data-icon="trash-can"]';
  const DELETE_LABEL = /usuń|delete|remove|odłącz|unlink/i;
  const HARD_CLIP = /^(hidden|clip)$/;
  const SCROLLER = /^(auto|scroll)$/;
  const MIN_SIZE = 8;
  const MIN_TAP = 40;
  const MIN_GAP = 8;
  const EPS = 1;
  const TRANSPARENT = "rgba(0, 0, 0, 0)";
  let viewportWidth = innerWidth; // set by measure()

  const styles = new Map();
  const styleOf = (el) => styles.get(el) || styles.set(el, getComputedStyle(el)).get(el);
  const round = (n) => Math.round(n * 10) / 10;
  const toRect = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  const width = (r) => Math.max(0, r.right - r.left);
  const height = (r) => Math.max(0, r.bottom - r.top);
  const boxOf = (r) => ({ x: round(r.left), y: round(r.top), width: round(width(r)), height: round(height(r)) });
  const isRoot = (el) => el === document.body || el === document.documentElement;
  const textOf = (el) => (el.innerText || "").trim(); // SVG elements have no innerText

  function intersect(a, b, axes) {
    const r = { ...a };
    if (axes.x) Object.assign(r, { left: Math.max(a.left, b.left), right: Math.min(a.right, b.right) });
    if (axes.y) Object.assign(r, { top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });
    return r;
  }

  // The part of `rect` its overflow:hidden|clip ancestors (from `node` up, `stop` included) leave visible. Per axis,
  // the walk ends at the first scroller of that axis: what lies beyond it is reachable by scrolling.
  function clip(rect, node, stop) {
    let r = rect;
    const open = { x: true, y: true };
    for (let n = node; n && !isRoot(n) && (open.x || open.y); n = n.parentElement) {
      const s = styleOf(n);
      open.x &&= !SCROLLER.test(s.overflowX);
      open.y &&= !SCROLLER.test(s.overflowY);
      const axes = { x: open.x && HARD_CLIP.test(s.overflowX), y: open.y && HARD_CLIP.test(s.overflowY) };
      if (axes.x || axes.y) r = intersect(r, toRect(n.getBoundingClientRect()), axes);
      if (n === stop || s.position === "fixed") break;
    }
    return r;
  }

  const clipOf = (el, stop) => {
    const rect = toRect(el.getBoundingClientRect());
    return styleOf(el).position === "fixed" ? rect : clip(rect, el.parentElement, stop);
  };

  // The a11y-text pattern (`.sr-only`): clipped away, or an absolute 1 × 1 px box that cuts its overflow. An absolute
  // control that collapsed to 0 px on one axis is not hidden on purpose: it stays in, and zeroSize reports it.
  function isVisuallyHidden(el) {
    const s = styleOf(el);
    const b = el.getBoundingClientRect();
    if (s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)") return true;
    const cut = HARD_CLIP.test(s.overflowX) && HARD_CLIP.test(s.overflowY);
    return s.position === "absolute" && cut && b.width <= 1 && b.height <= 1;
  }

  // A closed drawer or sheet parked outside the viewport (fixed anywhere, absolute sideways).
  function inParkedLayer(el) {
    for (let n = el; n && !isRoot(n); n = n.parentElement) {
      const pos = styleOf(n).position;
      if (pos !== "fixed" && pos !== "absolute") continue;
      const b = n.getBoundingClientRect();
      const sideways = b.right <= 0 || b.left >= viewportWidth;
      if (sideways || (pos === "fixed" && (b.bottom <= 0 || b.top >= innerHeight))) return true;
    }
    return false;
  }

  function isHidden(el) {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return true;
    if (el.closest('[aria-hidden="true"], [inert]') || isVisuallyHidden(el)) return true;
    const seen = clipOf(el);
    const b = el.getBoundingClientRect();
    const clippedAway = b.width > 0 && b.height > 0 && (width(seen) <= 0 || height(seen) <= 0);
    return clippedAway || inParkedLayer(el);
  }

  // The element itself keeps its tag and classes next to its test id: the allow-list matches on the component class.
  function selectorOf(el) {
    const parts = [];
    for (let n = el; n && !isRoot(n) && parts.length < 4; n = n.parentElement) {
      const classes = typeof n.className === "string" ? n.className.trim().split(/\s+/).filter(Boolean) : [];
      const own = [n.tagName.toLowerCase(), ...classes.slice(0, 2).map((c) => CSS.escape(c))].join(".");
      const testid = n.dataset.testid && `[data-testid="${n.dataset.testid}"]`;
      if (testid) return [n === el ? `${own}${testid}` : testid, ...parts].join(" > ");
      const same = n.parentElement ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : [];
      const nth = same.length > 1 ? `:nth-of-type(${same.indexOf(n) + 1})` : "";
      parts.unshift(own + nth);
    }
    return parts.join(" > ");
  }

  const nameOf = (el) =>
    (el.getAttribute("aria-label") || textOf(el) || el.value || el.getAttribute("title") || "").trim().slice(0, 60);

  const issue = (kind, detail, el, rect) => ({
    kind,
    detail,
    selector: selectorOf(el),
    text: nameOf(el),
    box: boxOf(rect || el.getBoundingClientRect()),
  });

  // The native input of a custom checkbox or radio is drawn by its label (often at 0 px): the label is the target.
  const OPTION_INPUT = 'input[type="checkbox"], input[type="radio"]';
  const sizeTarget = (el) => (el.matches(OPTION_INPUT) && el.closest("label")) || el;

  function sizeIssue(control) {
    const el = sizeTarget(control);
    const b = el.getBoundingClientRect();
    if (b.width < MIN_SIZE || b.height < MIN_SIZE) return issue("zeroSize", "too-small", el);
    const seen = clipOf(el);
    if (width(seen) < b.width - EPS || height(seen) < b.height - EPS) return issue("zeroSize", "clipped", el);
    return null;
  }

  // Mobile emulation keeps the custom scrollbar as a classic one, so `100vw` ends under it (the 6 px "page scroll"
  // of every mobile screen); a phone draws overlay scrollbars. That gutter is not off the viewport.
  const scrollbarGutter = () => Math.min(Math.max(innerWidth - document.documentElement.clientWidth, 0), 20);

  // A sideways scroller between the element and the document (a wide table) brings it into view.
  function inSidewaysScroller(el) {
    for (let n = el.parentElement; n && !isRoot(n); n = n.parentElement) {
      if (SCROLLER.test(styleOf(n).overflowX) && n.scrollWidth > n.clientWidth + EPS) return true;
    }
    return false;
  }

  // Horizontal only: below the fold is what page scrolling is for.
  function offViewportIssue(el) {
    const b = el.getBoundingClientRect();
    if (b.right <= viewportWidth + EPS && b.left >= -EPS) return null;
    return inSidewaysScroller(el) ? null : issue("offViewport", "beyond-viewport-width", el);
  }

  // The effective target of a checkbox or radio is its label.
  function tapIssue(el) {
    const label = el.closest("label");
    const b = (label || el).getBoundingClientRect();
    if (el.tagName === "A" && styleOf(el).display === "inline") return null; // inline text link (WCAG 2.5.8 exception)
    if (b.width >= MIN_TAP && b.height >= MIN_TAP) return null;
    return issue("tapTarget", `${Math.round(b.width)}x${Math.round(b.height)}`, el, b);
  }

  // An element pushed off the viewport is also clipped by the app column: reported once, as off-viewport.
  function interactiveIssues(controls, mobile) {
    return controls
      .flatMap((el) => {
        const [size, off] = [sizeIssue(el), offViewportIssue(el)];
        return [off && size?.detail === "clipped" ? null : size, off, mobile ? tapIssue(el) : null];
      })
      .filter(Boolean);
  }

  const accessibleName = (el) =>
    Boolean(
      el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        el.getAttribute("title") ||
        textOf(el) ||
        el.querySelector("img[alt]:not([alt=''])")
    );

  // A clickable `span`/`div`: the outermost element with cursor:pointer that has no semantics of its own.
  const isPointerAction = (el) =>
    styleOf(el).cursor === "pointer" &&
    styleOf(el.parentElement).cursor !== "pointer" &&
    !el.closest(SEMANTIC) &&
    !el.matches(CLICKABLE_ROW);

  function nonFocusableIssues(pointerActions) {
    return pointerActions
      .map((el) => {
        if (el.tabIndex < 0) return issue("nonFocusable", "not-focusable", el);
        return accessibleName(el) ? null : issue("nonFocusable", "no-accessible-name", el);
      })
      .filter(Boolean);
  }

  const union = (rects) =>
    rects.length
      ? {
          left: Math.min(...rects.map((r) => r.left)),
          top: Math.min(...rects.map((r) => r.top)),
          right: Math.max(...rects.map((r) => r.right)),
          bottom: Math.max(...rects.map((r) => r.bottom)),
        }
      : null;
  const byLeft = (a, b) => a.rect.left - b.rect.left;
  const painted = (el) => {
    const s = styleOf(el);
    const replaced = /^(img|svg|input|select|button)$/i.test(el.tagName);
    return replaced || s.backgroundColor !== TRANSPARENT || parseFloat(s.borderTopWidth) > 0;
  };

  // What a table cell shows: its text runs and painted boxes (badges, chips, controls), clipped as the cell clips.
  function contentRect(cell) {
    const rects = [];
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode;
      if (!text.textContent.trim() || isHidden(text.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      rects.push(clip(toRect(range.getBoundingClientRect()), text.parentElement, cell));
    }
    for (const el of cell.querySelectorAll("*")) if (painted(el) && !isHidden(el)) rects.push(clipOf(el, cell));
    return union(rects.filter((r) => width(r) > 0 && height(r) > 0));
  }

  // Neighbours on one line (sorted by left): intersection > 1 px is an overlap, a gap of 1–8 px is cramped. Flush
  // neighbours (a tab bar, a joined input + button) are one group by design.
  function pairIssues(items) {
    const issues = [];
    for (let i = 1; i < items.length; i += 1) {
      const [a, b] = [items[i - 1].rect, items[i].rect];
      if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= EPS) continue;
      const gap = b.left - a.right;
      if (gap < -EPS) issues.push(issue("overlap", `intersect ${round(-gap)}px`, items[i].el, b));
      else if (gap > EPS && gap < MIN_GAP) issues.push(issue("overlap", `gap ${round(gap)}px`, items[i].el, b));
    }
    return issues;
  }

  function rowIssues(rows) {
    return rows.flatMap((row) => {
      const cells = [...row.children].filter((cell) => !isHidden(cell));
      const items = cells.map((el) => ({ el, rect: contentRect(el) })).filter((item) => item.rect);
      return pairIssues(items.sort(byLeft));
    });
  }

  // A toolbar item is a control or a wrapper around exactly one (a layout column holding several is not).
  const isControl = (el) => el.matches(INTERACTIVE) || el.querySelectorAll(INTERACTIVE).length === 1;

  function isControlRow(el) {
    const s = styleOf(el);
    if (!/flex/.test(s.display) || s.flexDirection.startsWith("column")) return false;
    return !el.matches(`${JOINED}, [role="row"], tr`) && !el.closest(".ProseMirror");
  }

  function toolbarIssues(shown) {
    return shown.filter(isControlRow).flatMap((row) => {
      const items = [...row.children].filter((c) => !isHidden(c) && isControl(c));
      if (items.length < 2) return [];
      return pairIssues(items.map((el) => ({ el, rect: toRect(el.getBoundingClientRect()) })).sort(byLeft));
    });
  }

  const hasShortText = (el) => Boolean(textOf(el)) && el.querySelectorAll("*").length <= 4;

  // A sideways scroller whose scrollbar has no thickness: nothing shows that it scrolls (vertical scrolling is
  // expected, a hidden vertical bar is not reported).
  function hiddenScrollbar(el, s, dx) {
    const barX = el.offsetHeight - el.clientHeight - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth);
    return SCROLLER.test(s.overflowX) && dx > EPS && barX < EPS;
  }

  // The document scroller is skipped: its 6 px on mobile is the emulated custom scrollbar, not a layout defect.
  function overflowIssue(el) {
    const s = styleOf(el);
    const [dx, dy] = [el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight];
    if (isRoot(el) || (dx <= EPS && dy <= EPS)) return null;
    const cutX = HARD_CLIP.test(s.overflowX) && dx > EPS;
    if (cutX && hasShortText(el)) return el.closest("[title]") ? null : issue("overflow", "text-cut-no-title", el);
    if (cutX || (HARD_CLIP.test(s.overflowY) && dy > EPS)) return issue("overflow", "content-clipped", el);
    return hiddenScrollbar(el, s, dx) ? issue("overflow", "no-scrollbar", el) : null;
  }

  // Mobile: the page frame (PageLayout) and a card never scroll sideways; a wide table, tab row or tile row scrolls
  // inside its own box.
  const cardScrollsSideways = (el) => el.scrollWidth > el.clientWidth + EPS;
  function cardIssues(shown, mobile) {
    if (!mobile) return [];
    return shown
      .filter((el) => el.matches(".page-layout, .page-card") && cardScrollsSideways(el))
      .map((el) => issue("overflow", "card-x", el));
  }

  // A fixed or sticky bar across the bottom of the viewport (the mobile bottom nav, a sticky action bar). The dialog
  // layer itself and the BasicMenu bottom sheet cover the page on purpose: they are no bar. A sticky bar INSIDE a
  // dialog is one — it can cover the dialog's own controls.
  const COVERING_LAYER = '[role="dialog"], .basic-menu__popover--bottom';
  function findBottomBar(shown) {
    return shown.find((el) => {
      if (!/^(fixed|sticky)$/.test(styleOf(el).position) || el.matches(COVERING_LAYER)) return false;
      const b = el.getBoundingClientRect();
      const acrossBottom = b.bottom >= innerHeight - 2 && b.width >= viewportWidth * 0.6;
      return acrossBottom && b.height > 0 && b.height <= innerHeight * 0.3;
    });
  }

  function scrollToEnd(elements) {
    for (const el of elements) {
      const scrolls = SCROLLER.test(styleOf(el).overflowY) && el.scrollHeight > el.clientHeight + EPS;
      if (scrolls) el.scrollTop = el.scrollHeight;
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  }

  // At full scroll, a control whose centre the bar still covers can never be reached.
  function underBarIssues(controls, bar) {
    if (!bar) return [];
    const barTop = bar.getBoundingClientRect().top;
    return controls
      .filter((el) => !bar.contains(el))
      .map((el) => {
        const b = el.getBoundingClientRect();
        const [x, y] = [b.left + b.width / 2, b.top + b.height / 2];
        if (y < barTop || y > innerHeight) return null;
        const hit = document.elementFromPoint(x, y);
        return hit && bar.contains(hit) ? issue("underBottomBar", "covered-at-full-scroll", el) : null;
      })
      .filter(Boolean);
  }

  function tokenColours() {
    const probe = document.body.appendChild(document.createElement("div"));
    const read = (name) => {
      probe.style.backgroundColor = `var(${name})`;
      return getComputedStyle(probe).backgroundColor;
    };
    const negative = ["--negative", "--negative-fill", "--negative-subtle"].map(read);
    const colours = { accent: read("--accent-fill"), negative };
    probe.remove();
    return colours;
  }

  function buttonRole(el, colours) {
    const s = styleOf(el);
    const label = `${el.getAttribute("aria-label") || ""} ${textOf(el)} ${el.title}`;
    const negative = colours.negative.includes(s.backgroundColor) || colours.negative.includes(s.color);
    if (negative || DELETE_LABEL.test(label) || el.querySelector(DELETE_ICON)) return "danger";
    if (s.backgroundColor === colours.accent) return "primary";
    if (!textOf(el)) return "icon-only";
    return s.backgroundColor === TRANSPARENT && parseFloat(s.borderTopWidth) > 0 ? "outline" : "secondary";
  }

  function buttonMetrics(shown) {
    const colours = tokenColours();
    return shown
      .filter((el) => el.matches('button:not([role]), [role="button"]'))
      .map((el) => {
        const s = styleOf(el);
        const metrics = { height: round(el.getBoundingClientRect().height), paddingX: s.paddingLeft };
        Object.assign(metrics, { radius: s.borderTopLeftRadius, fontSize: s.fontSize, border: s.borderTopWidth });
        return { role: buttonRole(el, colours), ...metrics, selector: selectorOf(el), text: nameOf(el) };
      });
  }

  // Field labels (not the text beside a checkbox, radio or switch, not a file picker): one style per label, for the
  // census. A label is a `label`, a shared label class, or any element a control names in `aria-labelledby`; one
  // nested in another label is its text, not a second label. A label that wraps its control is measured on its text:
  // the label itself when the text sits in it directly, else its first child with text that is neither a control nor
  // holds one.
  const FIELD_LABEL = "label, .form-field__label";
  const OPTION_LABEL =
    'input[type="checkbox"], input[type="radio"], input[type="file"], [role="switch"], [role="checkbox"]';
  const CONTROL = "input, select, textarea, [contenteditable]";
  const LABELLED_ROLES = '[role="combobox"], [role="listbox"], [role="textbox"], [role="spinbutton"], [role="slider"]';
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  function labelText(el) {
    if (!el.querySelector(CONTROL) || ownText(el)) return el;
    return [...el.children].find((c) => textOf(c) && !c.matches(CONTROL) && !c.querySelector(CONTROL)) || el;
  }
  function labelledIds() {
    const named = [...document.querySelectorAll(`:is(${CONTROL}, ${LABELLED_ROLES})[aria-labelledby]`)];
    const refs = named.map((el) => el.getAttribute("aria-labelledby"));
    return new Set(refs.flatMap((ids) => ids.split(/\s+/)).filter(Boolean));
  }
  function labelStyles(shown) {
    const ids = labelledIds();
    const isLabel = (el) => el.matches(FIELD_LABEL) || (el.id && ids.has(el.id));
    return shown
      .filter((el) => isLabel(el) && textOf(el) && !el.querySelector(OPTION_LABEL))
      .filter((el) => !el.parentElement.closest(FIELD_LABEL))
      .map((el) => {
        const s = styleOf(labelText(el));
        return { style: `${s.fontSize} ${s.fontWeight} ${s.textTransform} ${s.color}`, text: nameOf(el) };
      });
  }

  // Cards: a bordered, filled container of at least 240 × 96 that is not a control or a table part.
  // The rich-text editor frame and its toolbar are one control, not cards.
  const TABLE_PART = 'table, tr, td, th, [role="row"], [role="grid"], [role="table"]';
  const NOT_CARD = `${INTERACTIVE}, textarea, ${TABLE_PART}, .text-section, .input-wysiwyg-wrapper *`;
  function cardPaddings(shown) {
    return shown
      .filter((el) => !el.matches(NOT_CARD) && parseFloat(styleOf(el).borderTopWidth) > 0)
      .filter((el) => styleOf(el).backgroundColor !== TRANSPARENT)
      .filter((el) => el.getBoundingClientRect().width >= 240 && el.getBoundingClientRect().height >= 96)
      .map((el) => {
        const s = styleOf(el);
        const padding = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].join(" ");
        return { padding, radius: s.borderTopLeftRadius, selector: selectorOf(el) };
      });
  }

  // Scrolls every scroller to its end last: the bottom-bar check needs it, the others need the page as captured.
  function measure(options) {
    viewportWidth = options.viewportWidth + scrollbarGutter();
    const elements = [...document.querySelectorAll("body *")];
    const shown = elements.filter((el) => !isHidden(el));
    const pointerActions = shown.filter(isPointerAction);
    const controls = [...shown.filter((el) => el.matches(INTERACTIVE)), ...pointerActions];
    const rows = shown.filter((el) => el.matches('[role="row"], tr'));
    const issues = [...interactiveIssues(controls, options.mobile), ...nonFocusableIssues(pointerActions)];
    issues.push(...rowIssues(rows));
    issues.push(...toolbarIssues(shown), ...shown.map(overflowIssue).filter(Boolean));
    issues.push(...cardIssues(shown, options.mobile));
    const buttons = buttonMetrics(shown);
    const census = { labels: labelStyles(shown), cards: cardPaddings(shown) };
    const bar = findBottomBar(shown);
    scrollToEnd(elements);
    issues.push(...underBarIssues(controls, bar));
    return { issues, buttons, ...census, bottomBar: bar ? selectorOf(bar) : null };
  }

  window.uxProbes = { measure };
})();
