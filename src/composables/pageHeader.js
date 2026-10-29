import { computed, inject, onBeforeUnmount, onMounted, watch } from "vue";

// The shell's page-header slot (R2): the shell (ShellPageHeader) provides `{ claim, release, crumbs?, back?, title? }`
// under PAGE_HEADER_CLAIM and hides its fallback header while a PageHeader holds a claim. Claims can overlap during a
// route change (the next page mounts before the last one unmounts), so the provider counts them. `crumbs` is a ref of
// the route's `[{ label, to? }]`, `back` goes to the parent crumb, `title` is a ref the page's title is written to
// (the last crumb and `document.title` read it).
export const PAGE_HEADER_CLAIM = Symbol("pageHeaderClaim");

// Claims the slot on mount and releases it on unmount, and reports `title` (a getter); returns the shell's crumbs
// ([] without a provider) and its back action (null without one). `enabled` false stays out of the shell: a demo
// instance (the UI catalogue) acts as if there were no provider.
export function usePageHeaderClaim(title = () => "", enabled = true) {
  const shell = enabled ? inject(PAGE_HEADER_CLAIM, null) : null;
  onMounted(() => shell?.claim());
  onBeforeUnmount(() => shell?.release());
  if (shell?.title) watch(title, (value) => (shell.title.value = value), { immediate: true });
  return { crumbs: computed(() => shell?.crumbs?.value ?? []), back: shell?.back ?? null };
}
