import { nextTick, onBeforeUnmount, toValue, watch } from "vue";

// Focus trap of every modal overlay (BasicModal, ConfirmDialog, SideDrawer focused; P4 MobileMenu). While `active`
// is true: focus moves in (the `initialFocus` element, else the first focusable, else the container), Tab and
// Shift+Tab cycle inside, Esc calls `onEscape` (bubble phase, so an open menu inside closes first), the other
// children of <body> are `inert` and the body does not scroll. On release focus goes back to the element that had it
// before. Traps stack: the last one active owns the keyboard, the one below resumes when it closes. The container
// must be teleported to <body> (a direct child); an `inline` overlay (catalogue) never activates one.
export const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

const stack = [];
let scrollLock = null;

// Tab stops only: a `tabindex="-1"` item (a closed BasicMenu's) or a control hidden by `display: none` is none.
const isTabStop = (el) => el.tabIndex >= 0 && (typeof el.checkVisibility !== "function" || el.checkVisibility());
export const focusableIn = (root) => [...root.querySelectorAll(FOCUSABLE)].filter(isTabStop);

// The ancestor of `el` that is a child of <body> (the teleported root), or null outside the document.
function bodyChildOf(el) {
  let node = el;
  while (node?.parentElement && node.parentElement !== document.body) node = node.parentElement;
  return node?.parentElement === document.body ? node : null;
}

// Sets `inert` on every other child of <body> and returns the ones it set (the ones already inert stay).
function makeBackgroundInert(root) {
  const own = bodyChildOf(root);
  const siblings = [...document.body.children].filter((el) => el !== own && !el.hasAttribute("inert"));
  siblings.forEach((el) => el.setAttribute("inert", ""));
  return siblings;
}

function lockScroll() {
  if (!scrollLock) scrollLock = { overflow: document.body.style.overflow };
  document.body.style.overflow = "hidden";
}

function unlockScroll() {
  if (stack.length || !scrollLock) return;
  document.body.style.overflow = scrollLock.overflow;
  scrollLock = null;
}

// Tab from the last element goes to the first, Shift+Tab from the first to the last; focus outside comes back in.
function cycle(event, root) {
  const items = focusableIn(root);
  if (!items.length) {
    event.preventDefault();
    root.focus();
    return;
  }
  const active = document.activeElement;
  const outside = !root.contains(active);
  if (event.shiftKey && (outside || active === items[0])) {
    event.preventDefault();
    items.at(-1).focus();
  } else if (!event.shiftKey && (outside || active === items.at(-1))) {
    event.preventDefault();
    items[0].focus();
  }
}

const isForeignOverlay = (target, root) =>
  target instanceof Element && target !== document.body && !root.contains(target);

// Keys from an overlay teleported to <body> on top of the trap (a fullscreen editor, a legacy modal) are its own.
function onKeydown(event) {
  const trap = stack.at(-1);
  if (!trap || isForeignOverlay(event.target, trap.root)) return;
  if (event.key === "Tab") cycle(event, trap.root);
  if (event.key === "Escape" && trap.onEscape) {
    event.stopPropagation();
    trap.onEscape(event);
  }
}

// A dialog with a form starts in its first editable field (a checkbox, radio or read-only value is no start);
// Close is the fallback, not the first stop.
const FIELD = [
  "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([readonly])",
  "textarea:not([readonly])",
  "select",
  "[role='combobox']",
].join(", ");

function initialTarget(root, initialFocus) {
  const stops = focusableIn(root);
  return toValue(initialFocus) ?? stops.find((el) => el.matches(FIELD)) ?? stops[0] ?? root;
}

export function useFocusTrap(container, { active, initialFocus = null, onEscape = null } = {}) {
  let trap = null;

  function activate() {
    const root = toValue(container);
    if (trap || !root) return;
    trap = { root, onEscape, opener: document.activeElement, inert: makeBackgroundInert(root) };
    if (!stack.length) document.addEventListener("keydown", onKeydown);
    stack.push(trap);
    lockScroll();
    initialTarget(root, initialFocus).focus();
  }

  // A trap closed under another one hands its inert set to the one above and leaves focus where it is.
  function deactivate() {
    if (!trap) return;
    const released = trap;
    trap = null;
    const at = stack.indexOf(released);
    stack.splice(at, 1);
    const above = stack[at];
    if (above) above.inert.push(...released.inert);
    else released.inert.forEach((el) => el.removeAttribute("inert"));
    if (!stack.length) document.removeEventListener("keydown", onKeydown);
    unlockScroll();
    if (!above && released.opener?.isConnected) released.opener.focus();
  }

  watch(
    () => toValue(active),
    (on) => (on ? nextTick(activate) : deactivate()),
    { immediate: true }
  );
  onBeforeUnmount(deactivate);

  return { activate, deactivate };
}
