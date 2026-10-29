// The script side of the breakpoints in assets/scss/utils/_media-query.scss (a unit test holds both to one value).
// `$breakpoint-mobile`: `max-tablet` is MAX_TABLET_QUERY.
export const BREAKPOINT_MOBILE = 768;
export const MAX_TABLET_QUERY = `(max-width: ${BREAKPOINT_MOBILE}px)`;
// `$breakpoint-shell` (r05 decision 3): the sidebar shell from here up, header menu + tab bar below.
export const SHELL_BREAKPOINT = 1024;
export const SHELL_QUERY = `(min-width: ${SHELL_BREAKPOINT}px)`;
