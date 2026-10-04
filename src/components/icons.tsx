"use client";

import {
  Activity, Anchor, Apple, Armchair, ArrowLeftRight, Baby, Backpack, BadgeDollarSign, Bandage, Banknote, Bath, Bed, Beef, Beer,
  Bike, Bird, Bone, BookOpen, Brain, Briefcase, Building2, Bus, Cake, Calculator, CalendarSync, Camera, Candy, Car, CarFront,
  CarTaxiFront, Caravan, Carrot, Cat, ChefHat, Cigarette, CircleEllipsis, Clapperboard, Cloud, Coffee, Coins, Compass, Cookie,
  CreditCard, Croissant, CupSoda, Dices, Dog, Drama, Droplets, Dumbbell, Egg, Eye, FileText, Film, Fish, Flame, Flower2,
  Footprints, Fuel, Gamepad2, Gem, Gift, Glasses, Globe, GraduationCap, Hammer, HandCoins, HandHeart, Headphones, Heart,
  HeartPulse, Home, Hotel, IceCreamCone, KeyRound, Lamp, Landmark, Laptop, Leaf, Library, Lightbulb, Luggage, MapPin, Martini,
  Milk, Monitor, Motorbike, Mountain, Music, Package, Palette, Palmtree, PartyPopper, PawPrint, Percent, PiggyBank, Pill, Pizza,
  Plane, Plug, Popcorn, QrCode, Rabbit, Receipt, Recycle, Repeat, Rocket, Salad, Sandwich, Scale, School, Scissors, ShieldCheck,
  Ship, Shirt, ShoppingBag, ShoppingBasket, ShoppingCart, Smartphone, Smile, Snowflake, Sofa, Soup, Sparkles, Sprout,
  SquareParking, Star, Stethoscope, Store, Sun, Syringe, Tag, Target, Tent, Ticket, ToyBrick, TrainFront, Trees, TrendingUp,
  Trophy, Truck, Tv, Umbrella, Users, UtensilsCrossed, Volleyball, Wallet, WalletCards, Watch, Wifi, Wine, Wrench, Zap, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Every icon a category, goal, payment method or account can use, by the name stored in the sheet.
// Names are only ever added: removing one would blank out the icon of whoever picked it.
export const ICONS: Record<string, LucideIcon> = {
  Activity, Anchor, Apple, Armchair, ArrowLeftRight, Baby, Backpack, BadgeDollarSign, Bandage, Banknote, Bath, Bed, Beef, Beer,
  Bike, Bird, Bone, BookOpen, Brain, Briefcase, Building2, Bus, Cake, Calculator, CalendarSync, Camera, Candy, Car, CarFront,
  CarTaxiFront, Caravan, Carrot, Cat, ChefHat, Cigarette, CircleEllipsis, Clapperboard, Cloud, Coffee, Coins, Compass, Cookie,
  CreditCard, Croissant, CupSoda, Dices, Dog, Drama, Droplets, Dumbbell, Egg, Eye, FileText, Film, Fish, Flame, Flower2,
  Footprints, Fuel, Gamepad2, Gem, Gift, Glasses, Globe, GraduationCap, Hammer, HandCoins, HandHeart, Headphones, Heart,
  HeartPulse, Home, Hotel, IceCreamCone, KeyRound, Lamp, Landmark, Laptop, Leaf, Library, Lightbulb, Luggage, MapPin, Martini,
  Milk, Monitor, Motorbike, Mountain, Music, Package, Palette, Palmtree, PartyPopper, PawPrint, Percent, PiggyBank, Pill, Pizza,
  Plane, Plug, Popcorn, QrCode, Rabbit, Receipt, Recycle, Repeat, Rocket, Salad, Sandwich, Scale, School, Scissors, ShieldCheck,
  Ship, Shirt, ShoppingBag, ShoppingBasket, ShoppingCart, Smartphone, Smile, Snowflake, Sofa, Soup, Sparkles, Sprout,
  SquareParking, Star, Stethoscope, Store, Sun, Syringe, Tag, Target, Tent, Ticket, ToyBrick, TrainFront, Trees, TrendingUp,
  Trophy, Truck, Tv, Umbrella, Users, UtensilsCrossed, Volleyball, Wallet, WalletCards, Watch, Wifi, Wine, Wrench, Zap,
};

export const ACCOUNT_TYPE_ICON = {
  chequing: "Wallet",
  savings: "PiggyBank",
  investment: "TrendingUp",
  cash: "Banknote",
  property: "Home",
  other: "Landmark",
  credit: "CreditCard",
  lineOfCredit: "HandCoins",
  loan: "BadgeDollarSign",
  mortgage: "KeyRound",
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
