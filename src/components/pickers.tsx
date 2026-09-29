"use client";

import { LayoutGrid } from "lucide-react";
import { paymentLook } from "@/lib/defaults";
import type { Category, PaymentStyle } from "@/lib/types";
import { CategoryIcon } from "./icons";
import { RichSelect } from "./ui/form";

interface Common {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

// the "all …" option of a filter
const allIcon = (
  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-3 text-ink-3">
    <LayoutGrid className="h-3.5 w-3.5" />
  </span>
);

/** Category picker with each category's icon and colour. `allLabel` adds an "all categories" option (filters). */
export function CategorySelect({ categories, allLabel, ...props }: Common & { categories: Category[]; allLabel?: string }) {
  return (
    <RichSelect
      {...props}
      options={categories.map((c) => ({ value: c.name, label: c.name, icon: <CategoryIcon icon={c.icon} color={c.color} size="sm" /> }))}
      noneLabel={allLabel}
      noneIcon={allIcon}
    />
  );
}

// the same width as a small CategoryIcon, so a subcategory field lines up under its category
const dot = (color?: string) => (
  <span className="grid w-7 shrink-0 place-items-center">
    <span className="h-2 w-2 rounded-full border" style={color ? { background: color, borderColor: color } : { borderColor: "#6b6a72" }} />
  </span>
);

/** Subcategories of one category, marked with its colour. `anyLabel` is the "none in particular" option. */
export function SubcategorySelect({ category, anyLabel, ...props }: Common & { category: Category; anyLabel: string }) {
  return <RichSelect {...props} options={category.subcategories.map((s) => ({ value: s, label: s, icon: dot(category.color) }))} noneLabel={anyLabel} noneIcon={dot()} />;
}

/** A payment method's icon: the look picked on the Categories page, or the built-in one. */
export function PaymentIcon({ name, styles, size = "sm", className }: { name: string; styles: Record<string, PaymentStyle>; size?: "sm" | "md" | "lg"; className?: string }) {
  const look = paymentLook(name, styles);
  return <CategoryIcon icon={look.icon} color={look.color} size={size} className={className} />;
}

/** Payment method picker. `allLabel` adds an "all payment methods" option (filters). */
export function PaymentSelect({ methods, styles, allLabel, ...props }: Common & { methods: string[]; styles: Record<string, PaymentStyle>; allLabel?: string }) {
  return (
    <RichSelect
      {...props}
      options={methods.map((m) => ({ value: m, label: m, icon: <PaymentIcon name={m} styles={styles} /> }))}
      noneLabel={allLabel}
      noneIcon={allIcon}
    />
  );
}
