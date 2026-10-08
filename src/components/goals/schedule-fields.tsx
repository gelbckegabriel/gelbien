"use client";

import { goalSchedule, goalsWaitingFor } from "@/lib/goals";
import { useI18n, type Formatters } from "@/lib/i18n";
import type { Dataset, Goal } from "@/lib/types";
import { addMonths, cn, currentMonth } from "@/lib/utils";
import { Field, MonthField, Segmented, Select } from "../ui/form";

type ScheduleValue = Pick<Goal, "startMonth" | "afterGoalId" | "pausedMonths">;
type StartMode = "now" | "month" | "after";

/** The schedule part of a goal form; the start mode is its own field so switching back and forth keeps the choices. */
export interface ScheduleDraft extends ScheduleValue {
  mode: StartMode;
}

export function scheduleDraft(goal: ScheduleValue | null, now = currentMonth()): ScheduleDraft {
  const afterGoalId = goal?.afterGoalId ?? "";
  // a start month that has come is the same as starting now
  const startMonth = goal?.startMonth && goal.startMonth > now ? goal.startMonth : "";
  return { mode: afterGoalId ? "after" : startMonth ? "month" : "now", startMonth, afterGoalId, pausedMonths: goal?.pausedMonths ?? [] };
}

/** The draft as it's stored on the goal */
export function scheduleValue(d: ScheduleDraft): ScheduleValue {
  return {
    startMonth: d.mode === "month" ? d.startMonth : "",
    afterGoalId: d.mode === "after" ? d.afterGoalId : "",
    pausedMonths: [...d.pausedMonths].sort((a, b) => a - b),
  };
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const monthName = (f: Formatters, m: number) => f.monthShort(`2000-${String(m).padStart(2, "0")}`);

/** "Jul, Dec" */
export function monthList(f: Formatters, months: readonly number[]): string {
  return [...months]
    .sort((a, b) => a - b)
    .map((m) => monthName(f, m))
    .join(", ");
}

/** When a goal's contributions go in: from now, from a month, or once another goal is reached — minus months skipped every year. */
export function ScheduleFields({ ds, goalId, value, onChange }: { ds: Dataset; goalId: string | null; value: ScheduleDraft; onChange: (v: ScheduleDraft) => void }) {
  const { t, f } = useI18n();
  const now = currentMonth();
  const set = (patch: Partial<ScheduleDraft>) => onChange({ ...value, ...patch });

  // a goal can't wait for itself, or for one that (through others) is waiting for it
  const waiting = goalId ? goalsWaitingFor(ds.goals, goalId) : new Set<string>();
  const candidates = ds.goals.filter((g) => g.id !== goalId && !waiting.has(g.id));
  const other = value.mode === "after" ? ds.goals.find((g) => g.id === value.afterGoalId) : undefined;
  const start = other ? goalSchedule(ds, { id: goalId ?? "", ...scheduleValue(value) }).start : null;

  const pick = (mode: StartMode) =>
    set({
      mode,
      startMonth: mode === "month" && !value.startMonth ? addMonths(now, 1) : value.startMonth,
      afterGoalId: mode === "after" && !candidates.some((g) => g.id === value.afterGoalId) ? (candidates[0]?.id ?? "") : value.afterGoalId,
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("goals.f.schedule")}>
          <Segmented
            value={value.mode}
            onChange={pick}
            options={[
              { value: "now" as StartMode, label: t("goals.f.start.now") },
              { value: "month" as StartMode, label: t("goals.f.start.month") },
              // nothing to wait for without another goal
              ...(candidates.length || value.mode === "after" ? [{ value: "after" as StartMode, label: t("goals.f.start.after") }] : []),
            ]}
          />
        </Field>
        {value.mode === "month" && (
          <Field label={t("goals.f.startMonth")} className="animate-[rise-in-small_380ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none">
            <MonthField value={value.startMonth} min={addMonths(now, 1)} onChange={(m) => set(m ? { startMonth: m } : { mode: "now", startMonth: "" })} />
          </Field>
        )}
        {value.mode === "after" && (
          <Field label={t("goals.f.afterGoal")} className="animate-[rise-in-small_380ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none">
            <Select value={value.afterGoalId} onChange={(e) => set({ afterGoalId: e.target.value })}>
              {!other && <option value="">{t("goals.f.afterPick")}</option>}
              {candidates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.status === "active" ? g.name : `${g.name} (${t(`goals.status.${g.status}`)})`}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {other && (
        <p className={cn("-mt-1 text-xs", other.status === "paused" || start === null ? "text-warn" : "text-ink-3")}>
          {other.status === "paused"
            ? t("goals.f.afterPaused", { goal: other.name })
            : start === null
              ? t("goals.f.afterNever", { goal: other.name })
              : start <= now
                ? t("goals.f.afterReached", { goal: other.name })
                : t("goals.f.afterHint", { goal: other.name, date: f.monthLong(start) })}
        </p>
      )}

      <Field label={t("goals.f.skip")}>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {MONTHS.map((m) => {
            const off = value.pausedMonths.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={off}
                onClick={() => set({ pausedMonths: off ? value.pausedMonths.filter((x) => x !== m) : [...value.pausedMonths, m] })}
                className={cn(
                  "h-9 rounded-lg border text-xs transition-colors",
                  off ? "border-warn/40 bg-warn-soft text-warn line-through decoration-warn/60" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
                )}
              >
                {monthName(f, m)}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-ink-3">
          {value.pausedMonths.length ? t("goals.f.skipHint", { months: monthList(f, value.pausedMonths) }) : t("goals.f.skipNone")}
        </p>
      </Field>
    </div>
  );
}
