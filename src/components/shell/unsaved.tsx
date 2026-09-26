"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { askToLeave, hasUnsaved, useUnsaved } from "@/lib/unsaved";
import { Button } from "../ui/button";
import { Sheet } from "../ui/sheet";

/** next/link that asks to save first when the current page has unsaved edits. */
export function GuardedLink({ href, onNavigate, ...props }: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <Link
      href={href}
      onNavigate={(e) => {
        onNavigate?.(e);
        if (href === path || !hasUnsaved()) return;
        e.preventDefault();
        askToLeave(() => router.push(href));
      }}
      {...props}
    />
  );
}

export function UnsavedDialog() {
  const { t } = useI18n();
  const guard = useUnsaved((s) => s.guard);
  const pending = useUnsaved((s) => s.pending);

  const stay = () => useUnsaved.setState({ pending: null });
  const leave = () => {
    useUnsaved.setState({ guard: null, pending: null });
    pending?.();
  };
  const save = () => (guard?.current.save() === false ? stay() : leave());

  return (
    <Sheet
      open={!!guard && !!pending}
      onOpenChange={(open) => !open && stay()}
      title={t("unsaved.title")}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button variant="ghost" onClick={stay}>
            {t("unsaved.stay")}
          </Button>
          <Button variant="secondary" onClick={leave} className="sm:ml-auto">
            {t("unsaved.discard")}
          </Button>
          <Button variant="primary" onClick={save}>
            {t("unsaved.save")}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-2">{t("unsaved.body")}</p>
    </Sheet>
  );
}
