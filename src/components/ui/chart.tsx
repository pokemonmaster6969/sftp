import * as React from "react"
import { Tooltip, type TooltipProps } from "recharts"

import { cn } from "../../lib/utils"

type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
  }
>

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config?: ChartConfig
  }
>(({ className, children, config, ...props }, ref) => {
  const style = React.useMemo(() => {
    if (!config) return undefined

    const vars: Record<string, string> = {}
    for (const [key, value] of Object.entries(config)) {
      if (value?.color) vars[`--color-${key}`] = value.color
    }
    return vars as React.CSSProperties
  }, [config])

  return (
    <div
      ref={ref}
      className={cn(
        "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-curve.recharts-line-curve]:stroke-[3] [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:overflow-visible",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </div>
  )
})
ChartContainer.displayName = "ChartContainer"

function getPayloadConfig(
  config: ChartConfig | undefined,
  payload: unknown
): { label?: React.ReactNode; color?: string } | undefined {
  if (!config) return undefined
  if (!payload || typeof payload !== "object") return undefined

  const p = payload as Record<string, unknown>
  const key = (p.dataKey ?? p.name ?? p.key) as string | undefined
  if (!key) return undefined

  return config[key]
}

const ChartTooltip = Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    TooltipProps<number, string> & {
      indicator?: "dot" | "line"
      hideLabel?: boolean
      nameKey?: string
      labelKey?: string
      config?: ChartConfig
    }
>(
  (
    {
      active,
      payload,
      label,
      className,
      indicator = "dot",
      hideLabel,
      nameKey,
      labelKey,
      config,
      ...props
    },
    ref
  ) => {
    if (!active || !payload?.length) return null

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs text-foreground shadow-xl",
          className
        )}
        {...props}
      >
        {!hideLabel && label != null && (
          <div className="text-[11px] font-medium text-muted-foreground">
            {label}
          </div>
        )}

        <div className="grid gap-1.5">
          {payload.map((item: any, index: number) => {
            const itemName =
              (nameKey ? (item as any)?.payload?.[nameKey] : item.name) ??
              item.dataKey ??
              ""

            const itemLabel =
              (labelKey ? (item as any)?.payload?.[labelKey] : undefined) ??
              getPayloadConfig(config, item)?.label ??
              itemName

            const color =
              getPayloadConfig(config, item)?.color ??
              (item as any)?.payload?.fill ??
              item.color ??
              "hsl(var(--foreground))"

            return (
              <div key={index} className="flex items-center gap-2">
                {indicator === "dot" ? (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="h-0.5 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                )}

                <div className="flex flex-1 items-center justify-between gap-3">
                  <span className="text-muted-foreground truncate">
                    {itemLabel}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {item.value}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

export { ChartContainer, ChartTooltip, ChartTooltipContent }
export type { ChartConfig }
