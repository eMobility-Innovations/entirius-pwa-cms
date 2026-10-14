import { getLang } from "@/i18n";
import { GET_Fields, GET_Languages } from "@/api/enrichment/api";

// The writable fields and the languages of one channel (contract A3 § 2), named in the UI language. Loaded once per
// channel and page session, shared by the run dialog, the templates editor and the tag cards. A module without a
// catalog (404) or a failed call gives empty lists and is asked again next time.

const MODULE = "pim";
const cache = new Map();

async function fetchCatalog(channel) {
  const query = { target_module: MODULE, channel };
  const [fields, languages] = await Promise.all([
    GET_Fields({ ...query, language: getLang().toLowerCase() }),
    GET_Languages(query),
  ]);
  return { fields: fields.data || [], languages: languages.data || [] };
}

/** { fields: [{ key, label, type, max_length?, translatable, options? }], languages: ["pl", …] } of a channel. */
export function loadCatalog(channel) {
  if (!channel) return Promise.resolve({ fields: [], languages: [] });
  if (!cache.has(channel)) {
    const pending = fetchCatalog(channel).catch(() => {
      cache.delete(channel);
      return { fields: [], languages: [] };
    });
    cache.set(channel, pending);
  }
  return cache.get(channel);
}

/** Test seam: forget every loaded channel. */
export function resetCatalog() {
  cache.clear();
}

// The field types each kind of work writes; kinds without a field choice are absent.
const FIELD_TYPES = {
  write: ["text", "html"],
  translate: ["text", "html"],
  pick: ["select", "multiselect"],
};

/** The catalog fields a kind of work can take, as select options. */
export function fieldOptions(fields, kind) {
  const types = FIELD_TYPES[kind] || [];
  return fields.filter((field) => types.includes(field.type)).map((field) => ({ label: field.label, value: field.key }));
}

/** The label of option `value` of field `key`, else the value itself. */
export function optionLabel(fields, key, value) {
  const field = fields.find((f) => f.key === key);
  return field?.options?.find((option) => option.value === value)?.label || value;
}
