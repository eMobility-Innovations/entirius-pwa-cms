import { describe, it, expect } from "vitest";
import { applyPolicy, capReached, channelTimeZone, formatDayTime, formatTime, sendState } from "@/utils/leadsTime";

const at = (hhmm) => new Date(`2026-09-15T${hhmm}:00Z`).getTime();

describe("one date/time format everywhere (24 h, the channel's timezone, with a day when it is not today)", () => {
  const now = new Date("2026-09-15T12:00:00Z");

  it("today is a bare 24 h time in the channel time zone", () => {
    channelTimeZone.value = "Europe/Warsaw";
    expect(formatTime("2026-09-15T21:46:00Z", now)).toBe("23:46");
  });

  it("another day in the channel time zone carries DD.MM", () => {
    channelTimeZone.value = "Europe/Warsaw";
    expect(formatTime("2026-09-15T22:30:00Z", now)).toBe("16.09 00:30");
    expect(formatTime("2026-09-14T06:00:00Z", now)).toBe("14.09 08:00");
  });

  it("a missing timestamp is empty", () => {
    expect(formatTime("", now)).toBe("");
  });

  it("the day-and-time form carries DD.MM today too", () => {
    channelTimeZone.value = "UTC";
    expect(formatDayTime(new Date().toISOString())).toMatch(/^\d\d\.\d\d \d\d:\d\d$/);
    expect(formatDayTime("")).toBe("");
    channelTimeZone.value = undefined;
  });
});

// FIX-17a items 2-4: a waiting mail names an hour only when that hour is the slot the backend will use.
describe("sendState — a state, never a clock that slides forward", () => {
  const now = at("09:08");

  it("a slot in the future is the one promise worth making", () => {
    channelTimeZone.value = "UTC";
    expect(sendState("2026-09-15T14:00:00Z", now)).toEqual({ state: "at", time: "14:00" });
    channelTimeZone.value = undefined;
  });

  it("a slot at the current minute is due — the window is open, the send run owes it", () => {
    expect(sendState("2026-09-15T09:08:00Z", now)).toEqual({ state: "due" });
    expect(sendState("2026-09-15T09:00:00Z", now)).toEqual({ state: "due" });
  });

  it("with today's cap used up no clock is promised, whatever the slot says", () => {
    applyPolicy({ timezone: "UTC", sent_today: 10, daily_cap: 10 });
    expect(capReached.value).toBe(true);
    expect(sendState("", now)).toEqual({ state: "cap", next: "" });
    applyPolicy(null);
    expect(capReached.value).toBe(false);
    channelTimeZone.value = undefined;
  });

  it("no slot at all means the policy has no open moment ahead", () => {
    expect(sendState("", now)).toEqual({ state: "held", window: "", next: "" });
  });

  // FIX-17b item 12: the cap wins over a clock even for a slot of the same channel day; FIX-17d item 2: the capped
  // mail still names the backend's next slot, today or not.
  it("with the cap used up the mail names its next slot, today or later", () => {
    applyPolicy({ timezone: "UTC", sent_today: 3, daily_cap: 3, windows: [{ start_time: "08:00:00", end_time: "17:00:00" }] });
    expect(sendState("2026-09-15T14:00:00Z", now)).toEqual({ state: "cap", next: "14:00" });
    expect(sendState("2026-09-16T08:00:00Z", now)).toEqual({ state: "cap", next: "16.09 08:00" });
    applyPolicy(null);
  });

  // FIX-17b item 14: a closed window names its hours instead of a clock, with or without a slot.
  it("a closed window says it waits for the window and names the hours", () => {
    applyPolicy({ timezone: "UTC", sent_today: 0, daily_cap: 10, windows: [{ start_time: "08:00:00", end_time: "17:00:00" }] });
    expect(sendState("2026-09-16T08:00:00Z", at("22:00"))).toEqual({ state: "held", window: "08:00–17:00", next: "16.09 08:00" });
    expect(sendState("", at("22:00"))).toEqual({ state: "held", window: "08:00–17:00", next: "" });
    expect(sendState("2026-09-15T14:00:00Z", now)).toEqual({ state: "at", time: "14:00" });
    applyPolicy(null);
  });
});
