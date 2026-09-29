/**
 * Synthetic demo data — plausible Calgary spending generated from a fixed seed.
 * Nothing here comes from a real person's records.
 */
import { defaultCategories, defaultSettings } from "./defaults";
import type { Account, BalanceSnapshot, BudgetLine, Dataset, ExpenseType, Goal, IncomeLine, Locale, Priority, Subscription, Transaction } from "./types";
import { addMonths, currentMonth, monthOf, round2, todayISO } from "./utils";

type Tri = [string, string, string];
const L: Record<Locale, 0 | 1 | 2> = { pt: 0, en: 1, fr: 2 };

interface Tpl {
  c: number; // category index in defaultCategories()
  s: number; // subcategory index
  m: string; // merchant
  d: Tri; // description pt/en/fr
  min: number;
  max: number;
  pr: Priority;
  ty?: ExpenseType;
  pay?: number; // payment method index
  rec?: boolean;
}

interface Fixed extends Tpl {
  day: number;
  /** optional multiplier by month-of-year for seasonal bills (0 = Jan) */
  season?: number[];
}

const WINTER = [1.6, 1.5, 1.3, 1.05, 0.8, 0.7, 0.7, 0.7, 0.85, 1.1, 1.35, 1.6];

const FIXED: Fixed[] = [
  { day: 1, c: 0, s: 0, m: "Bow River Apartments", d: ["Aluguel", "Rent", "Loyer"], min: 1650, max: 1650, pr: "essential", ty: "fixed", pay: 3, rec: true },
  { day: 3, c: 0, s: 2, m: "Square One", d: ["Seguro do inquilino", "Tenant insurance", "Assurance locataire"], min: 24.5, max: 24.5, pr: "essential", ty: "fixed", pay: 0, rec: true },
  { day: 1, c: 4, s: 0, m: "Calgary Transit", d: ["Passe mensal", "Monthly transit pass", "Laissez-passer mensuel"], min: 115, max: 115, pr: "essential", ty: "fixed", pay: 1, rec: true },
  { day: 9, c: 1, s: 0, m: "ENMAX", d: ["Conta de luz", "Electricity bill", "Facture d'électricité"], min: 62, max: 78, pr: "essential", ty: "fixed", pay: 4, rec: true, season: WINTER },
  { day: 12, c: 1, s: 1, m: "ATCO", d: ["Conta de gás", "Natural gas bill", "Facture de gaz"], min: 55, max: 70, pr: "essential", ty: "fixed", pay: 4, rec: true, season: WINTER },
  { day: 15, c: 1, s: 3, m: "TELUS", d: ["Internet de casa", "Home internet", "Internet résidentiel"], min: 75, max: 75, pr: "essential", ty: "fixed", pay: 0, rec: true },
  { day: 11, c: 1, s: 4, m: "Koodo", d: ["Plano de celular", "Phone plan", "Forfait cellulaire"], min: 45, max: 45, pr: "important", ty: "fixed", pay: 0, rec: true },
  { day: 5, c: 8, s: 1, m: "Spotify", d: ["Spotify Premium", "Spotify Premium", "Spotify Premium"], min: 11.99, max: 11.99, pr: "superfluous", ty: "fixed", pay: 0, rec: true },
  { day: 18, c: 8, s: 0, m: "Netflix", d: ["Netflix", "Netflix", "Netflix"], min: 18.99, max: 18.99, pr: "superfluous", ty: "fixed", pay: 0, rec: true },
  { day: 2, c: 8, s: 2, m: "Apple", d: ["iCloud+", "iCloud+", "iCloud+"], min: 3.99, max: 3.99, pr: "important", ty: "fixed", pay: 0, rec: true },
  { day: 20, c: 12, s: 2, m: "Wise", d: ["Envio para a família", "Money sent home", "Argent envoyé à la famille"], min: 200, max: 200, pr: "important", ty: "fixed", pay: 3, rec: true },
];

/** freq = expected occurrences per month */
const VARIABLE: (Tpl & { freq: number; weekend?: boolean })[] = [
  { freq: 5, c: 2, s: 0, m: "Real Canadian Superstore", d: ["Compras da semana", "Weekly groceries", "Épicerie de la semaine"], min: 45, max: 140, pr: "essential", pay: 1 },
  { freq: 3, c: 2, s: 0, m: "Calgary Co-op", d: ["Compra rápida", "Quick grocery run", "Petite épicerie"], min: 12, max: 48, pr: "essential", pay: 1 },
  { freq: 0.8, c: 2, s: 0, m: "Costco", d: ["Compra grande Costco", "Costco stock-up", "Grosse épicerie Costco"], min: 140, max: 260, pr: "essential", pay: 0 },
  { freq: 1.2, c: 2, s: 3, m: "Cobs Bread", d: ["Pão e doces", "Bread and pastries", "Pain et viennoiseries"], min: 7, max: 18, pr: "important", pay: 0 },
  { freq: 0.7, c: 2, s: 4, m: "Latin Market YYC", d: ["Produtos brasileiros", "Brazilian groceries", "Produits brésiliens"], min: 18, max: 55, pr: "important", pay: 0 },
  { freq: 1.5, c: 2, s: 7, m: "7-Eleven", d: ["Besteiras", "Snacks", "Grignotines"], min: 5, max: 16, pr: "superfluous", pay: 0 },
  { freq: 7, c: 3, s: 3, m: "Tim Hortons", d: ["Café e donut", "Coffee and a donut", "Café et beigne"], min: 3.2, max: 9.5, pr: "superfluous", pay: 0 },
  { freq: 3, c: 3, s: 6, m: "New York Fries", d: ["Almoço", "Lunch", "Repas du midi"], min: 13, max: 22, pr: "important", pay: 0 },
  { freq: 2, c: 3, s: 0, m: "Native Tongues", d: ["Jantar fora", "Dinner out", "Souper au restaurant"], min: 38, max: 92, pr: "superfluous", pay: 0, weekend: true },
  { freq: 1.6, c: 3, s: 2, m: "SkipTheDishes", d: ["Delivery", "Delivery", "Livraison"], min: 24, max: 48, pr: "superfluous", pay: 0 },
  { freq: 1, c: 3, s: 5, m: "Cold Garden", d: ["Happy hour", "Happy hour", "5 à 7"], min: 22, max: 55, pr: "superfluous", pay: 0, weekend: true },
  { freq: 1.5, c: 4, s: 2, m: "Uber", d: ["Corrida de Uber", "Uber ride", "Course Uber"], min: 11, max: 29, pr: "important", pay: 0 },
  { freq: 1.2, c: 4, s: 7, m: "Bird", d: ["Patinete", "Scooter ride", "Trottinette"], min: 3, max: 7, pr: "superfluous", pay: 0 },
  { freq: 0.9, c: 5, s: 2, m: "Shoppers Drug Mart", d: ["Farmácia", "Pharmacy", "Pharmacie"], min: 9, max: 42, pr: "essential", pay: 1 },
  { freq: 1, c: 6, s: 0, m: "Winners", d: ["Roupas", "Clothes", "Vêtements"], min: 28, max: 120, pr: "important", pay: 0 },
  { freq: 0.8, c: 6, s: 3, m: "Barber & Co", d: ["Corte de cabelo", "Haircut", "Coupe de cheveux"], min: 35, max: 45, pr: "important", pay: 0 },
  { freq: 0.8, c: 7, s: 2, m: "IKEA", d: ["Coisas para casa", "Home bits", "Articles pour la maison"], min: 25, max: 180, pr: "important", pay: 0 },
  { freq: 0.9, c: 9, s: 0, m: "Cineplex", d: ["Cinema", "Movie night", "Soirée cinéma"], min: 16, max: 34, pr: "superfluous", pay: 0, weekend: true },
  { freq: 0.5, c: 9, s: 4, m: "Banff Park", d: ["Passeio em Banff", "Day trip to Banff", "Excursion à Banff"], min: 45, max: 130, pr: "superfluous", pay: 0, weekend: true },
  { freq: 0.3, c: 9, s: 6, m: "Chinook Centre", d: ["Presente", "Gift", "Cadeau"], min: 30, max: 90, pr: "important", pay: 0 },
];

/** One-off purchases pinned to a month offset from today (0 = this month) */
const ONE_OFFS: (Tpl & { offset: number; day: number })[] = [
  { offset: -4, day: 14, c: 5, s: 1, m: "Bridgeland Dental", d: ["Limpeza no dentista", "Dental cleaning", "Nettoyage dentaire"], min: 185, max: 185, pr: "essential", pay: 0 },
  { offset: -3, day: 8, c: 10, s: 1, m: "SAIT", d: ["Curso de certificação", "Certification course", "Cours de certification"], min: 320, max: 320, pr: "important", pay: 0 },
  { offset: -2, day: 22, c: 7, s: 0, m: "Structube", d: ["Sofá novo", "New sofa", "Nouveau canapé"], min: 649, max: 649, pr: "important", pay: 0 },
  { offset: -1, day: 16, c: 9, s: 1, m: "Scotiabank Saddledome", d: ["Show", "Concert", "Concert"], min: 138, max: 138, pr: "superfluous", pay: 0 },
  { offset: 0, day: 4, c: 6, s: 1, m: "Mountain Warehouse", d: ["Casaco de inverno", "Winter coat", "Manteau d'hiver"], min: 229, max: 229, pr: "essential", pay: 0 },
];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function buildDemoDataset(locale: Locale, today = todayISO()): Dataset {
  const li = L[locale];
  const categories = defaultCategories(locale);
  const settings = defaultSettings(locale);
  settings.reserve = 18000;
  settings.savingsGoal = 800;
  const pays = settings.paymentMethods;
  const rand = mulberry32(20260925);
  const nowMonth = currentMonth(new Date(`${today}T12:00:00`));
  const startMonth = addMonths(nowMonth, -5);
  const txs: Transaction[] = [];
  let seq = 0;

  const make = (tpl: Tpl, date: string, amount: number): Transaction => {
    const cat = categories[tpl.c];
    const stamp = `${date}T12:00:00.000Z`;
    return {
      id: `demo_${(seq++).toString(36).padStart(4, "0")}`,
      date,
      category: cat.name,
      subcategory: cat.subcategories[tpl.s] ?? "",
      description: tpl.d[li],
      amount: round2(amount),
      payment: pays[tpl.pay ?? 0] ?? pays[0],
      type: tpl.ty ?? "variable",
      priority: tpl.pr,
      merchant: tpl.m,
      recurring: tpl.rec ?? false,
      notes: "",
      receiptUrl: "",
      createdAt: stamp,
      updatedAt: stamp,
      group: "",
      billId: "",
    };
  };

  for (let i = 0; i < 6; i++) {
    const month = addMonths(startMonth, i);
    const [y, m] = month.split("-").map(Number);
    const days = new Date(y, m, 0).getDate();
    for (const f of FIXED) {
      const date = `${month}-${pad(Math.min(f.day, days))}`;
      if (date > today) continue;
      const base = f.min + rand() * (f.max - f.min);
      txs.push(make(f, date, base * (f.season?.[m - 1] ?? 1)));
    }
    for (let d = 1; d <= days; d++) {
      const date = `${month}-${pad(d)}`;
      if (date > today) break;
      const dow = new Date(y, m - 1, d).getDay();
      const weekend = dow === 0 || dow === 5 || dow === 6;
      for (const v of VARIABLE) {
        let chance = v.freq / 30;
        if (v.weekend) chance = weekend ? chance * 2.2 : chance * 0.3;
        if (rand() < chance) txs.push(make(v, date, v.min + rand() * (v.max - v.min)));
      }
    }
  }
  for (const o of ONE_OFFS) {
    const date = `${addMonths(nowMonth, o.offset)}-${pad(o.day)}`;
    if (date <= today) txs.push(make(o, date, o.min));
  }
  // One purchase split across two categories
  const splitDay = new Date(`${today}T12:00:00`);
  splitDay.setDate(splitDay.getDate() - 3);
  const costco = (tpl: Omit<Tpl, "min" | "max">, amount: number): Transaction => ({
    ...make({ ...tpl, min: amount, max: amount }, todayISO(splitDay), amount),
    group: "demo_split",
  });
  txs.push(
    costco({ c: 2, s: 0, m: "Costco", d: ["Frutas, laticínios", "Produce, dairy", "Fruits, produits laitiers"], pr: "essential" }, 86.4),
    costco({ c: 7, s: 0, m: "Costco", d: ["Papel toalha, detergente", "Paper towels, detergent", "Essuie-tout, détergent"], pr: "important" }, 42.9),
  );
  txs.sort((a, b) => (a.date < b.date ? 1 : -1));

  const budgetAmounts = [1700, 330, 640, 320, 170, 90, 200, 150, 40, 170, 50, 0, 220];
  const budgets: BudgetLine[] = categories
    .map((c, i) => ({ month: "default", category: c.name, amount: budgetAmounts[i] ?? 0 }))
    .filter((b) => b.amount > 0);
  const incomes: IncomeLine[] = [{ month: "default", gross: 6500, net: 4980, note: "" }];

  const trialEnd = new Date(`${today}T12:00:00`);
  trialEnd.setDate(trialEnd.getDate() + 9);
  const caaDue = new Date(`${today}T12:00:00`);
  caaDue.setDate(caaDue.getDate() + 12);
  // charged a few days ago with nothing logged, so the demo asks "were these paid?"
  const gymDay = Math.max(1, Math.min(28, Number(today.slice(8, 10)) - 3));
  const subsCat = categories[8].name;
  const subscriptions: Subscription[] = [
    { id: "sub_1", name: "Spotify", category: subsCat, amount: 11.99, cycle: "monthly", billingDay: 5, payment: pays[0], status: "active", trialEnd: "", worthIt: "yes", notes: "", nextCharge: "", kind: "subscription" },
    { id: "sub_2", name: "Netflix", category: subsCat, amount: 18.99, cycle: "monthly", billingDay: 18, payment: pays[0], status: "active", trialEnd: "", worthIt: "maybe", notes: "", nextCharge: "", kind: "subscription" },
    { id: "sub_3", name: "iCloud+", category: subsCat, amount: 3.99, cycle: "monthly", billingDay: 2, payment: pays[0], status: "active", trialEnd: "", worthIt: "yes", notes: "200 GB", nextCharge: "", kind: "subscription" },
    { id: "sub_4", name: "Koodo", category: categories[1].name, amount: 45, cycle: "monthly", billingDay: 11, payment: pays[0], status: "active", trialEnd: "", worthIt: "yes", notes: "50 GB", nextCharge: "", kind: "bill" },
    { id: "sub_5", name: "Disney+", category: subsCat, amount: 14.99, cycle: "monthly", billingDay: null, payment: pays[0], status: "trial", trialEnd: todayISO(trialEnd), worthIt: "no", notes: "", nextCharge: "", kind: "subscription" },
    { id: "sub_6", name: "Amazon Prime", category: subsCat, amount: 99, cycle: "annual", billingDay: 14, payment: pays[0], status: "paused", trialEnd: "", worthIt: "maybe", notes: "", nextCharge: "", kind: "subscription" },
    { id: "sub_7", name: "GoodLife Fitness", category: categories[5].name, amount: 54.99, cycle: "monthly", billingDay: gymDay, payment: pays[0], status: "active", trialEnd: "", worthIt: "yes", notes: "", nextCharge: "", kind: "subscription" },
    { id: "sub_0", name: ["Aluguel", "Rent", "Loyer"][li], category: categories[0].name, amount: 1650, cycle: "monthly", billingDay: 1, payment: pays[3], status: "active", trialEnd: "", worthIt: "yes", notes: "", nextCharge: "", kind: "bill" },
    { id: "sub_8", name: "CAA", category: categories[4].name, amount: 128, cycle: "annual", billingDay: null, payment: pays[0], status: "active", trialEnd: "", worthIt: "maybe", notes: "", nextCharge: todayISO(caaDue), kind: "bill" },
  ];

  // Accounts with a check-in on the 1st of each previous month. This month's check-in is
  // deliberately missing so the demo shows the monthly reminder.
  const tri = (x: Tri) => x[li];
  const accounts: Account[] = [
    { id: "acc_neo", name: tri(["Poupança (HISA)", "Savings (HISA)", "Épargne (CÉIE)"]), institution: "Neo Financial", type: "savings", color: "#199e70", archived: false, notes: "" },
    { id: "acc_chq", name: tri(["Conta corrente", "Chequing", "Compte chèques"]), institution: "Scotiabank", type: "chequing", color: "#3987e5", archived: false, notes: "" },
    { id: "acc_visa", name: "Visa", institution: "Scotiabank", type: "credit", color: "#e0707a", archived: false, notes: "" },
    { id: "acc_tfsa", name: tri(["TFSA", "TFSA", "CELI"]), institution: "Wealthsimple", type: "investment", color: "#9085e9", archived: false, notes: "" },
  ];
  const balances: BalanceSnapshot[] = [];
  for (let i = 0; i < 6; i++) {
    const date = `${addMonths(startMonth, i)}-01`;
    if (monthOf(date) >= nowMonth) break;
    balances.push(
      { accountId: "acc_neo", date, balance: round2(6200 + i * 560 + rand() * 90) },
      { accountId: "acc_chq", date, balance: round2(2800 + rand() * 1300) },
      { accountId: "acc_visa", date, balance: round2(550 + rand() * 700) },
      { accountId: "acc_tfsa", date, balance: round2(4000 * Math.pow(1.004, i) + i * 330 + rand() * 60) },
    );
  }
  const created = new Date(`${startMonth}-01T12:00:00`).toISOString();
  const goals: Goal[] = [
    {
      id: "goal_car", name: tri(["Carro", "Car", "Voiture"]), icon: "Car", color: "#3987e5", target: 18000,
      targetDate: `${addMonths(nowMonth, 15)}-01`, accountIds: ["acc_neo"], saved: 0, monthlyContribution: 700, annualReturn: 3,
      status: "active", order: 0, notes: "", createdAt: created,
    },
    {
      id: "goal_home", name: tri(["Entrada do apartamento", "Home down payment", "Mise de fonds"]), icon: "Home", color: "#d9b45f", target: 60000,
      targetDate: `${addMonths(nowMonth, 54)}-01`, accountIds: ["acc_tfsa"], saved: 0, monthlyContribution: 350, annualReturn: 5,
      status: "active", order: 1, notes: "", createdAt: created,
    },
    {
      id: "goal_trip", name: tri(["Viagem ao Brasil", "Trip to Brazil", "Voyage au Brésil"]), icon: "Plane", color: "#d55181", target: 3500,
      targetDate: `${addMonths(nowMonth, 9)}-01`, accountIds: [], saved: 1200, monthlyContribution: 300, annualReturn: 0,
      status: "active", order: 2, notes: "", createdAt: created,
    },
  ];

  return {
    transactions: txs,
    categories,
    budgets,
    incomes,
    subscriptions,
    accounts,
    balances,
    goals,
    settings,
    meta: { source: "demo", syncedAt: new Date().toISOString() },
  };
}
