/**
 * Whether an expense pays a bill's charge: linked to it, or typed in by hand looking like it. Shared by
 * the bills (bills.ts) and the loans whose payments show up as bills (plans.ts).
 */
import type { Subscription, Transaction } from "./types";
import { monthOf, normalize, todayISO } from "./utils";

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

/** An expense logged by hand for this bill: same category, and the bill's name in merchant or description (or the bill's merchant). */
export function looksLikeBill(t: Pick<Transaction, "category" | "merchant" | "description">, sub: Subscription): boolean {
  if (t.category !== sub.category) return false;
  const name = normalize(sub.name);
  const merchant = normalize(sub.merchant);
  if (merchant && normalize(t.merchant) === merchant) return true;
  return [t.merchant, t.description].some((x) => {
    const v = normalize(x);
    return !!v && !!name && (v.includes(name) || (v.length >= 4 && name.includes(v)));
  });
}

/**
 * The expense that covers the charge on `date`, if one was logged (linked, or a matching one typed
 * by hand) — the closest to that date, when more than one could.
 */
export function paidBy<T extends Pick<Transaction, "date" | "billId" | "category" | "merchant" | "description">>(sub: Subscription, date: string, txs: T[]): T | undefined {
  const tolerance = sub.cycle === "weekly" ? 3 : sub.cycle === "monthly" ? 7 : 20;
  const lo = addDays(date, -tolerance);
  const hi = addDays(date, tolerance);
  const at = Date.parse(date);
  let best: T | undefined;
  let bestGap = Infinity;
  for (const t of txs) {
    // a monthly bill paid any day of its month counts (early or late)
    const near = (t.date >= lo && t.date <= hi) || (sub.cycle === "monthly" && monthOf(t.date) === monthOf(date));
    if (!near || !(t.billId === sub.id || (!t.billId && looksLikeBill(t, sub)))) continue;
    const gap = Math.abs(Date.parse(t.date) - at);
    if (gap < bestGap) [best, bestGap] = [t, gap];
  }
  return best;
}
