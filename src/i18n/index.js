import { reactive } from "vue";
import en from "./locales/en.json";
import pl from "./locales/pl.json";

const messages = { EN: en, PL: pl };
const INTL_LOCALES = { EN: "en-GB", PL: "pl-PL" };

const state = reactive({ lang: (process.env.VUE_APP_LANG || "EN").toUpperCase() });

// `<html lang>` follows the UI language (screen readers pick the voice from it).
const applyDocumentLang = () => document.documentElement.setAttribute("lang", state.lang.toLowerCase());
applyDocumentLang();

export function setLang(l) {
  state.lang = l.toUpperCase();
  applyDocumentLang();
}

export function getLang() {
  return state.lang;
}

// The Intl locale of the UI language: dates and numbers follow the language switch, never the browser locale.
export function uiLocale() {
  return INTL_LOCALES[state.lang] || INTL_LOCALES.EN;
}

function resolve(obj, key) {
  return key.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

export function t(key, params) {
  const locale = messages[state.lang] || messages.EN;
  let val = resolve(locale, key);
  if (val === undefined && state.lang !== "EN") {
    val = resolve(messages.EN, key);
  }
  if (val === undefined) return key;
  if (params) {
    return val.replace(/\{(\w+)\}/g, (_, name) => params[name] !== undefined ? params[name] : `{${name}}`);
  }
  return val;
}

export default {
  install(app) {
    app.config.globalProperties.$t = t;
  },
};
