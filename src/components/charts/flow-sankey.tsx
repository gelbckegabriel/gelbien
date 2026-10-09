"use client";

import { Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip, type SankeyLinkProps, type SankeyNodeProps } from "recharts";
import { moneyFlow, type MonthSummary } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { BAD, ChartArea, ChartCard, DataTable, GOLD, GOOD, INK, TooltipBox } from "./kit";

interface FlowNode {
  name: string;
  color: string;
  value?: number;
}

export function FlowSankey({ summary, className }: { summary: MonthSummary; className?: string }) {
  const { t, f } = useI18n();
  const flow = moneyFlow(summary, 7);

  if (!flow) {
    return (
      <ChartCard viewKey="dash.flow" className={className} title={t("dash.flow.title")} subtitle={t("dash.flow.subtitle")}>
        <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-ink-3">{t("dash.flow.noIncome")}</p>
      </ChartCard>
    );
  }

  const label = (n: string) => (n === "__other__" ? t("common.rest") : n);
  const nodes: FlowNode[] = [{ name: t("dash.flow.income"), color: GOOD }];
  if (flow.deficit > 0) nodes.push({ name: t("dash.flow.deficit"), color: BAD });
  const firstCat = nodes.length;
  for (const c of flow.categories) nodes.push({ name: label(c.name), color: c.color });
  if (flow.saved > 0) nodes.push({ name: t("dash.flow.saved"), color: GOLD });

  const links: { source: number; target: number; value: number }[] = [];
  const incomeShare = flow.deficit > 0 ? flow.income / flow.total : 1;
  flow.categories.forEach((c, i) => {
    links.push({ source: 0, target: firstCat + i, value: c.value * incomeShare });
    if (flow.deficit > 0) links.push({ source: 1, target: firstCat + i, value: c.value * (1 - incomeShare) });
  });
  if (flow.saved > 0) links.push({ source: 0, target: nodes.length - 1, value: flow.saved });

  const tableRows = [
    ...flow.categories.map((c) => [label(c.name), f.money(c.value)]),
    ...(flow.saved > 0 ? [[t("dash.flow.saved"), f.money(flow.saved)]] : []),
    ...(flow.deficit > 0 ? [[t("dash.flow.deficit"), f.money(flow.deficit)]] : []),
  ];

  return (
    <ChartCard viewKey="dash.flow"
      className={className}
      title={t("dash.flow.title")}
      subtitle={t("dash.flow.subtitle")}
      table={<DataTable head={["", t("exp.col.amount")]} rows={tableRows} />}
    >
      <ChartArea min="min-h-72">
        <ResponsiveContainer>
          <Sankey
            data={{ nodes, links }}
            nodePadding={14}
            nodeWidth={10}
            iterations={0}
            margin={{ top: 8, bottom: 8, left: 4, right: 4 }}
            link={(props: SankeyLinkProps) => (
              <path
                d={`M${props.sourceX},${props.sourceY}C${props.sourceControlX},${props.sourceY} ${props.targetControlX},${props.targetY} ${props.targetX},${props.targetY}`}
                fill="none"
                stroke={(props.payload.target as unknown as FlowNode).color}
                strokeOpacity={0.28}
                strokeWidth={Math.max(1, props.linkWidth)}
                className="transition-[stroke-opacity] duration-200 hover:[stroke-opacity:0.55]"
              />
            )}
            node={(props: SankeyNodeProps) => {
              const node = props.payload as unknown as FlowNode & { value: number; depth: number };
              const left = node.depth === 0;
              return (
                <Layer>
                  <Rectangle x={props.x} y={props.y} width={props.width} height={props.height} fill={node.color} radius={3} />
                  {props.height > 9 && (
                    <text
                      x={left ? props.x + props.width + 8 : props.x - 8}
                      y={props.y + props.height / 2}
                      textAnchor={left ? "start" : "end"}
                      dominantBaseline="middle"
                      fontSize={11}
                      fill={INK.secondary}
                    >
                      <tspan>{node.name}</tspan>
                      <tspan dx={5} fill={INK.primary} fontWeight={600}>
                        {f.amount(node.value)}
                      </tspan>
                    </text>
                  )}
                </Layer>
              );
            }}
          >
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0].payload as { source?: FlowNode; target?: FlowNode; name?: string; color?: string; value?: number };
                const title = item.source && item.target ? `${item.source.name} → ${item.target.name}` : item.name;
                return <TooltipBox title={title} rows={[{ label: "", value: f.money(Number(payload[0].value)), color: item.target?.color ?? item.color, kind: "rect" }]} />;
              }}
            />
          </Sankey>
        </ResponsiveContainer>
      </ChartArea>
    </ChartCard>
  );
}
