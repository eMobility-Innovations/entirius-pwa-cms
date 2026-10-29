import { Comment, Fragment, Text } from "vue";

// A v-if that resolves false, or an empty <template>, still gives a slot function a vnode array — a Comment
// placeholder, or a Fragment/Text with nothing in it. `hasSlotContent` tells a real render from that, so a
// container (PageLayout's footer strip) does not show for a slot that renders nothing.
function isEmptyVNode(vnode) {
  if (vnode.type === Comment) return true;
  if (vnode.type === Text) return !String(vnode.children ?? "").trim();
  if (vnode.type === Fragment) {
    const children = vnode.children ?? [];
    return children.length === 0 || children.every(isEmptyVNode);
  }
  return false;
}

export function hasSlotContent(vnodes) {
  return (vnodes ?? []).some((vnode) => !isEmptyVNode(vnode));
}
