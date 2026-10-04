"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

// Cards cascade onto every page, each rising into place with a soft spring. A whole `transform` (not
// motion's separate y/scale) so motion hands it to the browser to run on the compositor: smooth even
// while the page is still rendering, and nothing left behind once it settles.
export const fadeUp = {
  hidden: { opacity: 0, transform: "translateY(22px)" },
  show: { opacity: 1, transform: "none", transition: { type: "spring" as const, stiffness: 300, damping: 26, opacity: { duration: 0.3 } } },
};

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.06 } },
};

export function Card({ className, children, ...props }: HTMLMotionProps<"section">) {
  return (
    <motion.section variants={fadeUp} className={cn("card relative overflow-hidden p-5", className)} {...props}>
      {children}
    </motion.section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2", className)}>
      <div className="min-w-0 flex-[1_1_12rem]">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Cards 1 → 2 → 3 per row. Unlike a CSS grid, a row that isn't full stretches its cards to use the
 * whole width (two cards on a three-wide row get half each). Rows keep equal-height cards.
 */
export function FillGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-wrap gap-4 *:min-w-0 *:grow *:basis-full sm:*:basis-[calc(50%-0.5rem)] xl:*:basis-[calc((100%-2rem)/3)]", className)}>
      {children}
    </div>
  );
}

/** Page wrapper that staggers its direct Card children in. */
export function Stagger({ className, children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className={className} {...props}>
      {children}
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
