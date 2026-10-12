const fs = require("fs");
const os = require("os");
const path = require("path");
const { test, expect, guide, goto } = require("../support/capture");
const { appendMail } = require("../support/mail");
const { api } = require("./helpers");

// Guide "Leads": a company from a CSV import to an answered mail. Import, Pipeline, the draft in the Inbox, Review,
// the sent mail in the company thread, the reply in the Inbox and in the thread. Desktop only: Import and the
// Pipeline have no phone layout.
//
// The spec waits for elements and statuses, never for the text of a mail. What a button cannot do in a capture is
// done through the API, with the development-only test endpoints of the dev stack: the upload is answered by
// `test/import-now/`, the draft comes from `test/communicate/` (the seeded `followup` template), the mail leaves
// through the channel clock and one send run, the reply is appended to the sandbox mailbox (`make mail`) and read
// by one poll. The import takes a domain only under a public suffix or `.test`, so the company's is `.test`.
//
// Nothing here can be undone: every run leaves the company Harbour Furniture with one contact, one thread, one sent
// mail and one reply, and skips the drafts that waited for review. With the company already there the spec fails
// with `INFRA: leads needs a fresh make seed`. The send policy is opened for the whole day and restored at the end.
const { shot } = guide("leads");

const CHANNEL = "default-europe";
const LEADS = `api/leads/v2/admin/${CHANNEL}/`;
const COMMUNICATOR = `api/communicator/v2/admin/${CHANNEL}/`;
const POLICY = `${COMMUNICATOR}policy/`;
const REVIEW = `${COMMUNICATOR}review/`;
const MESSAGES = `${COMMUNICATOR}messages/`;
const COMMUNICATE = `${COMMUNICATOR}test/communicate/`;
const CLOCK = `${COMMUNICATOR}test/clock/`;
const SEND_DUE = `${COMMUNICATOR}test/send-due/`;
const POLL_NOW = `${COMMUNICATOR}test/poll-now/`;

const COMPANY = "Harbour Furniture";
const DOMAIN = "harbour-furniture.test";
const CONTACT = { first: "Alex", last: "Reader", email: `alex@${DOMAIN}` };
const CSV_HEADER =
  "company_name,domain,website,lead_type,industry,first_name,last_name,email,job_title,language,legal_basis,phone";
const CSV_ROW = `${COMPANY},${DOMAIN},,RETAILER,furniture,${CONTACT.first},${CONTACT.last},${CONTACT.email},Owner,en,legitimate_interest,`;
const LEGAL_FOOTER = "Data controller: Example Seller Ltd, 1 Test Street, Station City.";
const REPLY_TEXT = "can we talk on Thursday";
const OPEN_POLICY = { business_days_only: false, daily_cap: 1000, windows: [{ start_time: "00:00", end_time: "23:59" }] };
const POLICY_FIELDS = ["business_days_only", "daily_cap", "spread", "windows"];
const READY_MS = 30000;

const tid = (id) => `[data-testid="${id}"]`;
const CARD = `${tid("board-column")}[data-stage="new"] ${tid("board-card")}[data-company="${DOMAIN}"]`;
const INBOX_ROW = `${tid("inbox-item")}:has-text("${COMPANY}")`;
const SENT = `${tid("timeline-out")}:has(${tid("status-sent")})`;
const REPLY = `${tid("timeline-in")}:has-text("${REPLY_TEXT}")`;

const companies = async (page) => (await api(page, "GET", `${LEADS}companies/?search=${DOMAIN}`)).results;

async function assertFreshSeed(page) {
  if ((await companies(page)).length) throw new Error("INFRA: leads needs a fresh make seed");
}

// Drafts are due the moment they are accepted; returns the policy to put back.
async function openSendPolicy(page) {
  const policy = await api(page, "GET", POLICY);
  const original = Object.fromEntries(POLICY_FIELDS.map((field) => [field, policy[field]]));
  await api(page, "PUT", POLICY, { ...original, ...OPEN_POLICY });
  return original;
}

// The Inbox shows this run's draft only.
async function clearReviewQueue(page) {
  const waiting = await api(page, "GET", `${REVIEW}?status=review_required&page_size=100`);
  for (const draft of waiting.results) await api(page, "POST", `${REVIEW}${draft.id}/skip/`, { reason: "docs capture" });
}

function writeCsv() {
  const file = path.join(os.tmpdir(), `docs-leads-${Date.now()}.csv`);
  fs.writeFileSync(file, `${CSV_HEADER}\n${CSV_ROW}\n`);
  return file;
}

// The dev stack shares no import folder between the service and its worker, so a queued upload never finds its
// file: the upload is answered by the development endpoint that imports at once (same multipart body).
const importNow = (route) =>
  route.request().method() === "POST"
    ? route.continue({ url: route.request().url().replace("/imports/", "/test/import-now/") })
    : route.continue();

const draftBody = (company) => ({
  template_key: "followup",
  recipient: { email: CONTACT.email, first_name: CONTACT.first, language: "en", legal_footer: LEGAL_FOOTER },
  context: { company_name: company.name, body: "Docs capture draft.", hooks: company.hooks, platform: company.platform },
  subject_ref: `leads.Company:${company.id}`,
  requires_review: true,
});

const byId = (list, id) => list.results.find((message) => message.id === id);

// One send run with the channel clock on the message's slot; returns the sent message.
async function sendDue(page, draft) {
  const approved = byId(await api(page, "GET", `${REVIEW}?status=approved&page_size=100`), draft.id);
  const slot = approved?.scheduled_at || (await api(page, "GET", POLICY)).next_slot;
  await api(page, "POST", CLOCK, { iso_datetime: slot });
  try {
    await api(page, "POST", SEND_DUE, {});
  } finally {
    await api(page, "POST", CLOCK, { iso_datetime: null });
  }
  const sent = byId(await api(page, "GET", `${MESSAGES}?status=sent&page_size=100`), draft.id);
  if (!sent) throw new Error(`message ${draft.id} was not sent`);
  return sent;
}

// The recipient's answer to the sent mail, written one minute after it.
function replyMail(sent) {
  const messageId = sent.message_id.replace(/^<|>$/g, "");
  const lines = [
    `From: ${CONTACT.first} ${CONTACT.last} <${sent.thread.recipient_email}>`,
    "To: Outreach <sandbox@greenmail.test>",
    "Subject: Re: Your message",
    `Date: ${new Date(Date.parse(sent.sent_at) + 60000).toUTCString()}`,
    `Message-ID: <docs-${Date.now()}@inbound.test>`,
    `In-Reply-To: <${messageId}>`,
    `References: <${messageId}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    `Hello,\r\n\r\nthanks for the message. It sounds interesting - ${REPLY_TEXT}?\r\n\r\n${CONTACT.first}`,
    "",
  ];
  return Buffer.from(lines.join("\r\n"));
}

// The import report and a thread's newest bubble open below the fold: the shot is the page scrolled down to them.
const reveal = (page, selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((target) => target.scrollIntoView({ block: "center" }));

async function importCompany(page) {
  await page.route("**/imports/", importNow);
  await goto(page, "/leads/import", { ready: tid("import-upload") });
  await page.getByTestId("import-file").setInputFiles(writeCsv());
  await page.getByTestId("import-upload").click();
  await expect(page.getByTestId("import-status")).toHaveText("done", { timeout: READY_MS });
  await reveal(page, tid("import-report"));
  await shot(page, "01-import", { callouts: [{ target: tid("import-report"), label: "1" }] });
}

async function showPipeline(page) {
  await goto(page, "/leads/board", { ready: tid("board-column") });
  await page.getByTestId("board-search").fill(DOMAIN);
  await page.getByTestId("board-search").press("Enter");
  await page.locator(CARD).waitFor();
  await shot(page, "02-pipeline", { callouts: [{ target: CARD, label: "1" }] });
}

async function draftInInbox(page, company) {
  const draft = await api(page, "POST", COMMUNICATE, draftBody(company));
  await goto(page, "/leads/inbox", { ready: INBOX_ROW });
  await shot(page, "03-inbox-drafts", { callouts: [{ target: INBOX_ROW, label: "1" }] });
  return draft;
}

async function reviewDraft(page) {
  await page.locator(INBOX_ROW).first().click();
  await page.getByTestId("review-subject").waitFor();
  await shot(page, "04-review", {
    callouts: [
      { target: tid("review-subject"), label: "1" },
      { target: tid("review-send"), label: "2" },
    ],
  });
}

const thread = (company) => `/leads/companies/${company.id}?tab=timeline`;

async function sendAndShowThread(page, company, draft) {
  await page.getByTestId("review-send").click();
  await page.getByTestId("review-scheduled").waitFor();
  const sent = await sendDue(page, draft);
  await goto(page, thread(company), { ready: SENT });
  await reveal(page, SENT);
  await shot(page, "05-thread-sent", { callouts: [{ target: SENT, label: "1" }] });
  return sent;
}

async function replyInInbox(page, sent) {
  await appendMail(replyMail(sent));
  await api(page, "POST", POLL_NOW, {});
  await goto(page, "/leads/inbox", { ready: tid("inbox-summary") });
  await page.getByTestId("inbox-filter-replied").click();
  await page.locator(INBOX_ROW).first().waitFor();
  await shot(page, "06-inbox-replies", { callouts: [{ target: INBOX_ROW, label: "1" }] });
}

async function replyInThread(page, company) {
  await goto(page, thread(company), { ready: REPLY });
  await reveal(page, REPLY);
  await shot(page, "07-thread-reply", { callouts: [{ target: REPLY, label: "1" }] });
}

async function funnel(page) {
  await test.step("A CSV import and its report", () => importCompany(page));
  await test.step("The imported company in the first stage of the Pipeline", () => showPipeline(page));
  const [company] = await companies(page);
  const draft = await test.step("A draft under Drafts in the Inbox", () => draftInInbox(page, company));
  await test.step("Review of the draft", () => reviewDraft(page));
  const sent = await test.step("Sent mail in the company thread", () => sendAndShowThread(page, company, draft));
  await test.step("The reply under Replies in the Inbox", () => replyInInbox(page, sent));
  await test.step("The reply in the company thread", () => replyInThread(page, company));
}

test("leads", async ({ page }) => {
  await assertFreshSeed(page);
  await clearReviewQueue(page);
  const policy = await openSendPolicy(page);
  try {
    await funnel(page);
  } finally {
    await api(page, "PUT", POLICY, policy);
  }
});
