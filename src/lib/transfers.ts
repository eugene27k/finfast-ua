/**
 * Internal-transfer detection and resolution.
 *
 * A transaction can be an "internal movement of funds" — money the user moves
 * between their own places (a Monobank jar, another of their cards, another of
 * their banks). Such movements are NOT income or expense and must be excluded
 * from those totals.
 *
 * Two marks exist:
 *  - internal ("Внутрішнє переміщення коштів") — the base mark.
 *  - jar ("Власна банка") — a transfer to/from one of the user's own jars.
 *    A jar transfer is ALWAYS also internal (jar ⇒ internal).
 *
 * The effective mark is the user's explicit decision if present, otherwise the
 * auto-detected mark. `auto: true` means "this mark came from auto-detection and
 * the user has not overridden it" (shown as «(авто)» in the UI).
 *
 * Auto-detection is intentionally heuristic — Monobank gives no field that links
 * a card transaction to a specific jar (jars have no IBAN; counterIban is
 * FOP-only). So we match the description text and pair opposite legs by amount
 * and time. The user can always correct it, and that decision is what persists.
 */

export type TransferDecision = "none" | "internal" | "jar";

export interface TransferInput {
  id: string;
  description: string;
  amount: number;
  time: number;
  accountId?: string;
}

export interface TransferMark {
  /** Internal movement of funds — not income/expense. */
  internal: boolean;
  /** Transfer to/from the user's own jar (implies internal). */
  jar: boolean;
  /** The mark was set automatically and not yet overridden by the user. */
  auto: boolean;
}

export const NO_TRANSFER: TransferMark = { internal: false, jar: false, auto: false };

// A name wrapped in quotes, e.g. «На Крипту» in "Округлення балансу «На Крипту»"
// or «На Резерв Поточний» in "Часткове зняття банки «На Резерв Поточний»".
// Covers guillemets, curly and straight double quotes.
const QUOTED_RE = /[«»„“”"]([^«»„“”"]{1,100})[«»„“”"]/gu;

// Known jar-operation wording on the card statement: "На банку", "З банки",
// "Часткове зняття банки", "Поповнення банки" — i.e. the jar noun «банк…».
const JAR_OP_RE = /(на банку|з банки|із банки|зі банки|зняття банк|поповнення банк)/iu;

// "З чорної картки", "З білої картки", "З картки …" — money arriving from another
// of the user's own cards (the card type is a free mask: Чорна/Біла/Platinum/…).
const FROM_CARD_RE = /(^|\s)(з|із|зі)\s+(\S+\s+)?картк[аиоуі]/iu;

function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** All quoted names found in a description (e.g. the jar name in «…»). */
function extractQuoted(description: string): string[] {
  return [...description.matchAll(QUOTED_RE)].map((m) => m[1]);
}

/**
 * Per-transaction auto classification from the description alone.
 * Returns "jar", "internal", or null (looks like a normal transaction).
 */
function autoClassify(description: string, jarTitlesNorm: Set<string>): TransferDecision | null {
  const d = normalize(description);
  if (!d) return null;
  // The whole description is exactly a jar name.
  if (jarTitlesNorm.has(d)) return "jar";
  // A quoted name inside the description matches one of the user's real jars,
  // e.g. «На Крипту» or «На Резерв Поточний». Quotes delimit the name precisely,
  // so this is safe even when the jar name is a common word.
  for (const q of extractQuoted(description)) {
    if (jarTitlesNorm.has(normalize(q))) return "jar";
  }
  // Monobank's standard jar-operation wording (catches jars not in the list too).
  if (JAR_OP_RE.test(description)) return "jar";
  // Money from another of the user's own cards.
  if (FROM_CARD_RE.test(description)) return "internal";
  return null;
}

/** Resolve the effective mark: user decision wins, otherwise auto-detected. */
export function resolveMark(
  autoMark: TransferDecision | null,
  decision: TransferDecision | null | undefined
): TransferMark {
  if (decision === "none") return NO_TRANSFER;
  if (decision === "internal") return { internal: true, jar: false, auto: false };
  if (decision === "jar") return { internal: true, jar: true, auto: false };
  // No explicit decision → fall back to auto-detection.
  if (autoMark === "jar") return { internal: true, jar: true, auto: true };
  if (autoMark === "internal") return { internal: true, jar: false, auto: true };
  return NO_TRANSFER;
}

/** Map the menu's two checkboxes to a stored decision value. */
export function decisionFromToggles(internal: boolean, jar: boolean): TransferDecision {
  if (jar) return "jar"; // jar implies internal
  if (internal) return "internal";
  return "none";
}

/**
 * Compute the effective transfer mark for every transaction in `txns`.
 *
 * Runs per-transaction classification, then a pairing pass: when one leg of a
 * transfer is detected (e.g. "+ З чорної картки"), its opposite leg (same
 * absolute amount, opposite sign, within 60s) is also marked internal even if
 * its own description gives nothing away (rule 2.2). User decisions always win.
 */
export function buildTransferInfo(
  txns: TransferInput[],
  jarTitles: string[],
  decisions: Record<string, TransferDecision | undefined>
): Map<string, TransferMark> {
  const jarTitlesNorm = new Set(jarTitles.map(normalize).filter(Boolean));

  // Pass 1: per-transaction classification.
  const auto = new Map<string, TransferDecision>();
  for (const tx of txns) {
    const c = autoClassify(tx.description, jarTitlesNorm);
    if (c) auto.set(tx.id, c);
  }

  // Pass 2: pair the silent opposite leg of each detected transfer.
  const detectedIds = [...auto.keys()];
  for (const id of detectedIds) {
    const tx = txns.find((t) => t.id === id);
    if (!tx) continue;
    for (const other of txns) {
      if (other.id === tx.id || auto.has(other.id)) continue;
      if (Math.sign(other.amount) === Math.sign(tx.amount)) continue;
      if (Math.abs(other.amount) !== Math.abs(tx.amount)) continue;
      if (Math.abs(other.time - tx.time) > 60) continue;
      auto.set(other.id, "internal");
      break;
    }
  }

  // Resolve with the user's stored decisions.
  const result = new Map<string, TransferMark>();
  for (const tx of txns) {
    result.set(tx.id, resolveMark(auto.get(tx.id) ?? null, decisions[tx.id]));
  }
  return result;
}
