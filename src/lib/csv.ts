import type { Transaction } from "./types";

export function toCsv(rows: Transaction[]): string {
  const head = ["date", "amount", "category", "subcategory", "description", "merchant", "payment", "type", "priority", "recurring", "notes", "receipt"];
  const esc = (v: string | number | boolean) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    head.join(","),
    ...rows.map((t) => [t.date, t.amount, t.category, t.subcategory, t.description, t.merchant, t.payment, t.type, t.priority, t.recurring, t.notes, t.receiptUrl].map(esc).join(",")),
  ].join("\n");
}
