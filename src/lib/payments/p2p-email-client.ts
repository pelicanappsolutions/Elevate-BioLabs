import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import { env } from "@/lib/env";

export interface FetchedEmail {
  uid: number;
  messageId: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface P2pEmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  folder: string;
  lookbackHours: number;
  maxPerRun: number;
}

export function getP2pEmailConfig(): P2pEmailConfig | null {
  const cfg = env.p2pEmail;
  if (!cfg.host || !cfg.user || !cfg.password) return null;
  return cfg;
}

export async function fetchRecentP2pEmails(): Promise<FetchedEmail[]> {
  const cfg = getP2pEmailConfig();
  if (!cfg) throw new Error("P2P email IMAP not configured");

  const imap = new Imap({
    host: cfg.host,
    port: cfg.port,
    tls: cfg.port === 993,
    user: cfg.user,
    password: cfg.password,
    tlsOptions: { rejectUnauthorized: true },
  });

  await connect(imap);

  try {
    await openBox(imap, cfg.folder);
    const since = new Date(Date.now() - cfg.lookbackHours * 60 * 60 * 1000);
    const uids = await search(imap, ["SINCE", since]);

    // Most recent first, cap at maxPerRun to stay within serverless limits.
    const recentUids = uids
      .sort((a, b) => b - a)
      .slice(0, cfg.maxPerRun);

    if (recentUids.length === 0) return [];

    const emails: FetchedEmail[] = [];
    for (const uid of recentUids) {
      try {
        const email = await fetchAndParse(imap, uid);
        if (email) emails.push(email);
      } catch (err) {
        // Log and continue so one bad message doesn't kill the whole run.
        // eslint-disable-next-line no-console
        console.error(`[p2p-email] failed to fetch UID ${uid}:`, err);
      }
    }
    return emails;
  } finally {
    imap.end();
  }
}

export async function markEmailSeen(uid: number): Promise<void> {
  return markEmailsSeen([uid]);
}

export async function markEmailsSeen(uids: number[]): Promise<void> {
  const cfg = getP2pEmailConfig();
  if (!cfg || uids.length === 0) return;

  const imap = new Imap({
    host: cfg.host,
    port: cfg.port,
    tls: cfg.port === 993,
    user: cfg.user,
    password: cfg.password,
    tlsOptions: { rejectUnauthorized: true },
  });

  await connect(imap);
  try {
    await openBox(imap, cfg.folder);
    await new Promise<void>((resolve, reject) => {
      imap.addFlags(uids, "\\Seen", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    imap.end();
  }
}

function connect(imap: Imap): Promise<void> {
  return new Promise((resolve, reject) => {
    imap.once("ready", resolve);
    imap.once("error", reject);
    imap.connect();
  });
}

function openBox(imap: Imap, folder: string): Promise<void> {
  return new Promise((resolve, reject) => {
    imap.openBox(folder, false, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function search(imap: Imap, criteria: any[]): Promise<number[]> {
  return new Promise((resolve, reject) => {
    imap.search(criteria, (err, results) => {
      if (err) reject(err);
      else resolve(results || []);
    });
  });
}

function fetchAndParse(imap: Imap, uid: number): Promise<FetchedEmail | null> {
  return new Promise((resolve, reject) => {
    const f = imap.fetch(uid, { bodies: "", struct: false });
    let parsed: ParsedMail | null = null;

    f.on("message", (msg) => {
      msg.on("body", (stream) => {
        simpleParser(stream as any)
          .then((mail) => {
            parsed = mail;
          })
          .catch(reject);
      });
    });

    f.once("error", reject);
    f.once("end", () => {
      if (!parsed) {
        resolve(null);
        return;
      }

      const messageId = typeof parsed.messageId === "string" ? parsed.messageId : `uid-${uid}`;
      const from = parsed.from?.value[0]?.address ?? parsed.from?.text ?? "";
      const subject = parsed.subject ?? "";

      resolve({
        uid,
        messageId,
        from,
        subject,
        text: parsed.text,
        html: parsed.html || undefined,
      });
    });
  });
}
