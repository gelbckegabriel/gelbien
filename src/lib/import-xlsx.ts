/**
 * Importer for the original "Money Sheet" workbook (Portuguese layout:
 * Lançamentos / Config / Orçamento / Dashboard / Assinaturas). Columns are
 * located by header text, so re-ordered or extra columns are tolerated.
 * Pure: takes already-parsed sheet data so it runs in the browser and in tests.
 */
import { defaultSettings, guessKind, OTHER_COLOR, templateFor } from "./defaults";
import type {
  BudgetLine,
  Category,
  Cycle,
  Dataset,
  ExpenseType,
  IncomeLine,
  Locale,
  Priority,
  SubStatus,
  Subscription,
  Transaction,
  WorthIt,
} from "./types";
import { normalize, parseAmount, round2, serialToISO } from "./utils";

export type SheetData = { sheet: string; data: unknown[][] };

export interface ImportResult {
  data: Omit<Dataset, "meta">;
  stats: { transactions: number; categories: number; subscriptions: number; skipped: number };
}

const pad = (n: number) => String(n).padStart(2, "0");

function toISODate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  }
  if (typeof v === "number" && v > 20000 && v < 80000) return serialToISO(v);
  if (typeof v === "string") {
    const s = v.trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // dd/mm/yyyy
    if (br) return `${br[3]}-${pad(Number(br[2]))}-${pad(Number(br[1]))}`;
  }
  return null;
}

const text = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s === "-" || s === "—" ? "" : s;
};

function mapEnum<T extends string>(v: unknown, table: Record<string, T>, fallback: T): T {
  const k = normalize(text(v));
  return table[k] ?? fallback;
}

const TYPE: Record<string, ExpenseType> = { fixo: "fixed", fixed: "fixed", fixe: "fixed", variavel: "variable", variable: "variable" };
const PRIORITY: Record<string, Priority> = {
  essencial: "essential", essential: "essential", essentiel: "essential",
  importante: "important", important: "important",
  superfluo: "superfluous", superfluous: "superfluous", superflu: "superfluous",
};
const YES = new Set(["sim", "yes", "oui", "true", "x", "1"]);
const CYCLE: Record<string, Cycle> = {
  semanal: "weekly", weekly: "weekly", mensal: "monthly", monthly: "monthly", bimestral: "bimonthly",
  trimestral: "quarterly", quarterly: "quarterly", semestral: "semiannual", anual: "annual", annual: "annual", yearly: "annual",
};
const STATUS: Record<string, SubStatus> = {
  ativa: "active", ativo: "active", active: "active", "teste gratis": "trial", trial: "trial",
  pausada: "paused", paused: "paused", cancelada: "cancelled", cancelled: "cancelled", canceled: "cancelled",
};
const WORTH: Record<string, WorthIt> = { sim: "yes", yes: "yes", talvez: "maybe", maybe: "maybe", nao: "no", no: "no" };

/** Find the header row (first row containing all `needles`) and return a column lookup. */
function header(rows: unknown[][], needles: string[]) {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cells = rows[r].map((c) => normalize(text(c)));
    if (needles.every((n) => cells.some((c) => c.startsWith(n)))) {
      // Exact header match wins over prefix match ("Categoria" must not hit "Categorias").
      const col = (...names: string[]) => {
        const exact = cells.findIndex((c) => names.includes(c));
        return exact !== -1 ? exact : cells.findIndex((c) => names.some((n) => c.startsWith(n)));
      };
      return { row: r, col };
    }
  }
  return null;
}

function findSheet(sheets: SheetData[], ...names: string[]) {
  const wanted = names.map(normalize);
  return sheets.find((s) => wanted.includes(normalize(s.sheet)))?.data ?? null;
}

export function importMoneySheet(sheets: SheetData[], locale: Locale, now = new Date()): ImportResult {
  const settings = defaultSettings(locale);
  const stamp = now.toISOString();
  let skipped = 0;

  // ---- Config: categories, subcategories, payment methods ----
  const categories: Category[] = [];
  const catByKey = new Map<string, Category>();
  const ensureCategory = (name: string) => {
    const key = normalize(name);
    let cat = catByKey.get(key);
    if (!cat) {
      const look = templateFor(name);
      cat = {
        name,
        color: look?.color ?? OTHER_COLOR,
        icon: look?.icon ?? "Package",
        order: categories.length,
        subcategories: [],
        archived: false,
      };
      categories.push(cat);
      catByKey.set(key, cat);
    }
    return cat;
  };
  const addSub = (cat: Category, sub: string) => {
    if (sub && !cat.subcategories.some((s) => normalize(s) === normalize(sub))) cat.subcategories.push(sub);
  };

  const config = findSheet(sheets, "Config", "Configurações", "Settings");
  const payments: string[] = [];
  if (config) {
    const h = header(config, ["categoria", "subcategoria"]);
    if (h) {
      const cList = h.col("categorias");
      const cCat = h.col("categoria");
      const cSub = h.col("subcategoria");
      const cPay = h.col("forma de pagamento", "pagamento");
      for (const row of config.slice(h.row + 1)) {
        if (cList >= 0 && cList !== cCat && text(row[cList])) ensureCategory(text(row[cList]));
        if (cCat >= 0 && text(row[cCat])) addSub(ensureCategory(text(row[cCat])), text(row[cSub]));
        if (cPay >= 0 && text(row[cPay]) && !payments.includes(text(row[cPay]))) payments.push(text(row[cPay]));
      }
    }
  }

  // ---- Lançamentos: transactions ----
  const transactions: Transaction[] = [];
  const tx = findSheet(sheets, "Lançamentos", "Lancamentos", "Transactions", "Expenses");
  if (tx) {
    const h = header(tx, ["data", "valor"]) ?? header(tx, ["date", "amount"]);
    if (h) {
      const c = {
        date: h.col("data", "date"),
        category: h.col("categoria", "category"),
        sub: h.col("subcategoria", "subcategory"),
        desc: h.col("descricao", "description"),
        amount: h.col("valor", "amount"),
        payment: h.col("pagamento", "payment"),
        type: h.col("tipo", "type"),
        priority: h.col("prioridade", "priority"),
        merchant: h.col("local", "estabelecimento", "merchant"),
        recurring: h.col("recorrente", "recurring"),
        notes: h.col("observacoes", "notes"),
      };
      tx.slice(h.row + 1).forEach((row, i) => {
        const date = toISODate(row[c.date]);
        const amount = parseAmount(row[c.amount] as never);
        if (!date || !amount) {
          if (row.some((v) => text(v))) skipped++;
          return;
        }
        const catName = text(row[c.category]) || "Outros";
        const cat = ensureCategory(catName);
        const sub = text(row[c.sub]);
        addSub(cat, sub);
        const payment = text(row[c.payment]);
        if (payment && !payments.includes(payment)) payments.push(payment);
        transactions.push({
          id: `imp_${date.replace(/-/g, "")}_${String(i).padStart(4, "0")}`,
          date,
          category: cat.name,
          subcategory: sub,
          description: text(row[c.desc]),
          amount: round2(amount),
          payment,
          type: mapEnum(row[c.type], TYPE, "variable"),
          priority: mapEnum(row[c.priority], PRIORITY, "important"),
          merchant: text(row[c.merchant]),
          recurring: YES.has(normalize(text(row[c.recurring]))),
          notes: text(row[c.notes]),
          receiptUrl: "",
          createdAt: stamp,
          updatedAt: stamp,
          group: "",
          billId: "",
        });
      });
    }
  }

  // ---- Orçamento: default monthly budget ----
  const budgets: BudgetLine[] = [];
  const budget = findSheet(sheets, "Orçamento", "Orcamento", "Budget");
  if (budget) {
    const h = header(budget, ["categoria", "orcamento"]);
    if (h) {
      const cCat = h.col("categoria");
      const cAmt = h.col("orcamento");
      for (const row of budget.slice(h.row + 1)) {
        const name = text(row[cCat]);
        // Skip totals and free-text notes (no amount cell, or a sentence rather than a name)
        if (!name || normalize(name) === "total" || name.length > 60 || text(row[cAmt]) === "") continue;
        const cat = ensureCategory(name); // a $0 budget row still declares the category
        const amount = parseAmount(row[cAmt] as never);
        if (amount > 0) budgets.push({ month: "default", category: cat.name, amount: round2(amount) });
      }
    }
  }

  // ---- Dashboard: reserve + income ----
  const incomes: IncomeLine[] = [];
  const dash = findSheet(sheets, "Dashboard", "Painel");
  if (dash) {
    const valueAfterLabel = (label: string) => {
      for (const row of dash) {
        const idx = row.findIndex((v) => normalize(text(v)).startsWith(label));
        if (idx === -1) continue;
        const val = row.slice(idx + 1).find((v) => typeof v === "number");
        if (typeof val === "number") return val;
      }
      return null;
    };
    const reserve = valueAfterLabel("reserva disponivel");
    const income = valueAfterLabel("renda");
    if (reserve !== null) settings.reserve = round2(reserve);
    if (income !== null && income > 0) incomes.push({ month: "default", gross: 0, net: round2(income), note: "" });
  }

  // ---- Assinaturas: subscriptions ----
  const subscriptions: Subscription[] = [];
  const subs = findSheet(sheets, "Assinaturas", "Subscriptions");
  if (subs) {
    const h = header(subs, ["servico", "valor"]) ?? header(subs, ["service", "amount"]);
    if (h) {
      const c = {
        name: h.col("servico", "service"),
        category: h.col("categoria", "category"),
        amount: h.col("valor", "amount"),
        cycle: h.col("ciclo", "cycle"),
        day: h.col("dia", "billing"),
        payment: h.col("forma de pagamento", "payment"),
        status: h.col("status"),
        trial: h.col("fim do teste", "trial"),
        worth: h.col("vale a pena", "worth"),
        notes: h.col("observacoes", "notes"),
      };
      subs.slice(h.row + 1).forEach((row, i) => {
        const name = text(row[c.name]);
        const amount = parseAmount(row[c.amount] as never);
        if (!name || !amount) return;
        const day = Number(row[c.day]);
        subscriptions.push({
          id: `imp_sub_${i}`,
          name,
          category: text(row[c.category]) ? ensureCategory(text(row[c.category])).name : "",
          amount: round2(amount),
          cycle: mapEnum(row[c.cycle], CYCLE, "monthly"),
          billingDay: day >= 1 && day <= 31 ? Math.round(day) : null,
          payment: text(row[c.payment]),
          status: mapEnum(row[c.status], STATUS, "active"),
          trialEnd: toISODate(row[c.trial]) ?? "",
          worthIt: mapEnum(row[c.worth], WORTH, "maybe"),
          notes: text(row[c.notes]),
          nextCharge: "",
          kind: guessKind(text(row[c.category])),
        });
      });
    }
  }

  if (payments.length) settings.paymentMethods = payments;
  transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    // The workbook has no accounts or goals; callers keep the ones already in the app.
    data: { transactions, categories, budgets, incomes, subscriptions, accounts: [], balances: [], goals: [], settings },
    stats: { transactions: transactions.length, categories: categories.length, subscriptions: subscriptions.length, skipped },
  };
}

/** Merge imported data into an existing dataset (dedupes transactions by date+amount+description). */
export function mergeImport(existing: Omit<Dataset, "meta">, incoming: Omit<Dataset, "meta">): Omit<Dataset, "meta"> {
  const key = (t: Transaction) => `${t.date}|${t.amount.toFixed(2)}|${normalize(t.description)}|${normalize(t.merchant)}`;
  const seen = new Set(existing.transactions.map(key));
  const categories = [...existing.categories];
  for (const c of incoming.categories) {
    const found = categories.find((x) => normalize(x.name) === normalize(c.name));
    if (!found) categories.push({ ...c, order: categories.length });
    else for (const s of c.subcategories) if (!found.subcategories.includes(s)) found.subcategories.push(s);
  }
  const subNames = new Set(existing.subscriptions.map((s) => normalize(s.name)));
  return {
    ...existing,
    categories,
    transactions: [...existing.transactions, ...incoming.transactions.filter((t) => !seen.has(key(t)))],
    budgets: existing.budgets.length ? existing.budgets : incoming.budgets,
    incomes: existing.incomes.length ? existing.incomes : incoming.incomes,
    subscriptions: [...existing.subscriptions, ...incoming.subscriptions.filter((s) => !subNames.has(normalize(s.name)))],
    settings: {
      ...existing.settings,
      paymentMethods: [...new Set([...existing.settings.paymentMethods, ...incoming.settings.paymentMethods])],
      reserve: existing.settings.reserve || incoming.settings.reserve,
    },
  };
}
