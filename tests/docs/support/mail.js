const net = require("net");

// The mail sandbox of the dev stack (GreenMail) has no inject endpoint: a mail is placed in a mailbox with IMAP
// APPEND, as if it had been received. Authentication is off there, so a user's password is its login.
const HOST = "localhost";
const PORT = Number(process.env.GREENMAIL_IMAP_PORT || 3243);
const TIMEOUT_MS = 10000;
const CRLF = "\r\n";

// The commands of one APPEND session: each is sent once the server has answered the previous one with `until`.
const session = (eml, user, folder) => [
  { until: /^\* OK/m },
  { send: `a1 LOGIN ${user} ${user}${CRLF}`, until: /^a1 OK/m, tag: "a1" },
  { send: `a2 APPEND ${folder} {${eml.length}}${CRLF}`, until: /^\+/m, tag: "a2" },
  { send: Buffer.concat([eml, Buffer.from(CRLF)]), until: /^a2 OK/m, tag: "a2" },
];

const refused = (reply, tag) => tag && new RegExp(`^${tag} (NO|BAD)`, "m").test(reply);

// Walks the session on every chunk the server sends; throws on a refused command.
function advance(socket, steps, state) {
  const step = steps[state.at];
  if (refused(state.reply, step.tag)) throw new Error(`IMAP APPEND refused: ${state.reply.trim()}`);
  if (!step.until.test(state.reply)) return false;
  state.reply = "";
  state.at += 1;
  if (state.at === steps.length) return true;
  socket.write(steps[state.at].send);
  return false;
}

/**
 * Places raw RFC 5322 bytes in a folder of the sandbox mailbox.
 * @param {Buffer} eml the mail, headers and body
 * @param {{ user?: string, folder?: string }} [options]
 * @returns {Promise<void>} rejects when the server refuses a command or does not answer
 */
function appendMail(eml, { user = "sandbox", folder = "INBOX" } = {}) {
  const steps = session(eml, user, folder);
  const state = { at: 0, reply: "" };
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: HOST, port: PORT });
    const fail = (error) => {
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(TIMEOUT_MS, () => fail(new Error(`INFRA: no IMAP answer from ${HOST}:${PORT} (make mail)`)));
    socket.on("error", (error) => reject(new Error(`INFRA: IMAP ${HOST}:${PORT}: ${error.message} (make mail)`)));
    socket.on("data", (chunk) => {
      state.reply += chunk.toString("latin1");
      try {
        if (advance(socket, steps, state)) socket.end(`a3 LOGOUT${CRLF}`, resolve);
      } catch (error) {
        fail(error);
      }
    });
  });
}

module.exports = { appendMail };
