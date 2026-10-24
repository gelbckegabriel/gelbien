"use client";

import { AnimatePresence, motion, useDragControls, usePresence, useReducedMotion, type Variants } from "motion/react";
import { Dialog } from "radix-ui";
import { ChevronLeft, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EASE_OUT, coverRadius, tapOrigin } from "@/lib/motion";
import { useMediaQuery } from "@/lib/use-media";
import { cn } from "@/lib/utils";
import { CoinMark } from "../logo";

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
 * A popup: on phones a page of its own, on larger screens a centered dialog.
 *
 * Phones get the intro's curtain: two dark halves, led by gold edges, close in from the top and bottom,
 * meet along a seam where the coin pops — and part on the new page, there now as if navigated to.
 * Closing runs the curtain over it and parts it on the app again (a swipe down on its top bar just
 * lets it fall away). Larger screens: the dialog zooms in from the direction of what was clicked, a
 * gold wave crossing it from there (and a glow on the backdrop), and fades away softly.
 * Either way its title, fields and buttons then arrive one after another.
 *
 * Kept cheap so it stays smooth on phones: only transforms and opacity, run by the browser — the curtain
 * is CSS (.sheet-half & co. in globals.css), so it never stutters while the page renders under it — and
 * the backdrop blur is fixed (animating it re-blurs the whole screen every frame) and skipped on phones.
 */
export function Sheet(props: SheetProps) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <AnimatePresence>{props.open && <SheetLayer {...props} />}</AnimatePresence>
    </Dialog.Root>
  );
}

// How long the closing curtain runs (.sheet-run-close in globals.css: in, held at the seam, parted) —
// the popup stays mounted until it's done.
const CURTAIN_CLOSE_MS = 420;

function SheetLayer({ onOpenChange, title, description, children, footer, className, wide }: SheetProps) {
  const mobile = useMediaQuery("(max-width: 639px)");
  const reduce = useReducedMotion();
  const drag = useDragControls();
  const [present, safeToRemove] = usePresence();
  // set when it's swiped away: then it falls with the finger, no curtain (the ref for the closing
  // animation, worked out as it starts; the state for what renders)
  const swiped = useRef(false);
  const [fell, setFell] = useState(false);
  // Where it opens from, fixed when it mounts (larger screens): the click, else the centre — the dialog
  // zooms in from that side and the gold wave starts there (in the panel's own box).
  const [origin] = useState(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const p = tapOrigin() ?? { x: vw / 2, y: vh / 2 };
    return {
      p,
      x: `calc(50% + ${p.x - vw / 2}px)`,
      y: `calc(50% + ${p.y - vh / 2}px)`,
      // a quarter of the way from the click to the centre, where the zoom starts
      from: `translate(${Math.round((p.x - vw / 2) * 0.25)}px, ${Math.round((p.y - vh / 2) * 0.25)}px) scale(0.9)`,
      // the wave is a 160px glow: scaled until it reaches the farthest corner
      inkScale: Math.ceil((coverRadius(p) * 2) / 160),
    };
  });
  // The contents cascade in only as it opens (phones: as the curtain parts). A section that opens later
  // (a switch's details, say) would otherwise wait for its turn in the cascade, blank, then float up.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), 1600);
    return () => window.clearTimeout(id);
  }, []);
  // Larger screens: centred as it opens, then its top stays where it is — a section opening inside
  // grows it downwards (it moves up only to stay on screen), so the header and fields never jump.
  // (a callback ref: the portal renders the panel after this component's first layout pass)
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = panel;
    if (mobile || !el) return;
    const fit = () => {
      const vh = window.innerHeight;
      const margin = vh * 0.05; // what max-h-[90dvh] leaves above and below
      const h = el.offsetHeight;
      setTop((cur) => Math.max(margin, Math.min(cur ?? (vh - h) / 2, vh - margin - h)));
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [mobile, panel]);

  const curtain = mobile && !reduce;
  // the curtain's run: opening while it's here, closing once it's leaving (none after a swipe)
  const run = present ? "open" : curtain && !fell ? "close" : null;
  useEffect(() => {
    if (present) return;
    const id = window.setTimeout(safeToRemove, run === "close" ? CURTAIN_CLOSE_MS : 0);
    return () => window.clearTimeout(id);
  }, [present, run, safeToRemove]);
  // Named apart from "hidden"/"show": variant labels pass down to motion children, and cards inside use
  // those. A swipe is only known as it closes, hence a function.
  const panelMotion: Variants = reduce
    ? { sheetOff: { opacity: 0 }, sheetIn: { opacity: 1, transition: { duration: 0.16 } }, sheetAway: { opacity: 0, transition: { duration: 0.15 } } }
    : mobile
      ? { sheetOff: {}, sheetIn: {}, sheetAway: () => (swiped.current ? { y: "100%", transition: { type: "spring", stiffness: 420, damping: 40 } } : {}) }
      : {
          sheetOff: { opacity: 0, transform: origin.from },
          sheetIn: { opacity: 1, transform: "translate(0px, 0px) scale(1)", transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1], opacity: { duration: 0.22, ease: "easeOut" } } },
          sheetAway: { opacity: 0, transform: "translate(0px, 8px) scale(0.97)", transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
        };

  const closeButton = (
    <Dialog.Close
      className={cn("rounded-lg text-ink-3 transition hover:bg-white/5 hover:text-ink", mobile ? "-ml-1 grid h-10 w-10 place-items-center rounded-xl text-ink-2" : "-mr-1 p-1.5")}
      aria-label="Close"
    >
      {mobile ? <ChevronLeft className="h-6 w-6" /> : <X className="h-5 w-5" />}
    </Dialog.Close>
  );

  return (
    <Dialog.Portal forceMount>
      <Dialog.Overlay asChild forceMount>
        {/* While closing, the fading backdrop and panel stay mounted for the exit animation —
            they must not swallow the next tap (e.g. on the bottom nav). Radix puts an inline
            pointer-events: auto on the overlay, hence the !important. Phones' page covers
            everything, so there it's only there for Radix. */}
        <motion.div
          className={cn("fixed inset-0 z-50 data-[state=closed]:pointer-events-none!", !mobile && "bg-black/60 backdrop-blur-[6px]")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
        >
          {/* a flash of gold where it was opened from, settling into a faint glow */}
          {!reduce && !mobile && (
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
          // React's autoFocus scrolls, and fires while the popup is still arriving: iOS then scrolls
          // the body and pops the keyboard mid-animation. Focus without scrolling instead; on phones
          // focus the page itself so the keyboard only opens when a field is tapped. Fields opt in
          // with data-autofocus.
          const content = e.target as HTMLElement;
          const target = mobile ? content : content.querySelector<HTMLElement>("[data-autofocus]");
          if (!target) return;
          e.preventDefault();
          target.focus({ preventScroll: true });
        }}
        // a field that uses Escape itself (e.g. to cancel typing a value) keeps the popup open
        onEscapeKeyDown={(e) => {
          if ((e.target as HTMLElement | null)?.closest?.("[data-escape-local]")) e.preventDefault();
        }}
      >
        <motion.div
          ref={setPanel}
          className={cn(
            "fixed z-50 flex flex-col focus:outline-none data-[state=closed]:pointer-events-none",
            mobile
              ? // the page is there from the moment the curtain's halves meet, and goes when they meet again
                cn("inset-0 bg-bg", curtain && run && `sheet-page-${run}`)
              : cn(
                  // clip, not hidden: the gold wave starts at the click, which can be outside the dialog —
                  // an overflow-hidden box that wide gets scrolled sideways by focus, shifting everything left
                  "left-1/2 max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 overflow-clip rounded-3xl border border-line-strong bg-[#141418] shadow-2xl shadow-black/60",
                  top === null && "top-1/2 -translate-y-1/2",
                  wide ? "max-w-3xl" : "max-w-lg",
                ),
            className,
          )}
          // the zoom grows out of the side it was clicked from
          style={{ transformOrigin: mobile ? undefined : `${origin.x} ${origin.y}`, top: mobile || top === null ? undefined : top }}
          variants={panelMotion}
          initial="sheetOff"
          animate="sheetIn"
          exit="sheetAway"
          drag={mobile ? "y" : false}
          dragControls={drag}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 600) {
              swiped.current = true;
              setFell(true);
              onOpenChange(false);
            }
          }}
        >
          {mobile ? (
            <>
              <div className="app-aura" />
              {/* its own top bar, like any page's: back, and the title — pull it down to let the page fall away */}
              <div
                className="relative z-10 box-content flex h-14 shrink-0 touch-none items-center gap-1 border-b border-line/60 px-3 pt-[env(safe-area-inset-top)]"
                onPointerDown={(e) => drag.start(e)}
              >
                {closeButton}
                <Dialog.Title className="min-w-0 flex-1 truncate pr-2 text-[17px] font-semibold tracking-tight text-ink">{title}</Dialog.Title>
                {!description && <Dialog.Description className="sr-only">{title}</Dialog.Description>}
              </div>
              <div className={cn("relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-4", footer ? "pb-5" : "pb-[calc(env(safe-area-inset-bottom)+1.25rem)]")}>
                {description && <Dialog.Description className={cn("mb-4 text-sm text-ink-3 [--rise-delay:190ms]", !settled && "rise-once")}>{description}</Dialog.Description>}
                <div className={cn("[--rise-delay:220ms]", !settled && "rise-in")}>{children}</div>
              </div>
              {footer && (
                <div className={cn("relative z-10 border-t border-line px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 [--rise-delay:300ms]", !settled && "rise-in")}>
                  {footer}
                </div>
              )}
            </>
          ) : (
            <>
              {!reduce && <span aria-hidden className="sheet-ink" style={{ left: origin.x, top: origin.y, ["--ink-scale" as string]: origin.inkScale }} />}
              <div className={cn("flex items-start justify-between gap-4 px-6 pb-2 pt-6 [--rise-delay:70ms]", !settled && "rise-in")}>
                <div>
                  <Dialog.Title className="text-lg font-semibold tracking-tight text-ink">{title}</Dialog.Title>
                  {description ? (
                    <Dialog.Description className="mt-0.5 text-sm text-ink-3">{description}</Dialog.Description>
                  ) : (
                    <Dialog.Description className="sr-only">{title}</Dialog.Description>
                  )}
                </div>
                {closeButton}
              </div>
              <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-5 pt-2 [--rise-delay:110ms]", !settled && "rise-in")}>{children}</div>
              {footer && <div className={cn("border-t border-line px-6 py-4 [--rise-delay:210ms]", !settled && "rise-in")}>{footer}</div>}
            </>
          )}
        </motion.div>
      </Dialog.Content>
      {curtain && (
        <>
          {/* the curtain, over the page: its halves rest beyond the edges between runs */}
          <div aria-hidden className={cn("sheet-half sheet-half--top", run && `sheet-run-${run}`)} />
          <div aria-hidden className={cn("sheet-half sheet-half--bottom", run && `sheet-run-${run}`)} />
          <div aria-hidden className={cn("sheet-coin", run && `sheet-run-${run}`)}>
            <CoinMark className="relative h-full w-full" />
          </div>
        </>
      )}
    </Dialog.Portal>
  );
}
