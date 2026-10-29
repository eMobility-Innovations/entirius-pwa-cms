// @vitest-environment node
// Node, not happy-dom: the audit script resolves its files from import.meta.url, a file: URL only under node.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { extractInputs } from "../../../scripts/audit/inputs-sfc.mjs";
import { catalogOf, matchPath, operationFields } from "../../../scripts/audit/inputs-api.mjs";
import { classify, mismatches } from "../../../scripts/audit/inputs-classify.mjs";
import { candidateNames, panelOf } from "../../../scripts/audit/inputs.mjs";

const fixture = readFileSync(new URL("./fixtures/inputs/ProductForm.vue", import.meta.url), "utf8");
const messages = { pim: { price: "Net price", ean: "EAN" } };
const { inputs, imports, required } = extractInputs(fixture, messages);
const byModel = (model) => inputs.find((input) => input.model === model);

const DECIMAL = "^(?!^[-+.]*$)[+-]?0*\\d*\\.?\\d*$";
const schema = {
  paths: {
    "/api/pim/v2/admin/{channel_idx}/products/": { get: { parameters: [{ in: "query", name: "search", schema: { type: "string" } }] } },
    "/api/pim/v2/admin/{channel_idx}/products/{sku}/": {
      patch: { requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/PatchedProduct" } } } } },
    },
  },
  components: {
    schemas: {
      PatchedProduct: {
        properties: {
          value: { anyOf: [{ type: "string", pattern: DECIMAL }, { type: "null" }], examples: ["95.00"] },
          ean: { type: "string", maxLength: 16 },
          attrs: { $ref: "#/components/schemas/Attrs" },
        },
      },
      Attrs: { properties: { qty: { type: "integer", minimum: 0, maximum: 100000 } } },
    },
  },
};

describe("input audit — SFC extraction", () => {
  it("finds every text/number input, native checkboxes left out, kebab-case tags named", () => {
    expect(inputs.map((i) => [i.line, i.component, i.model])).toEqual([
      [4, "BasicInput", "form.price_net"],
      [7, "NumberInput", "form.qty"],
      [10, "BasicInput", "form.ean"],
      [12, "BasicTextarea", "form.description_t9n[lang]"],
      [13, "input", "search"],
    ]);
  });

  it("takes the label from the FormField (i18n resolved), else the placeholder", () => {
    expect(byModel("form.price_net").label).toEqual({ text: "Net price", key: "pim.price" });
    expect(byModel("form.qty").label).toEqual({ text: "Stock", key: null });
    expect(byModel("form.description_t9n[lang]").placeholder).toEqual({ text: null, key: "pim.description" });
    expect(byModel("search").placeholder).toEqual({ text: "Search", key: null });
  });

  it("records the constraints today: native props, NumberInput defaults, required and server errors", () => {
    expect(byModel("form.ean").constraints).toEqual({ maxlength: "14", inputmode: "numeric" });
    expect(byModel("form.qty").constraints).toEqual({ max: "{500}", min: "0 (default)", step: "1 (default)", decimals: 0 });
    expect(byModel("form.price_net")).toMatchObject({ required: true, serverErrors: "value" });
    expect(required).toEqual(["ean"]);
  });

  it("reads a literal bound step and a bound false flag; a step from a variable leaves the places unknown", () => {
    const sfc = (body) => extractInputs(`<template><div>${body}</div></template>`).inputs[0];
    expect(sfc('<NumberInput v-model="a.b" :step="0.01" />').constraints.decimals).toBe(2);
    expect(sfc('<NumberInput v-model="a.b" :step="stepOf(x)" />').constraints.decimals).toBeUndefined();
    expect(sfc('<FormField label="X" :required="false"><BasicInput v-model="a.b" /></FormField>').required).toBe(false);
    expect(sfc('<BasicInput v-model="a.b" :readonly="true" />').constraints.readonly).toBe("true");
  });

  it("reads the imported api functions and the payload keys a model is copied into", () => {
    expect(imports).toEqual([{ name: "PATCH_Product", module: "pim" }, { name: "GET_Products", module: "pim" }]);
    expect(byModel("form.price_net").payloadKeys).toEqual(["value"]);
    expect(byModel("form.ean").payloadKeys).toEqual([]);
  });
});

describe("input audit — API side and join", () => {
  const catalog = catalogOf(readFileSync(new URL("../../../src/api/pim/api.js", import.meta.url), "utf8"));

  it("resolves an api function to its OpenAPI path", () => {
    expect(catalog.PATCH_Product).toEqual({ method: "patch", path: "/api/pim/v2/admin/{}/products/{}/" });
    expect(matchPath(catalog.PATCH_Product.path, "patch", schema)).toBe("/api/pim/v2/admin/{channel_idx}/products/{sku}/");
    const siblings = { paths: { "/x/export/": { get: {} }, "/x/{id}/": { get: {}, patch: {} } } };
    expect(matchPath("/x/{}/", "get", siblings)).toBe("/x/{id}/");
    expect(matchPath("/x/export/", "patch", siblings)).toBe("/x/{id}/");
  });

  it("flattens the request body, nested objects included, with decimal places derived", () => {
    const fields = operationFields(schema, "/api/pim/v2/admin/{channel_idx}/products/{sku}/", "patch");
    expect(fields.map((f) => f.path)).toEqual(["value", "ean", "attrs", "attrs.qty"]);
    expect(fields[0].constraint).toMatchObject({ type: "string", format: "decimal", places: 2 });
    expect(operationFields(schema, "/api/pim/v2/admin/{channel_idx}/products/", "get").map((f) => f.name)).toEqual(["search"]);
  });

  it("joins through the last segment and the payload keys; a per-language dict is its own field", () => {
    expect(candidateNames(byModel("form.price_net"))).toEqual(["price_net", "value"]);
    expect(candidateNames(byModel("form.description_t9n[lang]"))).toEqual(["description_t9n"]);
    expect(candidateNames({ model: "values[cell.id]", payloadKeys: [] })).toEqual([]);
    expect(candidateNames({ model: "getDirtyField(rowKey(row), 'special_value', x)", payloadKeys: [] })).toEqual(["special_value"]);
  });

  it("names the panel of a file", () => {
    expect(panelOf("src/views/Pim/components/AttributeField.vue")).toBe("Pim");
    expect(panelOf("src/views/Gallery.vue")).toBe("Gallery");
    expect(panelOf("src/components/lookup/CandidateRow.vue")).toBe("components/lookup");
  });
});

describe("input audit — classification and mismatches", () => {
  const fields = operationFields(schema, "/api/pim/v2/admin/{channel_idx}/products/{sku}/", "patch");
  const api = (path) => fields.find((f) => f.path === path).constraint;

  it("a decimal price in a free-text input: money, not enforced, shown unlike stored", () => {
    const price = byModel("form.price_net");
    expect(classify(price, "value", api("value"))).toBe("money");
    expect(mismatches(price, "money", api("value")).map((m) => m.kind)).toEqual(["api-only", "display-format"]);
  });

  it("a price with the money format (plan 61): no free-text or display mismatch left", () => {
    const price = byModel("form.price_net");
    const formatted = { ...price, constraints: { ...price.constraints, format: "money" } };
    expect(classify(formatted, "value", api("value"))).toBe("money");
    expect(mismatches(formatted, "money", api("value"))).toEqual([]);
    const key = { ...price, constraints: { format: "key" } };
    expect(classify(key, "value", {})).toBe("sku");
  });

  it("an EAN whose maxlength differs from the API; a stepper whose range differs", () => {
    expect(classify(byModel("form.ean"), "ean", api("ean"))).toBe("ean");
    expect(mismatches(byModel("form.ean"), "ean", api("ean"))).toEqual([{ kind: "cms-different", detail: "maxlength 14 vs API 16" }]);
    expect(mismatches(byModel("form.qty"), "integer", api("attrs.qty"))).toEqual([]);
  });

  it("classifies a camelCase model by its words", () => {
    expect(classify({ model: "form.priceNet", component: "BasicInput", constraints: {} })).toBe("money");
  });

  it("no API field, no mismatch; a search box is free text", () => {
    expect(mismatches(byModel("search"), "free text", undefined)).toEqual([]);
    expect(classify(byModel("search"), "search", { type: "string" })).toBe("free text");
  });
});
