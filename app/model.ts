import { calculateEconomics, DEFAULT_ECONOMICS, grossEdge, opportunityRate, horizonYears, type EconomicSettings, type EconomicMetrics } from "./economics";
export type Mode = "perceived" | "precedent";

export type AxisKey =
  | "asset"
  | "authority"
  | "operations"
  | "enterprise"
  | "wrapper"
  | "readiness"
  | "capital"
  | "resources" | "efficiency" | "edge" | "flow" | "horizon";

export type Scenario = Record<AxisKey, number>;

export type BusinessFormulaSettings = {
  intercept: number;
  operations: number;
  enterprise: number;
  authority: number;
  capital: number;
  readiness: number;
  wrapper: number;
  asset: number;
  operationsEnterprise: number;
  enterpriseAuthority: number;
  capitalEnterprise: number;
  operationsNonAsset: number;
};

export const DEFAULT_BUSINESS_FORMULAS: Record<Mode, BusinessFormulaSettings> = {
  perceived: {
    intercept: -1.62,
    operations: 2.58,
    enterprise: 2.2,
    authority: 0.62,
    capital: 0.46,
    readiness: 0.28,
    wrapper: 0.16,
    asset: -1.48,
    operationsEnterprise: 0.66,
    enterpriseAuthority: 0.54,
    capitalEnterprise: 0.28,
    operationsNonAsset: 0,
  },
  precedent: {
    intercept: -1.94,
    operations: 2.08,
    enterprise: 2.48,
    authority: 0.78,
    capital: 0.34,
    readiness: 0.16,
    wrapper: 0.22,
    asset: -0.52,
    operationsEnterprise: 0,
    enterpriseAuthority: 0.96,
    capitalEnterprise: 0.38,
    operationsNonAsset: 0.72,
  },
};

export type AxisDefinition = {
  key: AxisKey;
  short: string;
  label: string;
  question: string;
  measure: string;
  low: string;
  midpoint: string;
  high: string;
};

export const AXES: AxisDefinition[] = [
  {
    key: "asset",
    short: "Instrument exposure",
    label: "Regulated-instrument exposure",
    question: "How much allocated capital sits inside a financial-law perimeter?",
    measure:
      "Percent of committed capital in securities, investment contracts, commodity interests, notes, or close substitutes. Whole goods and operational inventory score near 0.",
    low: "0 · goods / operating assets",
    midpoint: "50 · mixed claims and assets",
    high: "100 · securities / derivatives",
  },
  {
    key: "authority",
    short: "Robot authority",
    label: "Robot decision authority",
    question: "How far can the robot move from measurement toward control?",
    measure:
      "Five permission stages: rank, recommend, allocate under standing rules, execute, and transfer/custody. Score each granted stage as 20 points.",
    low: "0 · measurement only",
    midpoint: "50 · transaction recommendation",
    high: "100 · execution + custody",
  },
  {
    key: "operations",
    short: "Operational value",
    label: "Operational share of return",
    question: "How much of expected spread requires doing rather than owning?",
    measure:
      "Estimated percent of gross expected return attributable to sourcing, logistics, transformation, merchandising, servicing, collections, or other post-decision operations.",
    low: "0 · yield / appreciation",
    midpoint: "50 · arbitrage + execution",
    high: "100 · transformation / commerce",
  },
  {
    key: "enterprise",
    short: "Enterprise intensity",
    label: "Enterprise intensity",
    question: "Is this an occasional allocation or a continuously managed system?",
    measure:
      "Composite of decision frequency (35%), active days (25%), distinct markets (20%), and automated launch/monitor/retirement capability (20%).",
    low: "0 · occasional allocation",
    midpoint: "50 · systematic program",
    high: "100 · continuous multi-market firm",
  },
  {
    key: "wrapper",
    short: "Wrapper intensity",
    label: "Participation / product wrapper",
    question: "What is actually offered around the robot?",
    measure:
      "0 internal engine; 20 general analytics; 40 individualized scoring; 60 managed account; 80 pooled vehicle; 100 broadly marketed profit participation.",
    low: "0 · proprietary / internal",
    midpoint: "50 · individualized service",
    high: "100 · public profit participation",
  },
  {
    key: "readiness",
    short: "Legal readiness",
    label: "Regulatory and market-access readiness",
    question: "How much of the required permission stack is actually in place?",
    measure:
      "Percent of the role-specific stack completed: legal classification, territorial limits, exemptions/registrations, licensed partners, custody, execution, surveillance, records, disclosures, and controls.",
    low: "0 · no mapped legal basis",
    midpoint: "50 · one role / partner covered",
    high: "100 · full role-specific stack",
  },
  {
    key: "capital",
    short: "Capital allocated",
    label: "Total capital allocated",
    question: "How much capital is concurrently committed across all robots?",
    measure:
      "Peak concurrent capital committed or controlled, plotted logarithmically from $1,000 to $10 billion. This is not revenue, annual GMV, or automatically regulatory AUM.",
    low: "0 · $1K",
    midpoint: "50 · $3.16M",
    high: "100 · $10B",
  },
];

export const ECONOMIC_COORDINATES = { resources: 55, efficiency: 80, edge: 50, flow: 75, horizon: 400/29 };

AXES.push(
  {key:'resources',short:'Starting capital',label:'Starting capital available',question:'How much liquid risk capital can this operator commit?',measure:'Available funding for this venture, not total personal wealth. Allocation plus a target reserve is committed; surplus wealth remains outside the return denominator. Log scale $1K–$10B.',low:'0 · $1K',midpoint:'50 · $3.16M',high:'100 · $10B'},
  {key:'efficiency',short:'Robot cost saving',label:'Robot operating-cost reduction',question:'How much cheaper is the same operation with the robot?',measure:'Percent reduction in human variable operating cost for the same deal and service quality. Robot cost = human cost × (1 − saving). Other costs and fixed overhead remain.',low:'0 · no saving',midpoint:'50 · half the labor cost',high:'100 · human cost eliminated'},
  {key:'edge',short:'Gross deal spread',label:'Held-out gross deal spread',question:'What is the average gross return on selected executable deals?',measure:'Gross profit divided by deal principal, before the configured costs. From −5% to +15%. Validate chronologically on unseen data and include losing selections.',low:'0 · −5% / deal',midpoint:'50 · +5% / deal',high:'100 · +15% / deal'},
  {key:'flow',short:'Opportunity flow',label:'Detected executable opportunities',question:'How often can the discriminator find an executable deal?',measure:'Observed annual count of qualifying opportunities at the configured ticket size, before capital limits. λ = 10^(coordinate/25) − 1. No architecture guarantees their existence.',low:'0 · none',midpoint:'50 · 99 / year',high:'100 · 9,999 / year'},
  {key:'horizon',short:'Operating horizon',label:'Economic evaluation horizon',question:'For how long must this strategy fund itself?',measure:'1–30 years, rounded to whole years. Longer horizons expose edge decay and reserve exhaustion. No finite horizon proves permanence.',low:'0 · 1 year',midpoint:'50 · 16 years',high:'100 · 30 years'},
);

export const DEFAULT_SCENARIO: Scenario = {
  ...ECONOMIC_COORDINATES,
  asset: 16,
  authority: 82,
  operations: 72,
  enterprise: 84,
  wrapper: 18,
  readiness: 28,
  capital: 48,
};

export const PRESETS: Array<{
  name: string;
  note: string;
  values: Scenario;
}> = [
  {
    name: "P34 merchant fleet",
    note: "100 robots across fragmented real-sector markets",
    values: DEFAULT_SCENARIO,
  },
  {
    name: "One ETF selector",
    note: "Occasional recommendation for a financial instrument",
    values: {
      ...ECONOMIC_COORDINATES,
      asset: 100,
      authority: 42,
      operations: 4,
      enterprise: 12,
      wrapper: 8,
      readiness: 18,
      capital: 24,
    },
  },
  {
    name: "Game-inventory arbitrage",
    note: "Cross-venue sourcing and resale with modest capacity",
    values: {
      ...ECONOMIC_COORDINATES,
      asset: 18,
      authority: 76,
      operations: 58,
      enterprise: 67,
      wrapper: 12,
      readiness: 24,
      capital: 34,
    },
  },
  {
    name: "Pooled pallet venture",
    note: "Operating activity wrapped as passive participation",
    values: {
      ...ECONOMIC_COORDINATES,
      asset: 8,
      authority: 90,
      operations: 84,
      enterprise: 78,
      wrapper: 88,
      readiness: 34,
      capital: 52,
    },
  },
  {
    name: "Securities robo-adviser",
    note: "Automated managed accounts on regulated instruments",
    values: {
      ...ECONOMIC_COORDINATES,
      asset: 100,
      authority: 82,
      operations: 8,
      enterprise: 82,
      wrapper: 64,
      readiness: 78,
      capital: 74,
    },
  },
  {
    name: "Proprietary trading firm",
    note: "Continuous own-account financial trading",
    values: {
      ...ECONOMIC_COORDINATES,
      asset: 100,
      authority: 94,
      operations: 14,
      enterprise: 94,
      wrapper: 6,
      readiness: 58,
      capital: 70,
    },
  },
];

export type Metrics = {
  businessScore: number;
  economics: EconomicMetrics;
  operationallyFeasible: boolean;
  regulatoryScore: number;
  requiredReadiness: number;
  permissionMargin: number;
  capitalDollars: number;
  perMarketCapacity: number;
  supportedMarkets: number;
  requiredMarkets: number;
  capacityMargin: number;
  feasible: boolean;
  classification: string;
  regulatoryLabel: string;
};

export type SolverResult = {
  goal: "reclassify" | "feasible" | "de-risk" | "sustainable";
  label: string;
  target: Scenario;
  changes: Array<{ axis: AxisKey; from: number; to: number }>;
  metrics: Metrics;
  cost: number;
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export function capitalDollars(value: number) {
  return 10 ** (3 + (clamp(value, 0, 100) / 100) * 7);
}

export function formatMoney(value: number) {
  if (value >= 1_000_000_000)
    return `$${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 0 : 1)}B`;
  if (value >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(value >= 100_000_000 ? 0 : 1)}M`;
  if (value >= 1_000)
    return `$${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return `$${Math.round(value)}`;
}

export function formatAxisValue(key: AxisKey, value: number, compact = false) {
  if (key === "edge") return `${(grossEdge(value)*100).toFixed(2)}%`;
  if (key === "flow") return `${opportunityRate(value).toFixed(0)} / yr`;
  if (key === "horizon") return `${horizonYears(value)} yr`;
  if (key === "efficiency") return `${Math.round(value)}%`;
  if (key === "capital" || key === "resources") return formatMoney(capitalDollars(value));
  return compact ? `${Math.round(value)}` : `${Math.round(value)} / 100`;
}

export function axisDefinition(key: AxisKey) {
  return AXES.find((axis) => axis.key === key)!;
}

export function classificationFor(score: number, boundaryScore = 50) {
  if (score < boundaryScore - 15) return "Investor-like";
  if (score < boundaryScore) return "Investment-led hybrid";
  if (score < boundaryScore + 15) return "Business-led hybrid";
  return "Enterprise / trading business";
}

export function regulatoryLabelFor(score: number) {
  if (score < 25) return "Low perimeter contact";
  if (score < 50) return "Role-specific review";
  if (score < 70) return "Likely regulated-role screen";
  return "High regulatory dependence";
}

export function businessLogit(
  s: Scenario,
  settings: BusinessFormulaSettings,
) {
  const f = s.asset / 100;
  const a = s.authority / 100;
  const o = s.operations / 100;
  const e = s.enterprise / 100;
  const w = s.wrapper / 100;
  const r = s.readiness / 100;
  const c = s.capital / 100;

  return (
    settings.intercept +
    settings.operations * o +
    settings.enterprise * e +
    settings.authority * a +
    settings.capital * c +
    settings.readiness * r +
    settings.wrapper * w +
    settings.asset * f +
    settings.operationsEnterprise * o * e +
    settings.enterpriseAuthority * e * a +
    settings.capitalEnterprise * c * e +
    settings.operationsNonAsset * o * (1 - f)
  );
}

export function calculateMetrics(
  s: Scenario,
  mode: Mode,
  formula = DEFAULT_BUSINESS_FORMULAS[mode],
  boundaryScore = 50,
  economicSettings = DEFAULT_ECONOMICS,
): Metrics {
  const f = s.asset / 100;
  const a = s.authority / 100;
  const o = s.operations / 100;
  const e = s.enterprise / 100;
  const w = s.wrapper / 100;
  const r = s.readiness / 100;
  const c = s.capital / 100;

  const businessScore = 100 * sigmoid(businessLogit(s, formula));

  const adviserSignal =
    f * smoothstep(0.22, 0.86, a) * (0.14 + 0.86 * w);
  const brokerSignal =
    f * smoothstep(0.58, 0.98, a) * (0.1 + 0.9 * w);
  const howeySignal =
    smoothstep(0.52, 0.96, w) * (0.42 + 0.58 * a);
  const companySignal =
    smoothstep(0.38, 0.78, f) * smoothstep(0.58, 0.94, w);
  const dealingSignal =
    f * e * smoothstep(0.5, 0.96, a) * (0.22 + 0.78 * w);
  const precedentTrigger = Math.max(
    adviserSignal,
    brokerSignal,
    howeySignal,
    companySignal * 0.76,
    dealingSignal * 0.58,
  );
  const perceivedTrigger = clamp(
    0.16 * f + 0.18 * w + 0.34 * a * w + 0.2 * f * a + 0.12 * c * w,
  );
  const trigger = mode === "precedent" ? precedentTrigger : perceivedTrigger;
  const regulatoryScore =
    100 *
    clamp(
      (mode === "precedent" ? 0.07 * f + 0.06 * w : 0.03 * f) +
        0.84 * trigger +
        0.11 * c * trigger,
    );

  const requiredReadiness =
    100 *
    clamp(
      0.018 +
        0.62 * precedentTrigger +
        0.15 * f * a * e +
        0.12 * c * precedentTrigger,
    );

  const capital = capitalDollars(s.capital);
  const readinessPenalty = 4 * Math.max(0, 0.9 * f - r);
  const wrapperPenalty = 0.62 * w * (1 - r);
  const logMarketCapacity = clamp(
    4.2 +
      4.5 * f +
      0.45 * (1 - o) +
      0.55 * e -
      readinessPenalty -
      wrapperPenalty,
    3,
    10.5,
  );
  const perMarketCapacity = 10 ** logMarketCapacity;
  const supportedMarkets = Math.max(1, Math.floor(1 + 10 ** (0.2 + 2.6 * e)));
  const requiredMarkets = Math.max(1, Math.ceil(capital / perMarketCapacity));
  const capacityMargin = Math.log10(
    (perMarketCapacity * supportedMarkets) / capital,
  );
  const permissionMargin = s.readiness - requiredReadiness;
  const economics = calculateEconomics(s, economicSettings);
  const operationallyFeasible = capacityMargin >= 0 && permissionMargin >= 0;
  const feasible = operationallyFeasible && economics.fundingMargin >= 0 && economics.allocated >= economicSettings.ticket;

  return {
    businessScore,
    economics,
    operationallyFeasible,
    regulatoryScore,
    requiredReadiness,
    permissionMargin,
    capitalDollars: capital,
    perMarketCapacity,
    supportedMarkets,
    requiredMarkets,
    capacityMargin,
    feasible,
    classification: classificationFor(businessScore, boundaryScore),
    regulatoryLabel: regulatoryLabelFor(regulatoryScore),
  };
}

export function legalSignals(s: Scenario, metrics: Metrics) {
  const notes: Array<{ title: string; body: string; tone: "plain" | "warn" | "good" }> = [];
  const capital = metrics.capitalDollars;
  const adviserLike = s.asset >= 60 && s.authority >= 35 && s.wrapper >= 30;

  if (s.wrapper >= 72) {
    notes.push({
      title: "Offering / investment-contract screen",
      body:
        "A profit-participation wrapper can itself be a security even when every underlying deal is a pallet, domain, or orange grove. There is no small-dollar rule that prevents security status; registration or an exemption is a separate question.",
      tone: "warn",
    });
  }

  if (adviserLike) {
    notes.push({
      title: "Adviser screen",
      body:
        "This combination resembles compensated, businesslike advice about securities. A human approval click does not reliably neutralize algorithmic advice; the precise customer, compensation, exclusion, and jurisdiction facts still sit outside this model.",
      tone: "warn",
    });
  }

  if (s.asset >= 65 && s.authority >= 72 && s.wrapper >= 34) {
    notes.push({
      title: "Broker, execution, and custody screen",
      body:
        "Transaction participation, execution, outcome-based compensation, and handling funds or securities are classic escalation facts. Readiness must cover the actual role, not merely model accuracy.",
      tone: "warn",
    });
  }

  if (s.asset >= 40 && s.wrapper >= 64) {
    notes.push({
      title: "Investment-company composition screen",
      body:
        "For an issuer, the Investment Company Act includes a 40% investment-securities asset test, with important exclusions and exemptions. This axis is only a rough proxy for that statutory balance-sheet test.",
      tone: "warn",
    });
  }

  if (adviserLike && capital >= 25_000_000) {
    const band =
      capital >= 110_000_000
        ? "At or above the SEC's general $110M mandatory-registration threshold"
        : capital >= 100_000_000
          ? "Within the SEC-registration buffer beginning at $100M"
          : "Within the $25M–$100M mid-sized adviser band";
    notes.push({
      title: "If this capital is RAUM",
      body: `${band}. Capital only selects the regulator after adviser status exists; it does not create adviser status by itself.`,
      tone: "plain",
    });
  }

  if (metrics.capacityMargin < 0) {
    notes.push({
      title: "Fragmented-market capacity exceeded",
      body: `The model needs about ${metrics.requiredMarkets.toLocaleString()} parallel markets at this asset mix, but enterprise intensity supports roughly ${metrics.supportedMarkets.toLocaleString()}. Reduce capital, add market breadth, or move toward deeper venues with the required legal access.`,
      tone: "warn",
    });
  } else if (s.asset < 35 && capital >= 1_000_000) {
    notes.push({
      title: "Diversification is doing the scaling work",
      body: `At this point, one exotic market is estimated to absorb ${formatMoney(metrics.perMarketCapacity)}. The enterprise layer can support about ${metrics.supportedMarkets.toLocaleString()} markets, which is why the capital remains deployable.`,
      tone: "good",
    });
  }

  if (metrics.permissionMargin < 0) {
    notes.push({
      title: "Permission stack is behind the role",
      body: `The heuristic requires about ${Math.round(metrics.requiredReadiness)} readiness points; the scenario supplies ${Math.round(s.readiness)}. Constrain the wrapper/authority, add a registered partner or license path, or change the instrument mix before adding capital.`,
      tone: "warn",
    });
  } else {
    notes.push({
      title: "Permission screen currently passes",
      body:
        "Role-specific readiness meets the heuristic requirement. Market capacity, available funding and economic viability are reported separately; this is not a legal opinion.",
      tone: "good",
    });
  }

  return notes.slice(0, 4);
}

const movementWeights: Record<AxisKey, number> = {
  asset: 1.25,
  authority: 0.9,
  operations: 1.15,
  enterprise: 0.78,
  wrapper: 1.1,
  readiness: 0.68,
  capital: 1.35, resources: 2, efficiency: 2, edge: 3, flow: 3, horizon: 2,
};

function movementAllowed(from: Scenario, to: Scenario, metrics: Metrics) {
  if (metrics.economics.fundingMargin < 0) return false;
  if (to.capital > from.capital && metrics.capacityMargin < 0) return false;
  if (to.asset > from.asset && to.asset >= 70 && to.readiness < 45) return false;
  if (to.wrapper > from.wrapper && to.wrapper >= 75 && to.readiness < 55)
    return false;
  if (to.capital >= 65 && to.asset < 35 && to.enterprise < 50) return false;
  return true;
}

function movementCost(from: Scenario, to: Scenario) {
  let squared = 0;
  let changed = 0;
  for (const axis of AXES) {
    const delta = (to[axis.key] - from[axis.key]) / 100;
    if (Math.abs(delta) > 0.001) changed += 1;
    squared += movementWeights[axis.key] * delta * delta;
  }
  return Math.sqrt(squared) + Math.max(0, changed - 1) * 0.035;
}

function scenarioChanges(from: Scenario, to: Scenario) {
  return AXES.flatMap((axis) =>
    Math.abs(from[axis.key] - to[axis.key]) >= 0.001
      ? [{ axis: axis.key, from: from[axis.key], to: to[axis.key] }]
      : [],
  );
}

function candidatesFor(current: number) {
  return Array.from(
    new Set([
      current,
      ...Array.from({ length: 11 }, (_, index) => index * 10),
      Math.max(0, current - 15),
      Math.min(100, current + 15),
    ]),
  ).sort((a, b) => a - b);
}

function findNearest(
  from: Scenario,
  mode: Mode,
  formula: BusinessFormulaSettings,
  boundaryScore: number,
  predicate: (metrics: Metrics) => boolean,
  economics: EconomicSettings,
): { scenario: Scenario; metrics: Metrics; cost: number } | null {
  let best: { scenario: Scenario; metrics: Metrics; cost: number } | null = null;
  const keys = AXES.map((axis) => axis.key).filter(key => !["resources", "efficiency", "edge", "flow", "horizon"].includes(key));

  const consider = (candidate: Scenario) => {
    const metrics = calculateMetrics(candidate, mode, formula, boundaryScore, economics);
    if (!predicate(metrics) || !movementAllowed(from, candidate, metrics)) return;
    const cost = movementCost(from, candidate);
    if (!best || cost < best.cost) best = { scenario: candidate, metrics, cost };
  };

  for (const key of keys) {
    for (const value of candidatesFor(from[key])) {
      consider({ ...from, [key]: value });
    }
  }

  for (let first = 0; first < keys.length; first += 1) {
    for (let second = first + 1; second < keys.length; second += 1) {
      const a = keys[first];
      const b = keys[second];
      for (const aValue of candidatesFor(from[a])) {
        for (const bValue of candidatesFor(from[b])) {
          consider({ ...from, [a]: aValue, [b]: bValue });
        }
      }
    }
  }

  return best;
}

export function solveScenario(
  s: Scenario,
  mode: Mode,
  formula = DEFAULT_BUSINESS_FORMULAS[mode],
  boundaryScore = 50,
  economics = DEFAULT_ECONOMICS,
): SolverResult[] {
  const current = calculateMetrics(s, mode, formula, boundaryScore, economics);
  const reclassifyTowardBusiness = current.businessScore < boundaryScore;
  const reclassified = findNearest(s, mode, formula, boundaryScore, (metrics) =>
    reclassifyTowardBusiness
      ? metrics.businessScore >= boundaryScore + 6 && metrics.feasible
      : metrics.businessScore <= boundaryScore - 6 && metrics.feasible,
    economics,
  );
  const feasible = current.feasible
    ? null
    : findNearest(
        s,
        mode,
        formula,
        boundaryScore,
        (metrics) => metrics.capacityMargin >= 0.08 && metrics.permissionMargin >= 0 && metrics.feasible,
        economics,
      );
  const deRisked =
    current.regulatoryScore <= 45
      ? null
      : findNearest(
          s,
          mode,
          formula,
          boundaryScore,
          (metrics) => metrics.regulatoryScore <= 42 && metrics.feasible,
          economics,
        );

  const output: SolverResult[] = [];
  if (reclassified) {
    output.push({
      goal: "reclassify",
      label: reclassifyTowardBusiness
        ? "Nearest business-like point"
        : "Nearest investment-like point",
      target: reclassified.scenario,
      changes: scenarioChanges(s, reclassified.scenario),
      metrics: reclassified.metrics,
      cost: reclassified.cost,
    });
  }
  if (feasible) {
    output.push({
      goal: "feasible",
      label: "Nearest constraint-closing point",
      target: feasible.scenario,
      changes: scenarioChanges(s, feasible.scenario),
      metrics: feasible.metrics,
      cost: feasible.cost,
    });
  }
  if (deRisked) {
    output.push({
      goal: "de-risk",
      label: "Nearest lower-regulatory point",
      target: deRisked.scenario,
      changes: scenarioChanges(s, deRisked.scenario),
      metrics: deRisked.metrics,
      cost: deRisked.cost,
    });
  }
  // Size only within existing funding and measured opportunities; never invent wealth or an edge.
  if (!current.economics.viable || !current.feasible) {
    let best: SolverResult | null = null;
    for (let capital=0; capital<=100; capital+=.5) {
      const target = {...s, capital};
      const metrics = calculateMetrics(target, mode, formula, boundaryScore, economics);
      if (!metrics.feasible || !metrics.economics.viable || !movementAllowed(s,target,metrics)) continue;
      const cost = movementCost(s,target);
      if (!best || cost < best.cost) best = {goal:'sustainable',label:'Economically sustainable sizing',target,metrics,cost,changes:scenarioChanges(s,target)};
    }
    if (best) output.unshift(best);
  }
  return output;
}

export function movementDescription(result: SolverResult) {
  if (!result.changes.length) return "No coordinate movement needed.";
  return result.changes
    .map((change) => {
      const axis = axisDefinition(change.axis);
      const direction = change.to > change.from ? "raise" : "lower";
      return `${direction} ${axis.short.toLowerCase()} to ${formatAxisValue(change.axis, change.to)}`;
    })
    .join("; ");
}
