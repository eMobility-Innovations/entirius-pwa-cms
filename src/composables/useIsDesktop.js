import { useMediaQuery } from "@/composables/useMediaQuery";
import { SHELL_QUERY } from "@/utils/breakpoints";

// The shell breakpoint: sidebar layout, `desktopOnly` nav entries and the Leads desktop screens (plan 14) from here up.
export function useIsDesktop() {
  return useMediaQuery(SHELL_QUERY, true);
}
