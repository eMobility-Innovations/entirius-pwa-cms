// Brand values (--brand-*) and the fallback font faces; loaded before the theme styles in App.vue.
import "@entirius/brand-tokens/tokens.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import registerBootComponents from "./boots/register-elems";
import registerConfigComponents from "./configs/builder/components/register-elems";
import registerFontAwesome from "./boots/Icons/fa-icons";

import i18n from "./i18n";
import { out } from "./utils/directives/out";
import { ripple_effect } from "./utils/directives/ripple";

// Import external libraries (framework agnostic)
import Swiper from "swiper";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css"
import "swiper/css/bundle";

// Create Vue 3 app
const app = createApp(App);
const pinia = createPinia();

// Use plugins
app.use(pinia);
app.use(router);
app.use(i18n);

// Register global directives
app.directive("out", out);
app.directive("ripple-effect", ripple_effect);

// Register global components
registerBootComponents(app);
registerConfigComponents(app);
registerFontAwesome(app);

// Mount app
app.mount("#app");
