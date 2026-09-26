import { describe, expect, it } from "vitest";
import { importMoneySheet, mergeImport, type SheetData } from "./import-xlsx";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** A tiny synthetic workbook in the original Money Sheet layout. */
const WORKBOOK: SheetData[] = [
  {
    sheet: "Lançamentos",
    data: [
      ["LANÇAMENTOS", null, null, null, null, null, null, null, null, null, null, null, null, "aux"],
      ["Data", "Mês", "Categoria", "Subcategoria", "Descrição", "Valor (CAD)", "Pagamento", "Tipo", "Prioridade", "Local / Estabelecimento", "Recorrente?", "Observações", null, "aux · valor do mês"],
      [d("2026-08-02"), "2026-08", "Mercado", "Supermercado", "Compra da semana", 38.2, "Débito", "Variável", "Essencial", "Mercado do Bairro", "Não", "-"],
      [d("2026-08-13"), "2026-08", "Alimentação fora", "Delivery", "Pizza", "31,90", "Crédito", "Variável", "Supérfluo", "Skip", "Não", "-"],
      [d("2026-09-01"), "2026-09", "Moradia", "Aluguel", "Aluguel", 1500, "Interac e-Transfer", "Fixo", "Essencial", "Landlord", "Sim", "setembro"],
      [d("2026-09-02"), "2026-09", "Pets", "Ração", "Ração", 30, "Crédito", "Variável", "Importante", "PetSmart", "Não", null],
      [null, null, null, null, null, null, null, null, null, null, null, "-"],
    ],
  },
  {
    sheet: "Config",
    data: [
      ["CONFIGURAÇÕES"],
      [],
      [],
      ["Categorias", null, "Categoria", "Subcategoria", null, "Forma de pagamento"],
      ["Moradia", null, "Moradia", "Aluguel", null, "Débito"],
      ["Mercado", null, "Moradia", "Mudança", null, "Crédito"],
      ["Alimentação fora", null, "Mercado", "Supermercado", null, "Interac e-Transfer"],
    ],
  },
  {
    sheet: "Orçamento",
    data: [
      [null, "ORÇAMENTO"],
      [null, "Categoria", "Orçamento mensal", "Gasto real"],
      [null, "Moradia", 1500, 0],
      [null, "Mercado", 400, 0],
      [null, "Saúde", 0, 0],
      [null, "TOTAL", 1900, 0],
      [],
      [null, "Como definir os valores: registre 1–2 meses reais primeiro e use a média como ponto de partida."],
    ],
  },
  {
    sheet: "Dashboard",
    data: [
      [null, null, null, null, null, null, null, null, "Reserva disponível hoje (CAD)", null, null, 15000],
      [null, null, null, null, null, null, null, null, "Renda / entradas por mês (CAD)", null, null, 4800],
    ],
  },
  {
    sheet: "Assinaturas",
    data: [
      [null, "ASSINATURAS"],
      [null, "Serviço", "Categoria", "Valor", "Ciclo", "Custo mensal", "Custo anual", "Dia da cobrança", "Forma de pagamento", "Status", "Fim do teste", "Vale a pena?", "Observações"],
      [null, "Spotify", "Assinaturas", 11.99, "Mensal", 11.99, 143.88, 11, "Crédito", "Ativa", null, "Sim", "Família"],
      [null, "Netflix", "Assinaturas", 18.99, "Mensal", 18.99, 227.88, 7, "Crédito", "Cancelada", null, "Talvez", null],
    ],
  },
];

describe("importMoneySheet", () => {
  const res = importMoneySheet(WORKBOOK, "pt", new Date("2026-09-25T00:00:00Z"));

  it("imports transactions with mapped enums and comma decimals", () => {
    expect(res.stats.transactions).toBe(4);
    const pizza = res.data.transactions.find((t) => t.description === "Pizza")!;
    expect(pizza.amount).toBe(31.9);
    expect(pizza.priority).toBe("superfluous");
    const rent = res.data.transactions.find((t) => t.category === "Moradia")!;
    expect(rent).toMatchObject({ type: "fixed", recurring: true, payment: "Interac e-Transfer", notes: "setembro" });
    expect(res.data.transactions[0].date).toBe("2026-09-02");
  });

  it("builds categories from Config and adds unknown ones from transactions", () => {
    const names = res.data.categories.map((c) => c.name);
    expect(names.slice(0, 3)).toEqual(["Moradia", "Mercado", "Alimentação fora"]);
    expect(names).toContain("Pets");
    expect(names).toContain("Saúde");
    // + "Assinaturas" from the subscriptions tab; the free-text tip under the budget table is not a category
    expect(names).toEqual(["Moradia", "Mercado", "Alimentação fora", "Pets", "Saúde", "Assinaturas"]);
    expect(res.data.categories.find((c) => c.name === "Moradia")!.subcategories).toEqual(["Aluguel", "Mudança"]);
    expect(res.data.categories.find((c) => c.name === "Moradia")!.icon).toBe("Home");
  });

  it("reads budget, income, reserve and subscriptions", () => {
    expect(res.data.budgets).toEqual([
      { month: "default", category: "Moradia", amount: 1500 },
      { month: "default", category: "Mercado", amount: 400 },
    ]);
    expect(res.data.incomes[0].net).toBe(4800);
    expect(res.data.settings.reserve).toBe(15000);
    expect(res.data.subscriptions.map((s) => [s.name, s.status, s.worthIt, s.billingDay])).toEqual([
      ["Spotify", "active", "yes", 11],
      ["Netflix", "cancelled", "maybe", 7],
    ]);
    expect(res.data.settings.paymentMethods).toEqual(["Débito", "Crédito", "Interac e-Transfer"]);
  });

  it("merges without duplicating transactions", () => {
    const merged = mergeImport(res.data, res.data);
    expect(merged.transactions).toHaveLength(4);
    expect(merged.subscriptions).toHaveLength(2);
  });
});
