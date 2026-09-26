"use client";

import { ClipboardCheck, Plus, Target } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckInBanner } from "@/components/goals/checkin-banner";
import { AccountDialog, AddMoneyDialog, CheckInDialog, GoalDialog } from "@/components/goals/dialogs";
import { GoalCard } from "@/components/goals/goal-card";
import { AccountsCard, NetWorthCard, PlanCard } from "@/components/goals/overview";
import { Simulator } from "@/components/goals/simulator";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, Stagger } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { useDataset } from "@/lib/data/hooks";
import { goalPlanFor } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import type { Account, Dataset, Goal } from "@/lib/types";

type Dialog =
  | { kind: "goal"; goal: Goal | null }
  | { kind: "simulate"; goal: Goal }
  | { kind: "addMoney"; goal: Goal }
  | { kind: "account"; account: Account | null }
  | { kind: "checkin" };

export default function GoalsPage() {
  return (
    <Suspense>
      <Goals />
    </Suspense>
  );
}

function Goals() {
  const ds = useDataset().data as Dataset;
  const { t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(() => (params.get("checkin") ? { kind: "checkin" } : null));
  // Separate counter so each dialog opening starts from fresh form state.
  const [nonce, setNonce] = useState(0);
  const open = (d: Dialog) => {
    setNonce((n) => n + 1);
    setDialog(d);
  };
  const close = () => setDialog(null);

  // /goals?checkin=1 (from the reminder banner or the calendar event) opens the check-in once.
  useEffect(() => {
    if (params.get("checkin")) router.replace("/goals");
  }, [params, router]);

  const rank = { active: 0, paused: 1, achieved: 2 } as const;
  const goals = [...ds.goals]
    .map((g) => ({ goal: g, plan: goalPlanFor(ds, g) }))
    .sort((a, b) => rank[a.plan.achieved ? "achieved" : a.goal.status] - rank[b.plan.achieved ? "achieved" : b.goal.status] || a.goal.order - b.goal.order);
  const hasAccounts = ds.accounts.some((a) => !a.archived);

  return (
    <div>
      <PageHeader
        title={t("goals.title")}
        subtitle={t("goals.subtitle")}
        action={
          <>
            {hasAccounts && (
              <Button size="sm" variant="ghost" onClick={() => open({ kind: "checkin" })}>
                <ClipboardCheck className="h-4 w-4" /> {t("ci.button")}
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={() => open({ kind: "goal", goal: null })}>
              <Plus className="h-4 w-4" /> {t("goals.new")}
            </Button>
          </>
        }
      />

      <CheckInBanner ds={ds} onUpdate={() => open({ kind: "checkin" })} className="mb-4" />

      <Stagger className="space-y-4">
        {goals.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Target className="h-6 w-6" />}
              title={t("goals.empty.title")}
              body={t("goals.empty.body")}
              action={
                <Button variant="primary" onClick={() => open({ kind: "goal", goal: null })}>
                  <Plus className="h-4 w-4" /> {t("goals.new")}
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            {/* Equal-height cards: each card fills its grid row */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {goals.map(({ goal, plan }, i) => (
                <GoalCard
                  key={goal.id}
                  index={i}
                  goal={goal}
                  plan={plan}
                  accounts={ds.accounts}
                  onEdit={() => open({ kind: "goal", goal })}
                  onSimulate={() => open({ kind: "simulate", goal })}
                  onAddMoney={() => open({ kind: "addMoney", goal })}
                />
              ))}
            </div>
            <PlanCard ds={ds} />
          </>
        )}

        {/* The account list sets the row height; the chart stretches to match. */}
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7 xl:col-span-8">
            <NetWorthCard ds={ds} className="h-full" />
          </div>
          <div className="lg:col-span-5 xl:col-span-4">
            <AccountsCard
              ds={ds}
              className="h-full"
              onAdd={() => open({ kind: "account", account: null })}
              onEdit={(id) => open({ kind: "account", account: ds.accounts.find((a) => a.id === id) ?? null })}
              onCheckIn={() => open({ kind: "checkin" })}
            />
          </div>
        </div>
      </Stagger>

      <GoalDialog key={`g${nonce}`} ds={ds} open={dialog?.kind === "goal"} goal={dialog?.kind === "goal" ? dialog.goal : null} onClose={close} />
      <Simulator ds={ds} open={dialog?.kind === "simulate"} goal={dialog?.kind === "simulate" ? dialog.goal : null} onClose={close} />
      <AddMoneyDialog key={`m${nonce}`} open={dialog?.kind === "addMoney"} goal={dialog?.kind === "addMoney" ? dialog.goal : null} onClose={close} />
      <AccountDialog key={`a${nonce}`} ds={ds} open={dialog?.kind === "account"} account={dialog?.kind === "account" ? dialog.account : null} onClose={close} />
      {hasAccounts && <CheckInDialog key={`c${nonce}`} ds={ds} open={dialog?.kind === "checkin"} onClose={close} />}
    </div>
  );
}
