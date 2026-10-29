import { t } from "@/i18n";

// The link targets of a navigation item, a megamenu link and a banner button (the Edit* modals' BasicRadioGroup).
export function linkTypeOptions() {
  return [
    { label: t("layout_extender.category"), value: "category" },
    { label: t("layout_extender.content_page"), value: "page" },
    { label: t("layout_extender.url"), value: "url" },
  ];
}
