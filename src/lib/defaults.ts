import type { Category, Locale, PaymentStyle, Settings, SubKind } from "./types";
import { normalize } from "./utils";

/** Category colors offered in the picker. The first 8 are the CVD-validated chart slots. */
export const CATEGORY_COLORS = [
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#9085e9", // violet
  "#d55181", // magenta
  "#2aa3c7", // cyan
  "#c98500", // amber
  "#b565c9", // plum
  "#6f7fe0", // indigo
  "#e0707a", // rose
  "#8fa12a", // olive
  "#a8744f", // bronze
  "#6b6a72", // gray
];

export const OTHER_COLOR = "#6b6a72";
/** Fold bucket in charts ("everything else") — darker than the "Other" category so the two never look alike. */
export const REST_COLOR = "#46454c";

export const CATEGORY_ICONS = [
  "Home", "Zap", "ShoppingCart", "UtensilsCrossed", "Bus", "HeartPulse", "Shirt", "Sofa",
  "Repeat", "Ticket", "GraduationCap", "Landmark", "Package", "PawPrint", "Plane", "Gift",
  "Baby", "Car", "Dumbbell", "Coffee", "Smartphone", "Wallet", "Briefcase", "FileText",
  "Music", "Gamepad2", "BookOpen", "Wrench", "PiggyBank", "CreditCard", "Globe", "Sparkles",
] as const;

export const GOAL_ICONS = [
  "Target", "Car", "Home", "Plane", "Umbrella", "GraduationCap", "Baby", "Gem", "Laptop", "Bike", "Gift", "PiggyBank",
] as const;

/** Suggestions for the institution field — free text, these are just shortcuts. */
export const INSTITUTIONS = [
  "Neo Financial", "Scotiabank", "RBC", "TD", "BMO", "CIBC", "National Bank", "Desjardins", "Tangerine", "Simplii",
  "EQ Bank", "KOHO", "Wealthsimple", "Questrade", "American Express", "Nubank", "Itaú", "Banco do Brasil",
];

type Tri = [pt: string, en: string, fr: string];

interface CategoryTemplate {
  name: Tri;
  icon: string;
  color: string;
  subs: Tri[];
}

const TEMPLATES: CategoryTemplate[] = [
  {
    name: ["Moradia", "Housing", "Logement"],
    icon: "Home",
    color: "#3987e5",
    subs: [
      ["Aluguel", "Rent", "Loyer"],
      ["Depósito/Caução", "Security deposit", "Dépôt de garantie"],
      ["Seguro do inquilino (tenant insurance)", "Tenant insurance", "Assurance locataire"],
      ["Taxa de condomínio", "Condo fees", "Frais de copropriété"],
      ["Estacionamento do prédio", "Building parking", "Stationnement de l'immeuble"],
      ["Mudança", "Moving", "Déménagement"],
      ["Multa/Quebra de contrato", "Lease break fee", "Frais de résiliation de bail"],
    ],
  },
  {
    name: ["Utilidades", "Utilities", "Services publics"],
    icon: "Zap",
    color: "#2aa3c7",
    subs: [
      ["Eletricidade", "Electricity", "Électricité"],
      ["Gás natural", "Natural gas", "Gaz naturel"],
      ["Água / Esgoto / Lixo", "Water / Sewer / Waste", "Eau / Égouts / Déchets"],
      ["Internet", "Internet", "Internet"],
      ["Celular", "Mobile phone", "Cellulaire"],
      ["Taxas administrativas de utilities", "Utility admin fees", "Frais d'administration"],
    ],
  },
  {
    name: ["Mercado", "Groceries", "Épicerie"],
    icon: "ShoppingCart",
    color: "#199e70",
    subs: [
      ["Supermercado", "Supermarket", "Supermarché"],
      ["Hortifruti / Feira", "Produce / Farmers market", "Fruits et légumes / Marché"],
      ["Açougue / Peixaria", "Butcher / Fishmonger", "Boucherie / Poissonnerie"],
      ["Padaria", "Bakery", "Boulangerie"],
      ["Mercado latino / brasileiro", "Latin / specialty market", "Épicerie latine / spécialisée"],
      ["Bebidas / Álcool", "Drinks / Alcohol", "Boissons / Alcool"],
      ["Produtos de limpeza", "Cleaning supplies", "Produits ménagers"],
      ["Junk food", "Junk food", "Malbouffe"],
      ["Higiene pessoal", "Toiletries", "Hygiène personnelle"],
    ],
  },
  {
    name: ["Alimentação fora", "Eating out", "Restaurants"],
    icon: "UtensilsCrossed",
    color: "#d95926",
    subs: [
      ["Restaurante", "Restaurant", "Restaurant"],
      ["Fast food", "Fast food", "Restauration rapide"],
      ["Delivery (Uber Eats/DoorDash/SkipTheDishes)", "Delivery (Uber Eats/DoorDash/SkipTheDishes)", "Livraison (Uber Eats/DoorDash/SkipTheDishes)"],
      ["Café / Cafeteria / Pastries", "Coffee / Café / Pastries", "Café / Pâtisseries"],
      ["Lanche rápido", "Quick snack", "Collation"],
      ["Bar / Happy hour", "Bar / Happy hour", "Bar / 5 à 7"],
      ["Almoço fora", "Lunch out", "Repas du midi"],
      ["Bebidas / Chás / Sucos", "Drinks / Tea / Juice", "Boissons / Thé / Jus"],
      ["Gorjeta", "Tips", "Pourboires"],
    ],
  },
  {
    name: ["Transporte", "Transportation", "Transport"],
    icon: "Bus",
    color: "#9085e9",
    subs: [
      ["Passe Calgary Transit", "Transit pass", "Laissez-passer de transport"],
      ["Passagem avulsa", "Single fare", "Billet à l'unité"],
      ["Uber / Lyft / Táxi", "Uber / Lyft / Taxi", "Uber / Lyft / Taxi"],
      ["Combustível", "Fuel", "Essence"],
      ["Seguro do carro", "Car insurance", "Assurance auto"],
      ["Manutenção do carro", "Car maintenance", "Entretien auto"],
      ["Estacionamento", "Parking", "Stationnement"],
      ["Aluguel de Transporte (Carro/Patinete/Bicicleta)", "Rentals (car / scooter / bike)", "Location (auto / trottinette / vélo)"],
      ["Voo / Passagem aérea", "Flights", "Vols"],
    ],
  },
  {
    name: ["Saúde", "Health", "Santé"],
    icon: "HeartPulse",
    color: "#e0707a",
    subs: [
      ["Plano de saúde privado", "Private health plan", "Assurance santé privée"],
      ["Dentista", "Dentist", "Dentiste"],
      ["Farmácia / Remédios", "Pharmacy / Medication", "Pharmacie / Médicaments"],
      ["Consulta médica", "Doctor visit", "Consultation médicale"],
      ["Óculos / Lentes", "Glasses / Contacts", "Lunettes / Lentilles"],
      ["Fisioterapia", "Physiotherapy", "Physiothérapie"],
      ["Terapia / Psicólogo", "Therapy / Counselling", "Thérapie / Psychologue"],
      ["Exames", "Lab tests", "Examens"],
      ["Academia / Ginásio", "Gym", "Gym"],
      ["Vacinas", "Vaccines", "Vaccins"],
    ],
  },
  {
    name: ["Cuidados pessoais", "Personal care", "Soins personnels"],
    icon: "Shirt",
    color: "#b565c9",
    subs: [
      ["Roupas", "Clothing", "Vêtements"],
      ["Roupa de inverno (casaco, botas, luvas)", "Winter gear (coat, boots, gloves)", "Équipement d'hiver (manteau, bottes, gants)"],
      ["Calçados", "Shoes", "Chaussures"],
      ["Cabeleireiro / Barbeiro", "Hair salon / Barber", "Coiffeur / Barbier"],
      ["Produtos para Cabelo", "Hair products", "Produits capillaires"],
      ["Acessórios", "Accessories", "Accessoires"],
      ["Gadget / Tecnologia / Dispositivos", "Gadgets / Tech", "Gadgets / Technologie"],
    ],
  },
  {
    name: ["Casa e utensílios", "Home & household", "Maison"],
    icon: "Sofa",
    color: "#c98500",
    subs: [
      ["Móveis", "Furniture", "Meubles"],
      ["Eletrodomésticos", "Appliances", "Électroménagers"],
      ["Utensílios de cozinha", "Kitchenware", "Ustensiles de cuisine"],
      ["Cama / Mesa / Banho", "Bedding & bath", "Literie et bain"],
      ["Decoração", "Decor", "Décoration"],
      ["Ferramentas", "Tools", "Outils"],
      ["Manutenção / Reparos", "Maintenance / Repairs", "Entretien / Réparations"],
      ["Organização / Armazenamento", "Storage / Organization", "Rangement"],
    ],
  },
  {
    name: ["Assinaturas", "Subscriptions", "Abonnements"],
    icon: "Repeat",
    color: "#6f7fe0",
    subs: [
      ["Streaming de vídeo", "Video streaming", "Streaming vidéo"],
      ["Streaming de música", "Music streaming", "Streaming musical"],
      ["Nuvem / Armazenamento", "Cloud storage", "Stockage infonuagique"],
      ["Software / Aplicativos", "Software / Apps", "Logiciels / Applications"],
      ["IA / Produtividade", "AI / Productivity", "IA / Productivité"],
      ["Notícias / Revistas", "News / Magazines", "Journaux / Magazines"],
      ["Academia (mensalidade)", "Gym membership", "Abonnement au gym"],
      ["Jogos", "Games", "Jeux"],
      ["Outras assinaturas", "Other subscriptions", "Autres abonnements"],
    ],
  },
  {
    name: ["Lazer", "Leisure", "Loisirs"],
    icon: "Ticket",
    color: "#d55181",
    subs: [
      ["Cinema / Teatro", "Movies / Theatre", "Cinéma / Théâtre"],
      ["Eventos / Shows", "Events / Concerts", "Événements / Spectacles"],
      ["Esportes / Ingressos", "Sports / Tickets", "Sports / Billets"],
      ["Hobbies", "Hobbies", "Loisirs créatifs"],
      ["Passeios / Parques", "Outings / Parks", "Sorties / Parcs"],
      ["Viagem / Hotel", "Travel / Hotels", "Voyages / Hôtels"],
      ["Presentes", "Gifts", "Cadeaux"],
      ["Livros / Jogos", "Books / Games", "Livres / Jeux"],
    ],
  },
  {
    name: ["Educação e carreira", "Education & career", "Éducation et carrière"],
    icon: "GraduationCap",
    color: "#8fa12a",
    subs: [
      ["Curso de inglês", "Language courses", "Cours de langue"],
      ["Curso técnico / Certificação", "Courses / Certifications", "Formations / Certifications"],
      ["Livros / Material", "Books / Supplies", "Livres / Fournitures"],
      ["Software educacional", "Learning software", "Logiciels éducatifs"],
      ["Networking / Eventos", "Networking / Events", "Réseautage / Événements"],
      ["Impressão de currículo", "Résumé printing", "Impression de CV"],
    ],
  },
  {
    name: ["Financeiro", "Financial", "Finances"],
    icon: "Landmark",
    color: "#a8744f",
    subs: [
      ["Impostos / Taxas", "Taxes / Fees", "Impôts / Taxes"],
      ["Seguro geral", "General insurance", "Assurance générale"],
      ["Tarifas bancárias", "Bank fees", "Frais bancaires"],
      ["Juros", "Interest", "Intérêts"],
    ],
  },
  {
    name: ["Outros", "Other", "Autres"],
    icon: "Package",
    color: "#6b6a72",
    subs: [
      ["Doações", "Donations", "Dons"],
      ["Multas", "Fines", "Amendes"],
      ["Envio de dinheiro à família", "Money sent to family", "Argent envoyé à la famille"],
      ["Imprevistos", "Unexpected", "Imprévus"],
      ["Reembolsável (a receber)", "Reimbursable", "Remboursable"],
      ["Não categorizado", "Uncategorized", "Non classé"],
    ],
  },
];

const IDX: Record<Locale, 0 | 1 | 2> = { pt: 0, en: 1, fr: 2 };

export function defaultCategories(locale: Locale): Category[] {
  const i = IDX[locale];
  return TEMPLATES.map((tpl, order) => ({
    name: tpl.name[i],
    icon: tpl.icon,
    color: tpl.color,
    order,
    subcategories: tpl.subs.map((s) => s[i]),
    archived: false,
  }));
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * A built-in category's name and subcategory names in `locale`, found by their name in any of
 * the three languages. null where a name isn't one of ours (a category or subcategory the user made).
 */
export function builtInTranslation(category: string, subcategories: string[], locale: Locale): { name: string | null; subcategories: (string | null)[] } {
  const i = IDX[locale];
  const tpl = TEMPLATES.find((t) => t.name.some((n) => same(n, category)));
  const findSub = (s: string) =>
    // its own category's list first, then any built-in (a default subcategory moved elsewhere)
    (tpl?.subs.find((names) => names.some((n) => same(n, s))) ?? TEMPLATES.flatMap((t) => t.subs).find((names) => names.some((n) => same(n, s))))?.[i] ?? null;
  return { name: tpl ? tpl.name[i] : null, subcategories: subcategories.map(findSub) };
}

/** Whether switching to `locale` leaves any built-in category or subcategory in another language. */
export function hasBuiltInTranslations(categories: { name: string; subcategories: string[] }[], locale: Locale): boolean {
  return categories.some((c) => {
    const tr = builtInTranslation(c.name, c.subcategories, locale);
    return (tr.name !== null && tr.name !== c.name) || tr.subcategories.some((s, i) => s !== null && s !== c.subcategories[i]);
  });
}

/** Look up a default category's look (icon + color) by any of its three names — used when importing. */
export function templateFor(name: string): { icon: string; color: string } | null {
  const n = name.trim().toLowerCase();
  const tpl = TEMPLATES.find((t) => t.name.some((x) => x.toLowerCase() === n));
  return tpl ? { icon: tpl.icon, color: tpl.color } : null;
}

/** Built-in payment methods: names in pt / en / fr (the IDX order) and their look. */
const PAYMENT_TEMPLATES: { names: [string, string, string]; icon: string; color: string }[] = [
  { names: ["Crédito", "Credit", "Crédit"], icon: "CreditCard", color: "#e0707a" },
  { names: ["Débito", "Debit", "Débit"], icon: "WalletCards", color: "#3987e5" },
  { names: ["Dinheiro", "Cash", "Comptant"], icon: "Banknote", color: "#199e70" },
  { names: ["Interac e-Transfer", "Interac e-Transfer", "Virement Interac"], icon: "ArrowLeftRight", color: "#c98500" },
  { names: ["Débito automático", "Pre-authorized debit", "Prélèvement automatique"], icon: "CalendarSync", color: "#9085e9" },
  { names: ["Pré-pago / Gift card", "Prepaid / Gift card", "Prépayée / Carte-cadeau"], icon: "Gift", color: "#d55181" },
  { names: ["Outro", "Other", "Autre"], icon: "CircleEllipsis", color: "#6b6a72" },
];

/** Icons offered for payment methods */
export const PAYMENT_ICONS = [
  "CreditCard", "WalletCards", "Banknote", "ArrowLeftRight", "CalendarSync", "Gift", "QrCode", "Smartphone",
  "Landmark", "Wallet", "Coins", "HandCoins", "PiggyBank", "Receipt", "Globe", "CircleEllipsis",
] as const;

// For methods the user typed in: an icon from words in the name (accents stripped). First match wins.
const PAYMENT_GUESSES: [RegExp, string][] = [
  [/\bpix\b|\bqr\b/, "QrCode"],
  [/autom|pre-?auth|prelevement|recorr/, "CalendarSync"],
  [/gift|cadeau|presente|pre-?pa|prepaid/, "Gift"],
  [/transfer|virement|\bted\b|wise|zelle/, "ArrowLeftRight"],
  [/credit|visa|master|amex|american express/, "CreditCard"],
  [/debit|cartao|card|carte/, "WalletCards"],
  [/cash|dinheiro|especes|comptant/, "Banknote"],
  [/pay\b|paypal|apple|google|samsung|wallet|carteira|portefeuille/, "Smartphone"],
  [/crypto|bitcoin|\bbtc\b/, "Coins"],
];

const paymentTemplate = (name: string) => PAYMENT_TEMPLATES.find((p) => p.names.some((n) => same(n, name)));

/** How a payment method looks: the user's pick, else the built-in look, else a guess from its name. */
export function paymentLook(name: string, styles?: Record<string, PaymentStyle>): PaymentStyle {
  const own = styles?.[name];
  if (own) return own;
  const tpl = paymentTemplate(name);
  if (tpl) return { icon: tpl.icon, color: tpl.color };
  const n = normalize(name);
  let hash = 0;
  for (const ch of n) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  // a stable colour per name, from the palette minus its gray
  return { icon: PAYMENT_GUESSES.find(([re]) => re.test(n))?.[1] ?? "Wallet", color: CATEGORY_COLORS[hash % (CATEGORY_COLORS.length - 1)] };
}

/** Built-in payment methods whose name reads differently in `locale` (the user's own are left alone). */
export function paymentTranslations(methods: string[], locale: Locale): { from: string; to: string }[] {
  return methods.flatMap((from) => {
    const to = paymentTemplate(from)?.names[IDX[locale]];
    return to && to !== from ? [{ from, to }] : [];
  });
}

/**
 * Bill or subscription, for recurring payments saved before the two were told apart:
 * the ones in the built-in Subscriptions category are subscriptions.
 */
export function guessKind(category: string): SubKind {
  return TEMPLATES.some((t) => t.icon === "Repeat" && t.name.some((n) => same(n, category))) ? "subscription" : "bill";
}

export function defaultSettings(locale: Locale): Settings {
  return {
    currency: "CAD",
    locale,
    reserve: 0,
    savingsGoal: 0,
    paymentMethods: PAYMENT_TEMPLATES.map((p) => p.names[IDX[locale]]),
    paymentStyles: {},
    warnAt: 0.85,
    checkInDay: 1,
  };
}

export function paymentsFor(locale: Locale): string[] {
  return PAYMENT_TEMPLATES.map((p) => p.names[IDX[locale]]);
}
