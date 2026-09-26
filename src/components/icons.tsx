"use client";

import {
  Baby, Banknote, Bike, BookOpen, Briefcase, Bus, Car, Coffee, CreditCard, Dumbbell, FileText, Gamepad2, Gem, Gift, Globe,
  GraduationCap, HeartPulse, Home, Landmark, Laptop, Music, Package, PawPrint, PiggyBank, Plane, Repeat, ShoppingCart, Shirt,
  Smartphone, Sofa, Sparkles, Target, Ticket, TrendingUp, Umbrella, UtensilsCrossed, Wallet, Wrench, Zap, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ICONS: Record<string, LucideIcon> = {
  Home, Zap, ShoppingCart, UtensilsCrossed, Bus, HeartPulse, Shirt, Sofa, Repeat, Ticket, GraduationCap, Landmark,
  Package, PawPrint, Plane, Gift, Baby, Car, Dumbbell, Coffee, Smartphone, Wallet, Briefcase, FileText, Music,
  Gamepad2, BookOpen, Wrench, PiggyBank, CreditCard, Globe, Sparkles, Target, Umbrella, Laptop, Gem, Bike, TrendingUp,
  Banknote,
};

export const ACCOUNT_TYPE_ICON = {
  chequing: "Wallet",
  savings: "PiggyBank",
  investment: "TrendingUp",
  credit: "CreditCard",
  cash: "Banknote",
  other: "Landmark",
} as const;

export function CategoryIcon({ icon, color, size = "md", className }: { icon: string; color: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = ICONS[icon] ?? Package;
  const box = { sm: "h-7 w-7 rounded-lg", md: "h-9 w-9 rounded-xl", lg: "h-11 w-11 rounded-2xl" }[size];
  const glyph = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" }[size];
  return (
    <span
      className={cn("grid shrink-0 place-items-center border", box, className)}
      style={{ background: `${color}22`, borderColor: `${color}40`, color }}
    >
      <Icon className={glyph} strokeWidth={2} />
    </span>
  );
}
