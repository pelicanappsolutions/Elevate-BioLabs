import * as cheerio from "cheerio";

const ORDER_NUMBER_RE = /\b(EBL-[A-Z0-9]{6})\b/;

const VENMO_SENDERS = [
  "no-reply@venmo.com",
  "venmo@venmo.com",
  "notifications@venmo.com",
];

const ZELLE_SENDERS = [
  "zellepay@example.com",
  "notifications@zellepay.com",
  "no-reply@zellepay.com",
];

export type P2pEmailSource = "venmo" | "zelle" | "unknown";

export interface ParsedP2pEmail {
  messageId: string;
  source: P2pEmailSource;
  fromEmail: string;
  subject: string;
  rawBody: string;
  amountCents: number | null;
  orderNumber: string | null;
  memo: string | null;
}

export interface RawEmail {
  messageId: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export function parseP2pEmail(raw: RawEmail): ParsedP2pEmail {
  const text = (raw.text ?? "").trim() || extractTextFromHtml(raw.html ?? "");
  const source = detectSource(raw.from);

  const orderMatch = text.match(ORDER_NUMBER_RE);
  const amountCents = extractAmountCents(text, source);

  return {
    messageId: raw.messageId,
    source,
    fromEmail: raw.from,
    subject: raw.subject,
    rawBody: sanitizeRawBody(text, orderMatch?.[1] ?? null),
    amountCents,
    orderNumber: orderMatch?.[1] ?? null,
    memo: extractMemo(text, orderMatch?.[1] ?? null),
  };
}

function detectSource(from: string): P2pEmailSource {
  const lower = from.toLowerCase();
  if (VENMO_SENDERS.some((s) => lower.includes(s))) return "venmo";
  if (ZELLE_SENDERS.some((s) => lower.includes(s))) return "zelle";
  return "unknown";
}

function extractTextFromHtml(html: string): string {
  return cheerio
    .load(html)
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

function extractAmountCents(text: string, source: P2pEmailSource): number | null {
  const lower = text.toLowerCase();

  // Venmo patterns: "You paid $123.45", "sent you $123.45", "$123.45"
  const venmoPatterns = [
    /paid\s+(?:you\s+)?\$?([\d,]+\.?\d{0,2})/i,
    /sent\s+(?:you\s+)?\$?([\d,]+\.?\d{0,2})/i,
    /amount[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    /\$([\d,]+\.?\d{0,2})\s+(?:was\s+)?sent/i,
  ];

  // Zelle patterns: "sent you $123.45 with Zelle", "$123.45"
  const zellePatterns = [
    /sent\s+(?:you\s+)?\$?([\d,]+\.?\d{0,2})\s+(?:with\s+)?zelle/i,
    /paid\s+(?:you\s+)?\$?([\d,]+\.?\d{0,2})/i,
    /amount[:\s]+\$?([\d,]+\.?\d{0,2})/i,
  ];

  const patterns = source === "venmo" ? venmoPatterns : source === "zelle" ? zellePatterns : [...venmoPatterns, ...zellePatterns];

  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(amount) && amount > 0) {
        return Math.round(amount * 100);
      }
    }
  }

  // Fallback: find any dollar amount in the text.
  const fallback = lower.match(/\$([\d,]+\.?\d{0,2})/);
  if (fallback?.[1]) {
    const amount = parseFloat(fallback[1].replace(/,/g, ""));
    if (!isNaN(amount) && amount > 0) {
      return Math.round(amount * 100);
    }
  }

  return null;
}

function extractMemo(text: string, orderNumber: string | null): string | null {
  // Strip the order number and truncate to avoid storing huge bodies.
  let memo = orderNumber ? text.replace(new RegExp(orderNumber, "g"), "").trim() : text.trim();
  memo = memo.replace(/\s+/g, " ").slice(0, 2000);
  return memo || null;
}

function sanitizeRawBody(text: string, orderNumber: string | null): string {
  let body = orderNumber ? text.replace(new RegExp(orderNumber, "g"), "[ORDER]") : text;
  body = body.replace(/\s+/g, " ").slice(0, 4000);
  return body;
}
