import { defineAsyncComponent } from "vue";

// Everything the login wall renders on its first paint is registered synchronously: as async chunks the auth card
// showed its headings first and the fields popped in a round trip later, or never after a redeploy 404.
import BasicButton from "./BasicButton/index.vue";
import BasicInput from "./BasicInput/index.vue";
import BasicLogo from "./BasicLogo/index.vue";
import FormField from "./FormField/index.vue";
import IconButton from "./IconButton/index.vue";

// Per-plan slots (dev-plans § Streams): a P3/P4 plan registers its new boots under its own anchor only; the anchors
// keep their order and a blank line around each, so two streams never edit the same lines.
export default function registerBootComponents(app) {
  app.component("BasicButton", BasicButton);
  app.component("BasicInput", BasicInput);
  app.component("BasicLogo", BasicLogo);
  app.component("FormField", FormField);
  app.component("IconButton", IconButton);
  app.component("BasicSwiper", defineAsyncComponent(() => import("./BasicSwiper/index.vue")));
  app.component("BasicCheckbox", defineAsyncComponent(() => import("./BasicCheckbox/index.vue")));
  app.component("BasicImage", defineAsyncComponent(() => import("./BasicImage/index.vue")));
  app.component("ColorInput", defineAsyncComponent(() => import("./ColorInput/index.vue")));
  app.component("NumberInput", defineAsyncComponent(() => import("./NumberInput/index.vue")));
  app.component("BasicWysiwyg", defineAsyncComponent(() => import("./BasicWysiwyg/index.vue")));
  app.component("BasicDatePicker", defineAsyncComponent(() => import("./BasicDatePicker/index.vue")));
  app.component("BasicTabs", defineAsyncComponent(() => import("./BasicTabs/index.vue")));
  app.component("StanceSwitcher", defineAsyncComponent(() => import("./StanceSwitcher/index.vue")));
  app.component("NoticeMe", defineAsyncComponent(() => import("./NoticeMe/index.vue")));
  app.component("DataTable", defineAsyncComponent(() => import("./DataTable/index.vue")));
  app.component("Loader", defineAsyncComponent(() => import("./Loader/index.vue")));
  app.component("Pagination", defineAsyncComponent(() => import("./Pagination/index.vue")));
  app.component("SubscriberSetter", defineAsyncComponent(() => import("./SubscriberSetter/index.vue")));
  app.component("FloatingActions", defineAsyncComponent(() => import("./FloatingActions/index.vue")));
  app.component("MobileFilterPanel", defineAsyncComponent(() => import("./MobileFilterPanel/index.vue")));
  app.component("StatusBadge", defineAsyncComponent(() => import("./StatusBadge/index.vue")));
  app.component("FilterChip", defineAsyncComponent(() => import("./FilterChip/index.vue")));
  app.component("SegmentedControl", defineAsyncComponent(() => import("./SegmentedControl/index.vue")));
  app.component("SideDrawer", defineAsyncComponent(() => import("./SideDrawer/index.vue")));
  app.component("TranslationsDrawer", defineAsyncComponent(() => import("./TranslationsDrawer/index.vue")));
  app.component("EntitySearchPicker", defineAsyncComponent(() => import("./EntitySearchPicker/index.vue")));
  app.component("EmptyState", defineAsyncComponent(() => import("./EmptyState/index.vue")));
  app.component("ChannelMultiSelect", defineAsyncComponent(() => import("./ChannelMultiSelect/index.vue")));
  app.component("BulkActionBar", defineAsyncComponent(() => import("./BulkActionBar/index.vue")));

  // P3 icons

  // P3 actions (plan 11)
  app.component("ActionBar", defineAsyncComponent(() => import("./ActionBar/index.vue")));

  // P3 overlays (plan 12)
  app.component("BasicModal", defineAsyncComponent(() => import("./BasicModal/index.vue")));
  app.component("ConfirmDialog", defineAsyncComponent(() => import("./ConfirmDialog/index.vue")));
  app.component("BasicMenu", defineAsyncComponent(() => import("./BasicMenu/index.vue")));
  app.component("BasicTooltip", defineAsyncComponent(() => import("./BasicTooltip/index.vue")));

  // P3 display (plan 13)
  app.component("CountBadge", defineAsyncComponent(() => import("./CountBadge/index.vue")));
  app.component("Tag", defineAsyncComponent(() => import("./Tag/index.vue")));
  app.component("BasicCard", defineAsyncComponent(() => import("./BasicCard/index.vue")));
  app.component("PanelCard", defineAsyncComponent(() => import("./PanelCard/index.vue")));
  app.component("MediaTile", defineAsyncComponent(() => import("./MediaTile/index.vue")));

  // P3 page frame (plan 14)
  app.component("PageLayout", defineAsyncComponent(() => import("./PageLayout/index.vue")));
  app.component("PageHeader", defineAsyncComponent(() => import("./PageHeader/index.vue")));
  app.component("Breadcrumbs", defineAsyncComponent(() => import("./Breadcrumbs/index.vue")));

  // P3 selects (plan 15)
  app.component("BasicSelect", defineAsyncComponent(() => import("./BasicSelect/index.vue")));

  // P3 inputs (plan 16)
  app.component("BasicTextarea", defineAsyncComponent(() => import("./BasicTextarea/index.vue")));
  app.component("BasicSwitch", defineAsyncComponent(() => import("./BasicSwitch/index.vue")));
  app.component("BasicRadioGroup", defineAsyncComponent(() => import("./BasicRadioGroup/index.vue")));

  // P4 shell (plan 21)
  app.component("AppHeader", defineAsyncComponent(() => import("./AppHeader/index.vue")));
  app.component("SidebarNav", defineAsyncComponent(() => import("./SidebarNav/index.vue")));
  app.component("SidebarNavGroup", defineAsyncComponent(() => import("./SidebarNav/SidebarNavGroup.vue")));
  app.component("SidebarNavItem", defineAsyncComponent(() => import("./SidebarNav/SidebarNavItem.vue")));
  app.component("MobileMenu", defineAsyncComponent(() => import("./MobileMenu/index.vue")));
  app.component("BottomTabBar", defineAsyncComponent(() => import("./BottomTabBar/index.vue")));
  app.component("UserMenu", defineAsyncComponent(() => import("./UserMenu/index.vue")));

  // Access panel (access plan 20)
  app.component("PermissionMatrix", defineAsyncComponent(() => import("./PermissionMatrix/index.vue")));

  // Access tokens (access plan 22)
  app.component("SecretReveal", defineAsyncComponent(() => import("./SecretReveal/index.vue")));

}
