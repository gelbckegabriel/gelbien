import type { Category, Locale, Settings } from "./types";

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

/** Look up a default category's look (icon + color) by any of its three names — used when importing. */
export function templateFor(name: string): { icon: string; color: string } | null {
  const n = name.trim().toLowerCase();
  const tpl = TEMPLATES.find((t) => t.name.some((x) => x.toLowerCase() === n));
  return tpl ? { icon: tpl.icon, color: tpl.color } : null;
}

const PAYMENTS: Record<Locale, string[]> = {
  pt: ["Crédito", "Débito", "Dinheiro", "Interac e-Transfer", "Débito automático", "Pré-pago / Gift card", "Outro"],
  en: ["Credit", "Debit", "Cash", "Interac e-Transfer", "Pre-authorized debit", "Prepaid / Gift card", "Other"],
  fr: ["Crédit", "Débit", "Comptant", "Virement Interac", "Prélèvement automatique", "Prépayée / Carte-cadeau", "Autre"],
};

export function defaultSettings(locale: Locale): Settings {
  return {
    currency: "CAD",
    locale,
    reserve: 0,
    savingsGoal: 0,
    paymentMethods: PAYMENTS[locale],
    warnAt: 0.85,
    checkInDay: 1,
  };
}

export function paymentsFor(locale: Locale): string[] {
  return PAYMENTS[locale];
}
