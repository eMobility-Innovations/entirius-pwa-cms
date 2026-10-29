// A thread's subject: its first outbound mail, else its first entry (a thread that starts with a reply).
export function threadSubject(timeline = []) {
  return (timeline.find((entry) => entry.direction === "out") || timeline[0])?.subject || "";
}

// Messages waiting for the send beat that belong to one thread.
export function waitingOf(waiting, threadId) {
  return waiting.filter((message) => message.thread?.id === threadId);
}

// A reply's quoted history starts at its first "> " line (with the "On … wrote:" line in front of it, when there is
// one); `own` is what the sender wrote, `quoted` the history a phone keeps folded.
export function splitQuote(text = "") {
  const lines = (text || "").split("\n");
  let start = lines.findIndex((line) => line.trimStart().startsWith(">"));
  if (start < 0) return { own: text || "", quoted: "" };
  if (start > 0 && /:\s*$/.test(lines[start - 1])) start -= 1;
  return { own: lines.slice(0, start).join("\n").trimEnd(), quoted: lines.slice(start).join("\n") };
}
