import { describe, it, expect } from "vitest";
import { FEATURE_TYPES, featureTypeTone } from "@/views/Pim/helpers/pimEnums";

describe("featureTypeTone", () => {
  it("reads the tone of the FEATURE_TYPES entry", () => {
    const tone = (key) => featureTypeTone(FEATURE_TYPES.find((t) => t.key === key).value);
    expect(["select", "multiselect"].map(tone)).toEqual(["accent", "accent"]);
    expect(["decimal", "temperature", "length", "mass"].map(tone)).toEqual(Array(4).fill("negative"));
    expect([tone("bool"), tone("datetime"), tone("varchar")]).toEqual(["positive", "warning", "neutral"]);
  });

  it("an unknown type is neutral", () => {
    expect(featureTypeTone(99)).toBe("neutral");
  });
});
