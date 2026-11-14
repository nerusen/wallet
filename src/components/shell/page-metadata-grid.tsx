import * as React from "react";

import { cn } from "@/lib/utils";

export interface PageMetadataItem {
  label: string;
  value: string;
}

/**
 * Page metadata strip.
 *
 * Replaces the previous `flex flex-wrap` + `min-w-[9rem]` + unconditional
 * `border-l` approach, which produced three distinct defects on narrow
 * viewports because the column count was derived from available width rather
 * than declared:
 *
 *   • 375–430px → wrapped 2+2 with NO horizontal rule between the rows, plus a
 *     stray `border-l` stub on the first cell of row 2.
 *   • 432–639px → wrapped 3+1, orphaning the 4th cell.
 *
 * An explicit `grid-cols-2 sm:grid-cols-4` makes the column count
 * deterministic — a symmetrical 2×2 on mobile, a single 1×4 row from `sm` up —
 * and each cell then derives its rules from its own index, so every 1px border
 * meets its neighbour edge-to-edge at every breakpoint.
 *
 * Borders are drawn as *separators*, never as outer edges: a cell gets a right
 * rule only when a cell actually sits to its right, and a bottom rule only
 * when a row sits below it. That keeps the strip correct for counts other than
 * four (all eight pages pass four today) without leaving dangling stubs, and
 * lets the container own the outer top/bottom edges.
 */
export function PageMetadataGrid({
  items,
  className,
}: {
  items: readonly PageMetadataItem[];
  className?: string;
}) {
  const total = items.length;
  if (total === 0) return null;

  return (
    <dl
      className={cn(
        "grid grid-cols-2 border-t border-border sm:grid-cols-4",
        className,
      )}
    >
      {items.map((item, index) => {
        /*
          A separator is drawn only where a neighbouring cell actually exists,
          evaluated per cell rather than per row. Checking `index + cols < total`
          (not "is this the last row") is what prevents a dangling bottom stub
          under a partially-filled final row.
        */
        const hasNeighbourRight = (cols: number): boolean =>
          index % cols !== cols - 1 && index + 1 < total;
        const hasNeighbourBelow = (cols: number): boolean => index + cols < total;

        // ── Mobile (2 columns) ──
        const mobileRight = hasNeighbourRight(2);
        const mobileBottom = hasNeighbourBelow(2);

        // ── Desktop (4 columns) ──
        const desktopRight = hasNeighbourRight(4);
        const desktopBottom = hasNeighbourBelow(4);

        return (
          <div
            key={item.label}
            className={cn(
              "flex min-w-0 flex-col gap-1 px-4 py-3 sm:px-6",
              // Mobile separators
              mobileRight && "border-r border-border",
              mobileBottom && "border-b border-border",
              // Desktop separators — always restate so the mobile rules reset
              desktopRight ? "sm:border-r sm:border-border" : "sm:border-r-0",
              desktopBottom ? "sm:border-b sm:border-border" : "sm:border-b-0",
            )}
          >
            <dt className="eyebrow truncate">{item.label}</dt>
            <dd className="truncate font-mono text-[13px] text-foreground tabular">
              {item.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
