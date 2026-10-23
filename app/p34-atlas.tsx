"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Gauge,
  Info,
  Layers3,
  MoveUpRight,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberField } from "@/components/number-field";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  AXES,
  DEFAULT_BUSINESS_FORMULAS,
  DEFAULT_SCENARIO,
  PRESETS,
  type AxisKey,
  type BusinessFormulaSettings,
  type Metrics,
  type Mode,
  type Scenario,
  axisDefinition,
  businessLogit,
  calculateMetrics,
  exactAxis,
  formatAxisValue,
  formatMoney,
  legalSignals,
  movementDescription,
  solveScenario,
} from "./model";

import { DEFAULT_ECONOMICS, ECONOMIC_FIELDS, type EconomicSettings, type EconomicKey } from "./economics";
import { EconomicWorkbench, EconomicMethodology } from "./economic-workbench";
type MapLayer = "character" | "economics";
const mapScore = (m: Metrics, layer: MapLayer) => layer === "economics" ? m.economics.score : m.businessScore;

const CHART = {
  width: 760,
  height: 510,
  left: 76,
  right: 24,
  top: 28,
  bottom: 66,
};

const plotWidth = CHART.width - CHART.left - CHART.right;
const plotHeight = CHART.height - CHART.top - CHART.bottom;
const COLS = 30;
const ROWS = 22;

type Segment = { x1: number; y1: number; x2: number; y2: number };

type SliceConfig = {
  id: string;
  xAxis: AxisKey;
  yAxis: AxisKey;
};

const DEFAULT_SLICES: SliceConfig[] = [
  { id: "efficiency-flow", xAxis: "efficiency", yAxis: "flow" },
  { id: "capital-resources", xAxis: "capital", yAxis: "resources" },
  { id: "edge-horizon", xAxis: "edge", yAxis: "horizon" },
  { id: "capital-flow", xAxis: "capital", yAxis: "flow" },
];

type FormulaKey = keyof BusinessFormulaSettings;

const MAIN_ASSUMPTIONS: Array<{
  key: FormulaKey;
  label: string;
  symbol: string;
}> = [
  { key: "intercept", label: "Baseline / intercept", symbol: "β₀" },
  { key: "operations", label: "Operational value", symbol: "O" },
  { key: "enterprise", label: "Enterprise intensity", symbol: "E" },
  { key: "authority", label: "Robot authority", symbol: "A" },
  { key: "capital", label: "Total capital", symbol: "C" },
  { key: "readiness", label: "Legal readiness", symbol: "L" },
  { key: "wrapper", label: "Wrapper intensity", symbol: "W" },
  { key: "asset", label: "Instrument exposure", symbol: "F" },
];

const INTERACTION_ASSUMPTIONS: Array<{
  key: FormulaKey;
  label: string;
  symbol: string;
}> = [
  {
    key: "operationsEnterprise",
    label: "Operations × enterprise",
    symbol: "O×E",
  },
  {
    key: "enterpriseAuthority",
    label: "Enterprise × authority",
    symbol: "E×A",
  },
  {
    key: "capitalEnterprise",
    label: "Capital × enterprise",
    symbol: "C×E",
  },
  {
    key: "operationsNonAsset",
    label: "Operations outside instruments",
    symbol: "O×(1−F)",
  },
];

const FORMULA_TERMS = [
  ...MAIN_ASSUMPTIONS.filter((item) => item.key !== "intercept"),
  ...INTERACTION_ASSUMPTIONS,
];

function compactCoefficient(value: number) {
  return Math.abs(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formulaText(settings: BusinessFormulaSettings) {
  const terms = FORMULA_TERMS.flatMap((term) => {
    const coefficient = settings[term.key];
    if (Math.abs(coefficient) < 0.0001) return [];
    return [
      `${coefficient >= 0 ? "+" : "−"} ${compactCoefficient(coefficient)}·${term.symbol}`,
    ];
  });
  const intercept = `${settings.intercept < 0 ? "−" : ""}${compactCoefficient(
    settings.intercept,
  )}`;
  return `z = ${intercept} ${terms.join(" ")}`;
}

function scoreColor(score: number) {
  const t = Math.max(0, Math.min(100, score)) / 100;
  const stable = (value: number) => Math.round(value * 1_000) / 1_000;
  if (t < 0.5) {
    const p = t / 0.5;
    return `hsl(${stable(210 - 4 * p)} ${stable(46 - 23 * p)}% ${stable(15 + 21 * p)}%)`;
  }
  const p = (t - 0.5) / 0.5;
  return `hsl(${stable(206 - 173 * p)} ${stable(23 + 51 * p)}% ${stable(36 + 5 * p)}%)`;
}

function pointFor(x: number, y: number) {
  return {
    x: CHART.left + (x / 100) * plotWidth,
    y: CHART.top + ((100 - y) / 100) * plotHeight,
  };
}

function interpolate(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  v1: number,
  v2: number,
  threshold: number,
) {
  const denominator = v2 - v1;
  const t = Math.abs(denominator) < 0.00001 ? 0.5 : (threshold - v1) / denominator;
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

function contourSegments(values: number[][], threshold: number): Segment[] {
  const segments: Segment[] = [];
  const rows = values.length - 1;
  const cols = values[0].length - 1;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x0 = CHART.left + (col / cols) * plotWidth;
      const x1 = CHART.left + ((col + 1) / cols) * plotWidth;
      const y0 = CHART.top + (row / rows) * plotHeight;
      const y1 = CHART.top + ((row + 1) / rows) * plotHeight;
      const points = [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ];
      const v = [
        values[row][col],
        values[row][col + 1],
        values[row + 1][col + 1],
        values[row + 1][col],
      ];
      const crossings: Array<{ x: number; y: number }> = [];
      for (let edge = 0; edge < 4; edge += 1) {
        const next = (edge + 1) % 4;
        const a = v[edge] - threshold;
        const b = v[next] - threshold;
        if ((a < 0 && b >= 0) || (a >= 0 && b < 0)) {
          crossings.push(
            interpolate(points[edge], points[next], v[edge], v[next], threshold),
          );
        }
      }
      if (crossings.length === 2) {
        segments.push({
          x1: crossings[0].x,
          y1: crossings[0].y,
          x2: crossings[1].x,
          y2: crossings[1].y,
        });
      } else if (crossings.length === 4) {
        segments.push({
          x1: crossings[0].x,
          y1: crossings[0].y,
          x2: crossings[1].x,
          y2: crossings[1].y,
        });
        segments.push({
          x1: crossings[2].x,
          y1: crossings[2].y,
          x2: crossings[3].x,
          y2: crossings[3].y,
        });
      }
    }
  }
  return segments;
}

function shortTick(key: AxisKey, value: number) {
  return formatAxisValue(key, value, true);
}

function HeatMap({
  scenario,
  mode,
  xAxis,
  yAxis,
  formula,
  boundaryScore,
  economicSettings,
  layer,
  onScenarioChange,
  solver,
}: {
  scenario: Scenario;
  mode: Mode;
  xAxis: AxisKey;
  yAxis: AxisKey;
  formula: BusinessFormulaSettings;
  boundaryScore: number;
  economicSettings: EconomicSettings;
  layer: MapLayer;
  onScenarioChange: (next: Scenario) => void;
  solver: ReturnType<typeof solveScenario>;
}) {
  const threshold = layer === "economics" ? 50 : boundaryScore;
  const chartId = useId().replace(/:/g, "");
  const glowId = `glow-${chartId}`;
  const solverArrowId = `arrow-solver-${chartId}`;
  const feasibleArrowId = `arrow-feasible-${chartId}`;
  const svgRef = useRef<SVGSVGElement>(null);
  // A touch only moves the point once it is a tap or a sideways drag: the chart
  // lets the browser scroll vertically (touch-action: pan-y), so a swipe that
  // starts on a chart scrolls the page instead of rewriting the scenario.
  const touchRef = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    metrics: Metrics;
  } | null>(null);

  const field = useMemo(() => {
    const cells = Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: COLS }, (_, col) => {
        const x = ((col + 0.5) / COLS) * 100;
        const y = 100 - ((row + 0.5) / ROWS) * 100;
        const point = { ...scenario, [xAxis]: x, [yAxis]: y };
        return calculateMetrics(point, mode, formula, boundaryScore, economicSettings);
      }),
    );
    const vertices = Array.from({ length: ROWS + 1 }, (_, row) =>
      Array.from({ length: COLS + 1 }, (_, col) => {
        const x = (col / COLS) * 100;
        const y = 100 - (row / ROWS) * 100;
        const point = { ...scenario, [xAxis]: x, [yAxis]: y };
        return calculateMetrics(point, mode, formula, boundaryScore, economicSettings);
      }),
    );
    const select = (pick: (metric: Metrics) => number) =>
      vertices.map((row) => row.map(pick));
    return {
      cells,
      business: contourSegments(
        select((metric) => mapScore(metric, layer)),
        threshold,
      ),
      surplus: contourSegments(select((metric) => metric.economics.annualSurplus), 0),
      funding: contourSegments(select((metric) => metric.economics.fundingMargin), 0),
      risk: contourSegments(select((metric) => metric.economics.interruption), economicSettings.maxInterruption/100),
      capacity: contourSegments(select((metric) => metric.capacityMargin), 0),
      permission: contourSegments(select((metric) => metric.permissionMargin), 0),
      regulatory: contourSegments(select((metric) => metric.regulatoryScore), 60),
    };
  }, [boundaryScore, economicSettings, layer, threshold, formula, mode, scenario, xAxis, yAxis]);

  const boundaryAnnotation = useMemo(() => {
    if (!field.business.length) return null;
    const center = {
      x: CHART.left + plotWidth / 2,
      y: CHART.top + plotHeight / 2,
    };
    const segment = field.business.reduce((closest, candidate) => {
      const candidateMid = {
        x: (candidate.x1 + candidate.x2) / 2,
        y: (candidate.y1 + candidate.y2) / 2,
      };
      const closestMid = {
        x: (closest.x1 + closest.x2) / 2,
        y: (closest.y1 + closest.y2) / 2,
      };
      return Math.hypot(candidateMid.x - center.x, candidateMid.y - center.y) <
        Math.hypot(closestMid.x - center.x, closestMid.y - center.y)
        ? candidate
        : closest;
    });
    const midpoint = {
      x: (segment.x1 + segment.x2) / 2,
      y: (segment.y1 + segment.y2) / 2,
    };
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const length = Math.hypot(dx, dy) || 1;
    let nx = -dy / length;
    let ny = dx / length;
    const scoreAt = (pixelX: number, pixelY: number) => {
      const x = ((pixelX - CHART.left) / plotWidth) * 100;
      const y = 100 - ((pixelY - CHART.top) / plotHeight) * 100;
      return mapScore(calculateMetrics(
        {
          ...scenario,
          [xAxis]: Math.max(0, Math.min(100, x)),
          [yAxis]: Math.max(0, Math.min(100, y)),
        },
        mode,
        formula,
        boundaryScore,
        economicSettings,
      ), layer);
    };
    if (
      scoreAt(midpoint.x + nx * 28, midpoint.y + ny * 28) <
      scoreAt(midpoint.x - nx * 28, midpoint.y - ny * 28)
    ) {
      nx *= -1;
      ny *= -1;
    }
    const clampLabel = (x: number, y: number) => ({
      x: Math.max(CHART.left + 70, Math.min(CHART.left + plotWidth - 70, x)),
      y: Math.max(CHART.top + 18, Math.min(CHART.top + plotHeight - 18, y)),
    });
    return {
      midpoint,
      business: clampLabel(midpoint.x + nx * 104, midpoint.y + ny * 104),
      investment: clampLabel(midpoint.x - nx * 104, midpoint.y - ny * 104),
    };
  }, [boundaryScore, economicSettings, layer, field.business, formula, mode, scenario, xAxis, yAxis]);

  const wholeSliceLabel = useMemo(() => {
    if (field.business.length) return null;
    const centerScenario = { ...scenario, [xAxis]: 50, [yAxis]: 50 };
    const centerMetrics = calculateMetrics(
      centerScenario,
      mode,
      formula,
      boundaryScore,
      economicSettings,
    );
    return (layer === "economics" ? centerMetrics.economics.viable : centerMetrics.businessScore >= threshold)
      ? (layer === "economics" ? "ENTIRE SLICE · CRITERIA PASS" : "ENTIRE SLICE · BUSINESS-LIKE")
      : (layer === "economics" ? "ENTIRE SLICE · CRITERIA FAIL" : "ENTIRE SLICE · INVESTMENT-LIKE");
  }, [boundaryScore, economicSettings, layer, threshold, field.business.length, formula, mode, scenario, xAxis, yAxis]);

  const currentPoint = pointFor(scenario[xAxis], scenario[yAxis]);

  const readPointer = (
    event: React.PointerEvent<SVGSVGElement>,
    commit: boolean,
  ) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * CHART.width;
    const svgY = ((event.clientY - rect.top) / rect.height) * CHART.height;
    const x = Math.max(0, Math.min(100, ((svgX - CHART.left) / plotWidth) * 100));
    const y = Math.max(
      0,
      Math.min(100, 100 - ((svgY - CHART.top) / plotHeight) * 100),
    );
    if (
      svgX < CHART.left ||
      svgX > CHART.left + plotWidth ||
      svgY < CHART.top ||
      svgY > CHART.top + plotHeight
    )
      return;
    const next = { ...scenario, [xAxis]: x, [yAxis]: y };
    const metrics = calculateMetrics(next, mode, formula, boundaryScore, economicSettings);
    setHover({ x, y, metrics });
    if (commit) onScenarioChange(next);
  };

  return (
    <div className="map-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        className="heat-map"
        role="img"
        aria-label={`Interactive slice: ${axisDefinition(xAxis).label} by ${axisDefinition(yAxis).label}`}
        onPointerMove={(event) => {
          if (event.pointerType !== "touch") return readPointer(event, event.buttons === 1);
          const touch = touchRef.current;
          if (!touch || touch.id !== event.pointerId) return;
          const dx = Math.abs(event.clientX - touch.x);
          const dy = Math.abs(event.clientY - touch.y);
          if (!touch.dragging && (dx < 8 || dx <= dy)) return;
          touch.dragging = true;
          readPointer(event, true);
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary) return;
          if (event.pointerType === "touch") {
            touchRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          readPointer(event, true);
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== "touch" || touchRef.current?.id !== event.pointerId) return;
          touchRef.current = null;
          readPointer(event, true);
        }}
        onPointerCancel={() => {
          touchRef.current = null;
          setHover(null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id={solverArrowId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f7cb69" />
          </marker>
          <marker
            id={feasibleArrowId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#67e8f9" />
          </marker>
        </defs>

        <rect
          x={CHART.left}
          y={CHART.top}
          width={plotWidth}
          height={plotHeight}
          rx="6"
          fill="#0d131b"
        />
        {field.cells.flatMap((row, rowIndex) =>
          row.map((metrics, colIndex) => (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={CHART.left + (colIndex / COLS) * plotWidth}
              y={CHART.top + (rowIndex / ROWS) * plotHeight}
              width={plotWidth / COLS + 0.6}
              height={plotHeight / ROWS + 0.6}
              fill={scoreColor(mapScore(metrics, layer))}
            />
          )),
        )}

        {[0, 25, 50, 75, 100].map((tick) => {
          const x = CHART.left + (tick / 100) * plotWidth;
          const y = CHART.top + ((100 - tick) / 100) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={x}
                y1={CHART.top}
                x2={x}
                y2={CHART.top + plotHeight}
                stroke="rgba(255,255,255,.11)"
              />
              <line
                x1={CHART.left}
                y1={y}
                x2={CHART.left + plotWidth}
                y2={y}
                stroke="rgba(255,255,255,.11)"
              />
              <text
                x={x}
                y={CHART.height - 34}
                textAnchor="middle"
                className="axis-tick"
              >
                {shortTick(xAxis, tick)}
              </text>
              <text
                x={CHART.left - 12}
                y={y + 4}
                textAnchor="end"
                className="axis-tick"
              >
                {shortTick(yAxis, tick)}
              </text>
            </g>
          );
        })}

        {field.business.map((segment, index) => (
          <line key={`b-${index}`} {...segment} className="contour-business" />
        ))}
        {layer === "economics" && <>
          {field.surplus.map((segment,index)=><line key={`n-${index}`} {...segment} className="contour-surplus" />)}
          {field.funding.map((segment,index)=><line key={`f-${index}`} {...segment} className="contour-funding" />)}
          {field.risk.map((segment,index)=><line key={`i-${index}`} {...segment} className="contour-risk" />)}
        </>}
        {layer === "character" && field.capacity.map((segment, index) => (
          <line key={`c-${index}`} {...segment} className="contour-capacity" />
        ))}
        {layer === "character" && field.permission.map((segment, index) => (
          <line key={`p-${index}`} {...segment} className="contour-permission" />
        ))}
        {layer === "character" && mode === "precedent" &&
          field.regulatory.map((segment, index) => (
            <line key={`r-${index}`} {...segment} className="contour-regulatory" />
          ))}

        {boundaryAnnotation ? (
          <g className="boundary-annotation" aria-hidden="true">
            <line
              x1={boundaryAnnotation.investment.x}
              y1={boundaryAnnotation.investment.y}
              x2={boundaryAnnotation.business.x}
              y2={boundaryAnnotation.business.y}
              className="boundary-normal"
            />
            <g
              className="boundary-side boundary-side-investment"
              transform={`translate(${boundaryAnnotation.investment.x} ${boundaryAnnotation.investment.y})`}
            >
              <rect x="-66" y="-11" width="132" height="22" rx="4" />
              <text textAnchor="middle" dominantBaseline="central">
                {layer === "economics" ? "CRITERIA FAIL" : "INVESTMENT SIDE"}
              </text>
            </g>
            <g
              className="boundary-side boundary-side-business"
              transform={`translate(${boundaryAnnotation.business.x} ${boundaryAnnotation.business.y})`}
            >
              <rect x="-62" y="-11" width="124" height="22" rx="4" />
              <text textAnchor="middle" dominantBaseline="central">
                {layer === "economics" ? "CRITERIA PASS" : "BUSINESS SIDE"}
              </text>
            </g>
            <g
              className="boundary-value-label"
              transform={`translate(${boundaryAnnotation.midpoint.x} ${boundaryAnnotation.midpoint.y})`}
            >
              <rect x="-34" y="-10" width="68" height="20" rx="10" />
              <text textAnchor="middle" dominantBaseline="central">
                {layer === "economics" ? "VIABILITY" : `${Math.round(boundaryScore)} LINE`}
              </text>
            </g>
          </g>
        ) : (
          <g
            className="whole-slice-label"
            transform={`translate(${CHART.left + plotWidth / 2} ${CHART.top + 22})`}
            aria-hidden="true"
          >
            <rect x="-104" y="-12" width="208" height="24" rx="5" />
            <text textAnchor="middle" dominantBaseline="central">
              {wholeSliceLabel}
            </text>
          </g>
        )}

        {solver.filter(result => layer === "economics" ? result.goal === "sustainable" : result.goal !== "sustainable").map((result) => {
          const target = pointFor(result.target[xAxis], result.target[yAxis]);
          if (
            Math.hypot(target.x - currentPoint.x, target.y - currentPoint.y) < 8
          )
            return null;
          const isFeasible = result.goal === "feasible" || result.goal === "sustainable";
          return (
            <g key={result.goal}>
              <line
                x1={currentPoint.x}
                y1={currentPoint.y}
                x2={target.x}
                y2={target.y}
                className={isFeasible ? "solver-feasible" : "solver-reclassify"}
                markerEnd={
                  isFeasible
                    ? `url(#${feasibleArrowId})`
                    : `url(#${solverArrowId})`
                }
              />
              <circle
                cx={target.x}
                cy={target.y}
                r="5"
                className={isFeasible ? "solver-dot-feasible" : "solver-dot"}
              />
            </g>
          );
        })}

        <line
          x1={currentPoint.x}
          y1={CHART.top}
          x2={currentPoint.x}
          y2={CHART.top + plotHeight}
          className="crosshair"
        />
        <line
          x1={CHART.left}
          y1={currentPoint.y}
          x2={CHART.left + plotWidth}
          y2={currentPoint.y}
          className="crosshair"
        />
        <circle
          cx={currentPoint.x}
          cy={currentPoint.y}
          r="9"
          className="current-point-ring"
          filter={`url(#${glowId})`}
        />
        <circle
          cx={currentPoint.x}
          cy={currentPoint.y}
          r="3.5"
          className="current-point"
        />

        <text
          x={CHART.left + plotWidth / 2}
          y={CHART.height - 7}
          textAnchor="middle"
          className="axis-title"
        >
          {axisDefinition(xAxis).label}
        </text>
        <text
          transform={`translate(18 ${CHART.top + plotHeight / 2}) rotate(-90)`}
          textAnchor="middle"
          className="axis-title"
        >
          {axisDefinition(yAxis).label}
        </text>
      </svg>

      {hover && (
        <div className="map-overlay" aria-live="polite">
          <span>{layer === "economics" ? `${Math.round(hover.metrics.economics.score)} viability index · NPV ${hover.metrics.economics.npv<0?"−":""}${formatMoney(Math.abs(hover.metrics.economics.npv))}` : `${Math.round(hover.metrics.businessScore)} boundary score`}</span>
          <strong>{layer === "economics" ? hover.metrics.economics.bottleneck.label : hover.metrics.classification}</strong>
        </div>
      )}
    </div>
  );
}

function SliceCard({
  index,
  slice,
  scenario,
  mode,
  formula,
  boundaryScore,
  economicSettings,
  layer,
  solver,
  onSliceChange,
  onScenarioChange,
}: {
  index: number;
  slice: SliceConfig;
  scenario: Scenario;
  mode: Mode;
  formula: BusinessFormulaSettings;
  boundaryScore: number;
  economicSettings: EconomicSettings;
  layer: MapLayer;
  solver: ReturnType<typeof solveScenario>;
  onSliceChange: (next: SliceConfig) => void;
  onScenarioChange: (next: Scenario) => void;
}) {
  const changeAxis = (dimension: "xAxis" | "yAxis", next: AxisKey) => {
    const otherDimension = dimension === "xAxis" ? "yAxis" : "xAxis";
    const previous = slice[dimension];
    onSliceChange({
      ...slice,
      [dimension]: next,
      [otherDimension]: next === slice[otherDimension] ? previous : slice[otherDimension],
    });
  };

  return (
    <section className="slice-card" aria-label={`Slice ${index + 1}`}>
      <header className="slice-card-head">
        <div className="slice-name">
          <span>Slice {String(index + 1).padStart(2, "0")}</span>
          <strong>
            {axisDefinition(slice.yAxis).short} × {axisDefinition(slice.xAxis).short}
          </strong>
        </div>
        <div className="slice-axis-pickers">
          <label>
            <span>X</span>
            <Select
              value={slice.xAxis}
              onValueChange={(value) => changeAxis("xAxis", value as AxisKey)}
            >
              <SelectTrigger className="slice-axis-select" aria-label={`Slice ${index + 1} X axis`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AXES.map((axis) => (
                  <SelectItem key={axis.key} value={axis.key}>
                    {axis.short}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            <span>Y</span>
            <Select
              value={slice.yAxis}
              onValueChange={(value) => changeAxis("yAxis", value as AxisKey)}
            >
              <SelectTrigger className="slice-axis-select" aria-label={`Slice ${index + 1} Y axis`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AXES.map((axis) => (
                  <SelectItem key={axis.key} value={axis.key}>
                    {axis.short}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </header>
      <HeatMap
        scenario={scenario}
        mode={mode}
        xAxis={slice.xAxis}
        yAxis={slice.yAxis}
        formula={formula}
        boundaryScore={boundaryScore}
        economicSettings={economicSettings}
        layer={layer}
        onScenarioChange={onScenarioChange}
        solver={solver}
      />
    </section>
  );
}

function AxisControl({
  axis,
  value,
  activeCount,
  onChange,
}: {
  axis: AxisKey;
  value: number;
  activeCount: number;
  onChange: (value: number) => void;
}) {
  const definition = axisDefinition(axis);
  const exact = exactAxis(axis);
  return (
    <div className={`axis-control ${activeCount ? "axis-control-active" : ""}`}>
      <div className="axis-control-head">
        <div>
          <span>{definition.short}</span>
          {activeCount > 0 && (
            <em>{activeCount} {activeCount === 1 ? "slice" : "slices"}</em>
          )}
        </div>
        <strong>{formatAxisValue(axis, value)}</strong>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={100}
        step={1}
        onValueChange={(next) => onChange(next[0])}
        aria-label={definition.label}
        aria-valuetext={formatAxisValue(axis, value)}
        className="atlas-slider"
      />
      <div className="axis-control-range">
        <span>{definition.low.split(" · ")[1]}</span>
        <span>{definition.high.split(" · ")[1]}</span>
      </div>
      {exact && (
        <label className="exact-coordinate">
          <span>{exact.unit}</span>
          <NumberField
            aria-label={`${definition.label} exact value`}
            min={exact.min}
            max={exact.max}
            step={exact.step}
            value={Math.round(exact.value(value) * 1000) / 1000}
            onValueChange={(next) => onChange(exact.coordinate(next))}
          />
        </label>
      )}
    </div>
  );
}

function AssumptionField({
  item,
  value,
  onChange,
}: {
  item: { key: FormulaKey; label: string; symbol: string };
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="assumption-field">
      <span>
        <strong>{item.symbol}</strong>
        {item.label}
      </span>
      <NumberField
        min={-5}
        max={5}
        step={0.05}
        value={value}
        onValueChange={onChange}
        aria-label={`${item.label} coefficient`}
      />
    </label>
  );
}

function FormulaWorkbench({
  mode,
  scenario,
  formula,
  boundaryScore,
  onFormulaChange,
  onBoundaryChange,
  onReset,
}: {
  mode: Mode;
  scenario: Scenario;
  formula: BusinessFormulaSettings;
  boundaryScore: number;
  onFormulaChange: (key: FormulaKey, value: number) => void;
  onBoundaryChange: (value: number) => void;
  onReset: () => void;
}) {
  const logit = businessLogit(scenario, formula);
  const score = 100 / (1 + Math.exp(-logit));

  return (
    <section className="formula-workbench" aria-labelledby="live-formula-title">
      <div className="formula-readout">
        <div className="formula-copy">
          <span id="live-formula-title">
            Live {mode === "precedent" ? "precedent" : "perceived"} business formula
          </span>
          <code>B = 100 ÷ (1 + e<sup>−z</sup>)</code>
          <code className="formula-z">{formulaText(formula)}</code>
          <small>
            O operations · E enterprise · A authority · C capital · L readiness ·
            W wrapper · F instrument exposure. Inputs are normalized to 0–1.
          </small>
        </div>
        <div className="formula-outcome">
          <span>Current scenario</span>
          <strong>{score.toFixed(1)}</strong>
          <small>
            z = {logit.toFixed(2)} · business side at {Math.round(boundaryScore)}+
          </small>
        </div>
      </div>

      <details className="assumption-editor">
        <summary>
          <span>Configure formula assumptions</span>
          <small>12 coefficients + boundary</small>
        </summary>
        <div className="assumption-editor-body">
          <div className="assumption-group">
            <div>
              <strong>Main effects</strong>
              <span>Positive values push toward business-like.</span>
            </div>
            <div className="assumption-grid">
              {MAIN_ASSUMPTIONS.map((item) => (
                <AssumptionField
                  key={item.key}
                  item={item}
                  value={formula[item.key]}
                  onChange={(value) => onFormulaChange(item.key, value)}
                />
              ))}
            </div>
          </div>

          <div className="assumption-group">
            <div>
              <strong>Interaction effects</strong>
              <span>Extra weight when two conditions occur together.</span>
            </div>
            <div className="assumption-grid assumption-grid-interactions">
              {INTERACTION_ASSUMPTIONS.map((item) => (
                <AssumptionField
                  key={item.key}
                  item={item}
                  value={formula[item.key]}
                  onChange={(value) => onFormulaChange(item.key, value)}
                />
              ))}
            </div>
          </div>

          <div className="boundary-assumption">
            <div>
              <strong>Reclassification boundary</strong>
              <span>
                A score at or above this line is treated as business-like by the
                maps and solver.
              </span>
            </div>
            <div>
              <Slider
                value={[boundaryScore]}
                min={20}
                max={80}
                step={1}
                onValueChange={(next) => onBoundaryChange(next[0])}
                aria-label="Business reclassification boundary"
                className="boundary-slider"
              />
              <output>{Math.round(boundaryScore)} / 100</output>
            </div>
          </div>

          <div className="assumption-actions">
            <p>
              These are transparent research assumptions, not fitted legal
              probabilities or legal conclusions.
            </p>
            <button type="button" onClick={onReset}>
              Reset {mode} lens
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone = "plain",
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  note: string;
  tone?: "plain" | "warn" | "good";
}) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-label">
        <Icon size={15} />
        {label}
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

export default function P34Atlas() {
  const [economicSettings, setEconomicSettings] = useState<EconomicSettings>({...DEFAULT_ECONOMICS});
  const [layer, setLayer] = useState<MapLayer>("economics");
  const [mode, setMode] = useState<Mode>("perceived");
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [slices, setSlices] = useState<SliceConfig[]>(DEFAULT_SLICES);
  const [formulaSettings, setFormulaSettings] = useState<
    Record<Mode, BusinessFormulaSettings>
  >(() => ({
    perceived: { ...DEFAULT_BUSINESS_FORMULAS.perceived },
    precedent: { ...DEFAULT_BUSINESS_FORMULAS.precedent },
  }));
  const [boundaryScore, setBoundaryScore] = useState(50);
  const activeFormula = formulaSettings[mode];
  const metrics = useMemo(
    () => calculateMetrics(scenario, mode, activeFormula, boundaryScore, economicSettings),
    [activeFormula, boundaryScore, scenario, mode, economicSettings],
  );
  const signals = useMemo(
    () => legalSignals(scenario, metrics),
    [scenario, metrics],
  );
  const solver = useMemo(
    () => solveScenario(scenario, mode, activeFormula, boundaryScore, economicSettings),
    [activeFormula, boundaryScore, scenario, mode, economicSettings],
  );
  const sliceUseCounts = useMemo(
    () =>
      Object.fromEntries(
        AXES.map((axis) => [
          axis.key,
          slices.filter(
            (slice) => slice.xAxis === axis.key || slice.yAxis === axis.key,
          ).length,
        ]),
      ) as Record<AxisKey, number>,
    [slices],
  );
  const stateRef = useRef({
    scenario,
    mode,
    slices,
    formulaSettings,
    boundaryScore,
    economicSettings,
    layer,
  });
  stateRef.current = {
    scenario,
    mode,
    slices,
    formulaSettings,
    boundaryScore,
    economicSettings,
    layer,
  };

  useEffect(() => {
    type WebTool = {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown | Promise<unknown>;
    };
    type ModelContext = {
      registerTool: (
        tool: WebTool,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };

    const context = (
      document as Document & { modelContext?: ModelContext }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const axisNames = AXES.map((axis) => axis.key);
    const formulaKeys = Object.keys(
      DEFAULT_BUSINESS_FORMULAS.perceived,
    ) as FormulaKey[];
    const reportError = (error: unknown) =>
      console.warn("P34 Boundary Atlas WebMCP registration failed", error);

    const readTool: WebTool = {
      name: "read_boundary_scenario",
      title: "Read boundary scenario",
      description:
        "Read the visible P34 business-versus-investment scenario, all selected 2D slices, scores, and capacity constraints without changing the page.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        const current = stateRef.current;
        return {
          ...current,
          metrics: calculateMetrics(
            current.scenario,
            current.mode,
            current.formulaSettings[current.mode],
            current.boundaryScore,
            current.economicSettings,
          ),
        };
      },
    };

    const configureTool: WebTool = {
      name: "configure_boundary_scenario",
      title: "Configure boundary scenario",
      description:
        "Stage a P34 scenario in the visible explorer. Set coordinates, lens, formula assumptions, reclassification boundary, or two to four visible 2D slices.",
      inputSchema: {
        type: "object",
        minProperties: 1,
        properties: {
          mode: { type: "string", enum: ["perceived", "precedent"] },
          boundaryScore: { type: "number", minimum: 20, maximum: 80 },
          layer: {type: "string", enum: ["character", "economics"]},
          economics: {type:"object",properties:Object.fromEntries(ECONOMIC_FIELDS.map(f=>[f.key,{type:"number",minimum:f.min,maximum:f.max}])),additionalProperties:false},
          assumptions: {
            type: "object",
            properties: Object.fromEntries(
              formulaKeys.map((key) => [
                key,
                { type: "number", minimum: -5, maximum: 5 },
              ]),
            ),
            additionalProperties: false,
          },
          xAxis: { type: "string", enum: axisNames },
          yAxis: { type: "string", enum: axisNames },
          slices: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: {
              type: "object",
              required: ["xAxis", "yAxis"],
              properties: {
                xAxis: { type: "string", enum: axisNames },
                yAxis: { type: "string", enum: axisNames },
              },
              additionalProperties: false,
            },
          },
          preset: { type: "string", enum: PRESETS.map((preset) => preset.name) },
          coordinates: {
            type: "object",
            properties: Object.fromEntries(
              axisNames.map((axis) => [
                axis,
                { type: "number", minimum: 0, maximum: 100 },
              ]),
            ),
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
          throw new Error("Input must be an object.");
        }
        const data = input as {
          mode?: Mode;
          boundaryScore?: number;
          layer?: MapLayer;
          economics?: Partial<EconomicSettings>;
          assumptions?: Partial<BusinessFormulaSettings>;
          xAxis?: AxisKey;
          yAxis?: AxisKey;
          slices?: Array<{ xAxis: AxisKey; yAxis: AxisKey }>;
          preset?: string;
          coordinates?: Partial<Scenario>;
        };
        const current = stateRef.current;
        const preset = data.preset
          ? PRESETS.find((item) => item.name === data.preset)
          : undefined;
        if (data.preset && !preset) throw new Error("Unknown preset.");
        const nextLayer = data.layer ?? current.layer;
        if (!["character","economics"].includes(nextLayer)) throw new Error("Unknown map layer.");
        if (data.economics !== undefined && (!data.economics || typeof data.economics !== "object" || Array.isArray(data.economics))) throw new Error("Economics must be an object.");
        for (const [key,value] of Object.entries(data.economics ?? {})) {
          const field = ECONOMIC_FIELDS.find(f=>f.key===key);
          if (!field || typeof value!=="number" || !Number.isFinite(value) || value<field.min || value>field.max) throw new Error(`Invalid economic assumption: ${key}`);
        }
        const nextEconomics = {...current.economicSettings,...data.economics};
        const nextMode = data.mode ?? current.mode;
        if (!["perceived","precedent"].includes(nextMode)) throw new Error("Unknown lens.");
        const nextBoundaryScore = data.boundaryScore ?? current.boundaryScore;
        if (
          typeof nextBoundaryScore !== "number" ||
          !Number.isFinite(nextBoundaryScore) ||
          nextBoundaryScore < 20 ||
          nextBoundaryScore > 80
        ) {
          throw new Error("boundaryScore must be between 20 and 80.");
        }
        const nextAssumptions = data.assumptions ?? {};
        for (const [key, value] of Object.entries(nextAssumptions)) {
          if (
            !formulaKeys.includes(key as FormulaKey) ||
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < -5 ||
            value > 5
          ) {
            throw new Error(`Invalid formula assumption: ${key}.`);
          }
        }
        const nextFormulaSettings = {
          ...current.formulaSettings,
          [nextMode]: {
            ...current.formulaSettings[nextMode],
            ...nextAssumptions,
          },
        };
        let nextSlices = current.slices;
        if (data.slices) {
          if (data.slices.length < 2 || data.slices.length > 4) {
            throw new Error("Configure between two and four slices.");
          }
          nextSlices = data.slices.map((slice, index) => {
            if (
              !axisNames.includes(slice.xAxis) ||
              !axisNames.includes(slice.yAxis) ||
              slice.xAxis === slice.yAxis
            ) {
              throw new Error(`Invalid axes in slice ${index + 1}.`);
            }
            return {
              id: current.slices[index]?.id ?? `slice-${index + 1}`,
              xAxis: slice.xAxis,
              yAxis: slice.yAxis,
            };
          });
        } else if (data.xAxis || data.yAxis) {
          const nextX = data.xAxis ?? current.slices[0].xAxis;
          const nextY = data.yAxis ?? current.slices[0].yAxis;
          if (!axisNames.includes(nextX) || !axisNames.includes(nextY)) {
            throw new Error("Unknown slice axis.");
          }
          if (nextX === nextY) {
            throw new Error("xAxis and yAxis must be different.");
          }
          nextSlices = [
            { ...current.slices[0], xAxis: nextX, yAxis: nextY },
            ...current.slices.slice(1),
          ];
        }
        const coordinates = data.coordinates ?? {};
        for (const [key, value] of Object.entries(coordinates)) {
          if (
            !axisNames.includes(key as AxisKey) ||
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < 0 ||
            value > 100
          ) {
            throw new Error(`Invalid coordinate: ${key}.`);
          }
        }
        const nextScenario = {
          ...(preset?.values ?? current.scenario),
          ...coordinates,
        } as Scenario;
        setEconomicSettings(nextEconomics);
        setLayer(nextLayer);
        setMode(nextMode);
        setSlices(nextSlices);
        setScenario(nextScenario);
        setFormulaSettings(nextFormulaSettings);
        setBoundaryScore(nextBoundaryScore);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return {
          mode: nextMode,
          economicSettings: nextEconomics,
          layer: nextLayer,
          slices: nextSlices,
          scenario: nextScenario,
          formulaSettings: nextFormulaSettings,
          boundaryScore: nextBoundaryScore,
          metrics: calculateMetrics(
            nextScenario,
            nextMode,
            nextFormulaSettings[nextMode],
            nextBoundaryScore,
            nextEconomics,
          ),
        };
      },
    };

    for (const tool of [readTool, configureTool]) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(reportError);
      } catch (error) {
        reportError(error);
      }
    }
    return () => lifecycle.abort();
  }, []);

  return (
    <TooltipProvider>
      <main>
        <header className="site-header">
          <a className="brand" href="#explorer" aria-label="P34 Boundary Atlas home">
            <span className="brand-mark">
              <Layers3 size={18} />
            </span>
            <span>
              <strong>P34 Boundary Atlas</strong>
              <small>Business ↔ investment</small>
            </span>
          </a>
          <nav aria-label="Page sections">
            <a href="#explorer">Explorer</a>
            <a href="#model">Model</a>
            <a href="#sources">Sources</a>
          </nav>
          <div className="mode-switch" role="group" aria-label="Model mode">
            <span className={mode === "perceived" ? "active" : ""}>Perceived</span>
            <Switch
              checked={mode === "precedent"}
              onCheckedChange={(checked) =>
                setMode(checked ? "precedent" : "perceived")
              }
              aria-label="Use precedent-informed mode"
            />
            <span className={mode === "precedent" ? "active" : ""}>Precedent</span>
          </div>
        </header>

        <section id="explorer" className="explorer-shell">
          <aside className="control-rail">
            <div className="rail-intro">
              <span className="eyebrow">Interactive research model · v2.0</span>
              <h1>When does an AI allocator become a business?</h1>
              <p>
                Tune one scenario, then compare four independently selectable 2D
                slices. Switch between operating character and economic sustainability.
              </p>
            </div>

            <div className="axis-list">
              {AXES.map((axis) => (
                <AxisControl
                  key={axis.key}
                  axis={axis.key}
                  value={scenario[axis.key]}
                  activeCount={sliceUseCounts[axis.key]}
                  onChange={(value) =>
                    setScenario((current) => ({ ...current, [axis.key]: value }))
                  }
                />
              ))}
            </div>

            <div className="preset-list">
              <span>Load a scenario</span>
              <div>
                {PRESETS.map((preset) => (
                  <Tooltip key={preset.name}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setScenario(preset.values)}
                      >
                        {preset.name}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{preset.note}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </aside>

          <div className="analysis-stage">
            <div className="stage-head">
              <div>
                <span className="eyebrow">
                  {mode === "precedent"
                    ? "U.S. federal precedent lens"
                    : "Ordinary-language perception lens"}
                </span>
                <h2>Four linked views of one scenario</h2>
              </div>
              <div className="score-legend" aria-label="Boundary score color legend">
                <div className="score-legend-head">
                  <span>{layer === "economics" ? "Criteria fail" : "Investment-like"}</span>
                  <strong>{layer === "economics" ? "Viability index" : "Boundary score"}</strong>
                  <span>{layer === "economics" ? "Criteria pass" : "Business-like"}</span>
                </div>
                <div className="score-gradient" aria-hidden="true">
                  <i>0</i>
                  <i style={{ left: `${layer === "economics" ? 50 : boundaryScore}%` }}>
                    {layer === "economics" ? 50 : Math.round(boundaryScore)}
                  </i>
                  <i>100</i>
                </div>
              </div>
            </div>

            <div className="layer-switch" role="group" aria-label="Map layer">
              <button type="button" aria-pressed={layer === "economics"} onClick={()=>setLayer("economics")}>Economic sustainability</button>
              <button type="button" aria-pressed={layer === "character"} onClick={()=>setLayer("character")}>Business / investment character</button>
              <button type="button" className="slice-layout-button" onClick={()=>setSlices(layer === "economics" ? DEFAULT_SLICES : [{id:"ops",xAxis:"operations",yAxis:"enterprise"},{id:"asset",xAxis:"asset",yAxis:"authority"},{id:"capacity",xAxis:"capital",yAxis:"enterprise"},{id:"legal",xAxis:"wrapper",yAxis:"readiness"}])}>Use suggested slices</button>
            </div>
            <p className="layer-explainer">{layer === "economics" ? "Color shows the weakest of seven economic criteria. White = all criteria reach zero; positive NPV alone does not prove sustainability. Market capacity and legal readiness are evaluated separately below." : "Color shows operating character under the selected lens. Profitability and starting wealth do not change the legal definition. Economic assumptions remain active in the funding constraints."}</p>
            <EconomicWorkbench scenario={scenario} settings={economicSettings} metrics={metrics.economics} onChange={setEconomicSettings} onScenarioChange={setScenario} />

            <FormulaWorkbench
              mode={mode}
              scenario={scenario}
              formula={activeFormula}
              boundaryScore={boundaryScore}
              onFormulaChange={(key, value) =>
                setFormulaSettings((current) => ({
                  ...current,
                  [mode]: { ...current[mode], [key]: value },
                }))
              }
              onBoundaryChange={setBoundaryScore}
              onReset={() => {
                setFormulaSettings((current) => ({
                  ...current,
                  [mode]: { ...DEFAULT_BUSINESS_FORMULAS[mode] },
                }));
                setBoundaryScore(50);
              }}
            />

            <div className="slice-grid">
              {slices.map((slice, index) => (
                <SliceCard
                  key={slice.id}
                  index={index}
                  slice={slice}
                  scenario={scenario}
                  mode={mode}
                  formula={activeFormula}
                  boundaryScore={boundaryScore}
                  economicSettings={economicSettings}
                  layer={layer}
                  solver={solver}
                  onScenarioChange={setScenario}
                  onSliceChange={(next) =>
                    setSlices((current) =>
                      current.map((item) => (item.id === slice.id ? next : item)),
                    )
                  }
                />
              ))}
            </div>

            <div className="line-legend">
              <span><i className="line-solid" />{layer === "economics" ? "Economic criteria: pass side / fail side" : `${Math.round(boundaryScore)}-point business-character boundary`}</span>
              {layer === "economics" ? <>
                <span><i className="line-purple" />NPV = 0 · positive side creates surplus</span>
                <span><i className="line-blue" />available = allocated · more available is funded</span>
                <span><i className="line-red" />interruption = {economicSettings.maxInterruption}% · lower is within tolerance</span>
              </> : <>
                <span><i className="line-cyan" />market capacity · less allocation / more breadth closes</span>
                <span><i className="line-dashed" />permission frontier · more readiness closes</span>
                {mode === "precedent" && <span><i className="line-red" />60-point regulated-role screen · higher escalates</span>}
              </>}
            </div>

            <div className="metric-grid">
              <MetricCard
                icon={Scale}
                label="Classification"
                value={`${Math.round(metrics.businessScore)} · ${metrics.classification}`}
                note={
                  mode === "precedent"
                    ? "Heuristic fit to trade/business factors"
                    : "Estimated ordinary-language perception"
                }
              />
              <MetricCard
                icon={Gauge}
                label="Capital capacity"
                value={`${metrics.requiredMarkets.toLocaleString()} / ${metrics.supportedMarkets.toLocaleString()} markets`}
                note={`${formatMoney(metrics.perMarketCapacity)} estimated per-market capacity`}
                tone={metrics.capacityMargin < 0 ? "warn" : "good"}
              />
              <MetricCard
                icon={ShieldCheck}
                label="Readiness margin"
                value={`${metrics.permissionMargin >= 0 ? "+" : ""}${Math.round(metrics.permissionMargin)} points`}
                note={`${Math.round(metrics.requiredReadiness)} required by the role model`}
                tone={metrics.permissionMargin < 0 ? "warn" : "good"}
              />
              <MetricCard
                icon={CircleAlert}
                label="Regulatory contact"
                value={`${Math.round(metrics.regulatoryScore)} · ${metrics.regulatoryLabel}`}
                note="Separate from businessness"
                tone={metrics.regulatoryScore >= 60 ? "warn" : "plain"}
              />
            </div>

            <div className="solver-panel">
              <div className="solver-heading">
                <span className="solver-icon"><Sparkles size={17} /></span>
                <div>
                  <strong>Constrained movement solver</strong>
                  <p>
                    Character goals move up to two coordinates. Economic sizing changes deployment only; starting wealth and measured evidence remain fixed.
                  </p>
                </div>
              </div>
              <div className="solver-results">
                {solver.length ? (
                  solver.map((result) => (
                    <div key={result.goal}>
                      <span>{result.label}</span>
                      <strong>{movementDescription(result)}</strong>
                      <small>
                        {Math.round(result.metrics.businessScore)} character score ·{" "}
                        {result.metrics.feasible
                          ? (result.metrics.economics.viable ? "funding, market, legal & economic criteria pass" : "funding/market/legal pass; economics fail")
                          : "constraints remain open"}
                      </small>
                    </div>
                  ))
                ) : (
                  <div>
                    <span>Stable point</span>
                    <strong>
                      No nearby two-axis move improves the selected goals under the
                      current constraints.
                    </strong>
                  </div>
                )}
              </div>
            </div>
            <p className="solver-economic-status">{metrics.economics.viable && metrics.feasible ? "Current sizing passes the economic, funding, market-capacity and permission screens." : solver.some(s=>s.goal==="sustainable") ? "An economic sizing candidate is shown above. It is conditional on the entered evidence and assumptions." : "No sustainable sizing found on the 0.5-step deployment grid with all other inputs fixed. More starting capital cannot repair negative unit economics; review evidence, costs or the activity itself."}</p>
          </div>
        </section>

        <section className="reading-band">
          <div className="reading-grid">
            <article className="signal-panel">
              <div className="section-kicker">
                <MoveUpRight size={17} />What the current point implies
              </div>
              <div className="signal-list">
                {signals.map((signal) => (
                  <div className={`signal signal-${signal.tone}`} key={signal.title}>
                    <span>
                      {signal.tone === "good" ? (
                        <Check size={15} />
                      ) : signal.tone === "warn" ? (
                        <CircleAlert size={15} />
                      ) : (
                        <Info size={15} />
                      )}
                    </span>
                    <div>
                      <strong>{signal.title}</strong>
                      <p>{signal.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="thesis-panel">
              <span className="eyebrow">The central answer</span>
              <h2>
                The upper layer can be a business while every lower-level robot
                remains an investor, trader, or merchant.
              </h2>
              <p>
                P34 can stay mathematically agnostic. Its output does not become
                “financial advice” because it contains expected profit, loss, time,
                or liquidity. Classification attaches to the deployment: the
                instrument, authority, operational source of return, continuity,
                wrapper, legal stack, and capital scale.
              </p>
              <p className="pull-quote">
                AI removes human labor from the picture. It does not remove
                organization, continuity, market-making, logistics, discretion, or
                legal role.
              </p>
            </article>
          </div>
        </section>

        <article id="model" className="article-body">
          <header className="article-lede">
            <span className="eyebrow">A computational theory, not a binary label</span>
            <h2>Twelve coordinates. Distinct questions.</h2>
            <p>
              The model deliberately excludes “whose capital?” That fact remains an
              external gate because it can flip adviser, broker, pool, and fiduciary
              analysis without changing the operational coordinates. The new starting-capital axis measures funding available, not ownership or control. Operating character, economic viability, market capacity and legal readiness are evaluated separately.
            </p>
          </header>

          <EconomicMethodology />

          <div className="axis-cards">
            {AXES.map((axis, index) => (
              <section key={axis.key}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{axis.label}</h3>
                  <p>{axis.question}</p>
                  <small>{axis.measure}</small>
                  <div className="anchor-row">
                    <em>{axis.low}</em>
                    <em>{axis.midpoint}</em>
                    <em>{axis.high}</em>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <section className="formula-section">
            <div>
              <span className="section-kicker"><Gauge size={17} />The boundary equation</span>
              <h3>Perception and precedent use different weights.</h3>
              <p>
                Both modes apply a logistic classifier, but perception penalizes
                financial instruments more heavily. Precedent mode gives continuity,
                regularity, operational activity, and systematic authority more
                weight—so a securities-trading firm can cross into “business” without
                ceasing to invest. The live workbench above exposes every coefficient;
                changing one redraws the maps and reruns the solver.
              </p>
            </div>
            <div className="formula-card">
              <code>B = 100 ÷ (1 + e<sup>−z</sup>)</code>
              <code>{formulaText(activeFormula)}</code>
              <div>
                <span>Investment-like</span><i />
                <strong>{Math.round(boundaryScore)} boundary</strong>
                <i /><span>Business-like</span>
              </div>
            </div>
          </section>

          <section className="capacity-section">
            <div className="capacity-copy">
              <span className="section-kicker"><Layers3 size={17} />Why capital bends the map</span>
              <h3>Exotic markets are deep in return, shallow in dollars.</h3>
              <p>
                The model estimates accessible capital per market, then asks how many
                independent markets the enterprise must operate. Low-regulation,
                high-operation opportunities start with small capacity. A larger
                capital pool can close only by increasing organizational breadth or
                moving toward deeper regulated venues with sufficient readiness.
              </p>
              <p>
                <strong>Important correction:</strong> large capital does not itself
                cause the SEC to “reclassify” an activity as a public security. If the
                wrapper is already a security, offering rules apply regardless of size;
                capital then changes which exemptions, regulator, filings, and
                institutional controls are available.
              </p>
            </div>
            <div className="capacity-equations">
              <div>
                <span>Per-market capacity</span>
                <code>K = 10^(4.2 + 4.5F + .45(1−O) + .55E − readiness gap − wrapper friction)</code>
              </div>
              <div><span>Markets required</span><code>Nᵣ = ⌈ total capital / K ⌉</code></div>
              <div><span>Markets supported</span><code>Nₛ = ⌊ 1 + 10^(.2 + 2.6E) ⌋</code></div>
              <div><span>Feasible frontier</span><code>Nᵣ ≤ Nₛ and legal readiness ≥ role requirement</code></div>
            </div>
          </section>

          <section className="precedent-section">
            <div className="section-kicker"><BookOpen size={17} />What “precedent mode” really means</div>
            <h3>Precedent informs the factors; the weights remain assumptions.</h3>
            <p>
              The numerical surface translates recurring federal factors into a comparable scale. It has not been fitted to a labeled case dataset and does not estimate the frequency of legal reclassification. Courts and agencies do not apply this score, and state
              law can differ. Each bright-line-looking number is therefore either a
              real statutory/agency threshold shown conditionally, or an explicitly
              invented heuristic boundary.
            </p>
            <div className="precedent-grid">
              <div><strong>Trade or business</strong><p>Continuity, regularity, substantiality, short-term profit-seeking, operations, and customers/inventory.</p></div>
              <div><strong>Regulated role</strong><p>Instrument type plus advice, transaction participation, execution, custody, pooling, public offering, or dealer-like conduct.</p></div>
              <div><strong>Capital thresholds</strong><p>Applied only after a role exists—for example adviser RAUM bands—not as a universal security classifier.</p></div>
            </div>
          </section>
        </article>

        <section id="sources" className="sources-section">
          <div className="sources-head">
            <span className="eyebrow">Primary U.S. authorities</span>
            <h2>What the precedent lens is anchored to</h2>
            <p>
              Federal lens, current to September 18, 2026. Instrument subtype,
              customer relationship, compensation, jurisdiction, exemptions, and
              state law must be analyzed separately.
            </p>
          </div>
          <div className="source-list">
            {[
              ["SEC v. W.J. Howey Co.", "Physical orange groves plus managerial efforts can form an investment contract.", "https://tile.loc.gov/storage-services/service/ll/usrep/usrep328/usrep328293/usrep328293.pdf"],
              ["Reves v. Ernst & Young", "Notes are screened through the Supreme Court's family-resemblance analysis.", "https://www.law.cornell.edu/supremecourt/text/494/56"],
              ["IRS Topic 429", "Investor, trader, and dealer are distinct; substantial, continuous, regular own-account trading can be a business.", "https://www.irs.gov/taxtopics/tc429"],
              ["26 U.S.C. §1221", "Inventory and property held mainly for sale to customers are excluded from capital assets.", "https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title26-section1221"],
              ["SEC · Investment Advisers", "Advice about securities, for compensation, in the business of advising others; RAUM then allocates federal/state oversight.", "https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/investment-advisers"],
              ["SEC · Broker-Dealers", "Transaction participation, execution, transaction compensation, and handling funds are core broker factors.", "https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/broker-dealers"],
              ["SEC · Robo-Advisers", "Algorithmic delivery and limited human interaction do not remove Advisers Act obligations.", "https://www.sec.gov/files/im-guidance-2017-02.pdf"],
              ["CFTC · Intermediaries", "Electronic advice on commodity interests and pooled commodity trading have CTA/CPO definitions.", "https://www.cftc.gov/IndustryOversight/Intermediaries/index.htm"],
              ["15 U.S.C. §77e", "Offers and sales of securities require registration unless an exemption applies.", "https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title15-section77e"],
              ["15 U.S.C. §80a-3", "Investment-company status includes a 40% investment-securities asset test, subject to exclusions and exemptions.", "https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title15-section80a-3"],
            ].map(([title, body, href]) => (
              <a key={title} href={href} target="_blank" rel="noreferrer">
                <div><strong>{title}</strong><p>{body}</p></div>
                <ChevronRight size={18} />
              </a>
            ))}
          </div>
          <aside className="disclaimer">
            <Scale size={18} />
            <p>
              <strong>Research-use disclaimer.</strong> This simulator visualizes a
              proposed theory. It does not determine legal status, recommend a
              transaction, estimate profit, replace counsel, or account for every
              federal, state, foreign, tax, licensing, consumer-protection, gambling,
              money-transmission, or platform rule.
            </p>
          </aside>
        </section>

        <footer>
          <span>P34 Business–Investment Boundary Atlas</span>
          <span>Concept model · Andrew Gree / HyperC</span>
          <a href="#explorer">Back to explorer <ArrowUpRight size={14} /></a>
        </footer>
      </main>
    </TooltipProvider>
  );
}
