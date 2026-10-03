"use client";

import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useState } from "react";
import { EASE_OUT, revealFrom, tapOrigin } from "@/lib/motion";
import { useMediaQuery } from "@/lib/use-media";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  wide?: boolean;
}

/**
 * Modal that is a draggable bottom sheet on phones and a centered dialog on larger screens. It unfolds
 * from what was tapped to open it (a growing circle, with a glow there on the backdrop), then its
 * title, fields and buttons arrive one after another.
 */
export function Sheet(props: SheetProps) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <AnimatePresence>{props.open && <SheetLayer {...props} />}</AnimatePresence>
    </Dialog.Root>
  );
}

function SheetLayer({ onOpenChange, title, description, children, footer, className, wide }: SheetProps) {
  const mobile = useMediaQuery("(max-width: 639px)");
  const reduce = useReducedMotion();
  const drag = useDragControls();
  // Where it opens from, fixed when it mounts: the tap, else the bottom edge (phones) or the centre.
  // In the panel's own box: phones' sheet is pinned to the bottom of the screen, larger screens' centred.
  const [origin] = useState(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const p = tapOrigin() ?? (mobile ? { x: vw / 2, y: vh } : { x: vw / 2, y: vh / 2 });
    const at = mobile ? `${p.x}px calc(100% - ${vh - p.y}px)` : `calc(50% + ${p.x - vw / 2}px) calc(50% + ${p.y - vh / 2}px)`;
    return { p, at, ...revealFrom(p, at) };
  });

  const panel = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : mobile
      ? {
          initial: { y: 48, clipPath: origin.from },
          animate: { y: 0, clipPath: origin.to },
          exit: { y: "100%", transition: { type: "spring" as const, stiffness: 420, damping: 40 } },
        }
      : {
          initial: { opacity: 0, scale: 0.88, x: "-50%", y: "-48%", clipPath: origin.from },
          animate: { opacity: 1, scale: 1, x: "-50%", y: "-50%", clipPath: origin.to },
          exit: { opacity: 0, scale: 0.96, x: "-50%", y: "-49%", transition: { duration: 0.16, ease: "easeIn" as const } },
        };

  return (
    <Dialog.Portal forceMount>
      <Dialog.Overlay asChild forceMount>
        {/* While closing, the fading backdrop and panel stay mounted for the exit animation —
            they must not swallow the next tap (e.g. on the bottom nav). Radix puts an inline
            pointer-events: auto on the overlay, hence the !important. */}
        <motion.div
          className="fixed inset-0 z-50 bg-black/60 data-[state=closed]:pointer-events-none!"
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(6px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          {/* a flash of gold where it was opened from, settling into a faint glow */}
          {!reduce && (
            <motion.div
              aria-hidden
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at ${origin.p.x}px ${origin.p.y}px, #d9b45f33, transparent 42%)` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.35] }}
              transition={{ duration: 0.9, times: [0, 0.3, 1], ease: "easeOut" }}
            />
          )}
        </motion.div>
      </Dialog.Overlay>
      <Dialog.Content
        asChild
        forceMount
        onOpenAutoFocus={(e) => {
          // React's autoFocus scrolls, and fires while the sheet is still sliding in from off-screen:
          // iOS then scrolls the body to the bottom and pops the keyboard mid-animation.
          // Focus without scrolling instead; on phones focus the sheet itself so the keyboard
          // only opens when a field is tapped. Fields opt in with data-autofocus.
          const content = e.target as HTMLElement;
          const target = mobile ? content : content.querySelector<HTMLElement>("[data-autofocus]");
          if (!target) return;
          e.preventDefault();
          target.focus({ preventScroll: true });
        }}
        // a field that uses Escape itself (e.g. to cancel typing a value) keeps the sheet open
        onEscapeKeyDown={(e) => {
          if ((e.target as HTMLElement | null)?.closest?.("[data-escape-local]")) e.preventDefault();
        }}
      >
        <motion.div
          className={cn(
            "fixed z-50 flex flex-col border border-line-strong bg-[#141418] shadow-2xl shadow-black/60 focus:outline-none data-[state=closed]:pointer-events-none",
            mobile
              ? "inset-x-0 bottom-0 max-h-[94dvh] rounded-t-[28px] pb-[env(safe-area-inset-bottom)]"
              : cn("left-1/2 top-1/2 max-h-[90dvh] w-[calc(100vw-2rem)] rounded-3xl", wide ? "max-w-3xl" : "max-w-lg"),
            className,
          )}
          // the panel grows towards the tap, not from its own centre
          style={mobile ? { transformOrigin: origin.at } : { x: "-50%", y: "-50%", transformOrigin: origin.at }}
          {...panel}
          transition={{
            default: { type: "spring", stiffness: 380, damping: mobile ? 34 : 30 },
            opacity: { duration: 0.18 },
            clipPath: { duration: mobile ? 0.55 : 0.6, ease: EASE_OUT },
          }}
          drag={mobile ? "y" : false}
          dragControls={drag}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 600) onOpenChange(false);
          }}
        >
          {mobile && (
            <div className="flex cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing" onPointerDown={(e) => drag.start(e)}>
              <div className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>
          )}
          <div className="rise-in flex items-start justify-between gap-4 px-5 pb-2 pt-3 [--rise-delay:40ms] sm:px-6 sm:pt-6" onPointerDown={(e) => mobile && drag.start(e)}>
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-tight text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-ink-3">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="-mr-1 rounded-lg p-1.5 text-ink-3 transition hover:bg-white/5 hover:text-ink" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="rise-in min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-5 pt-2 sm:px-6">{children}</div>
          {footer && <div className="rise-in border-t border-line px-5 py-4 [--rise-delay:260ms] sm:px-6">{footer}</div>}
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
