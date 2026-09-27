"use client";

import { AnimatePresence, motion, useDragControls } from "motion/react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useMediaQuery } from "@/lib/use-media";
import { cn } from "@/lib/utils";

/**
 * Modal that is a draggable bottom sheet on phones and a centered dialog on larger screens.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const mobile = useMediaQuery("(max-width: 639px)");
  const drag = useDragControls();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              {/* While closing, the fading backdrop and panel stay mounted for the exit animation —
                  they must not swallow the next tap (e.g. on the bottom nav). Radix puts an inline
                  pointer-events: auto on the overlay, hence the !important. */}
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[6px] data-[state=closed]:pointer-events-none!"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={description ? undefined : undefined}
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
            >
              <motion.div
                className={cn(
                  "fixed z-50 flex flex-col border border-line-strong bg-[#141418] shadow-2xl shadow-black/60 focus:outline-none data-[state=closed]:pointer-events-none",
                  mobile
                    ? "inset-x-0 bottom-0 max-h-[94dvh] rounded-t-[28px] pb-[env(safe-area-inset-bottom)]"
                    : cn("left-1/2 top-1/2 max-h-[90dvh] w-[calc(100vw-2rem)] rounded-3xl", wide ? "max-w-3xl" : "max-w-lg"),
                  className,
                )}
                style={mobile ? undefined : { x: "-50%", y: "-50%" }}
                initial={mobile ? { y: "100%" } : { opacity: 0, scale: 0.95, x: "-50%", y: "-46%" }}
                animate={mobile ? { y: 0 } : { opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                exit={mobile ? { y: "100%" } : { opacity: 0, scale: 0.97, x: "-50%", y: "-48%" }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
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
                <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-3 sm:px-6 sm:pt-6" onPointerDown={(e) => mobile && drag.start(e)}>
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
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-5 pt-2 sm:px-6">{children}</div>
                {footer && <div className="border-t border-line px-5 py-4 sm:px-6">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
