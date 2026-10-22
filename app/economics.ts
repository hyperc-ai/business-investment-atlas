import type { Scenario } from './model';

export const ECONOMIC_FIELDS = [
  { key: 'humanCost', label: 'Human operating cost', unit: '% / deal', min: 0, max: 50, step: .1, value: 4, note: 'Same transaction and service quality; cost divided by deal principal.' },
  { key: 'otherCost', label: 'Other variable costs', unit: '% / deal', min: 0, max: 50, step: .1, value: .5, note: 'Fees, slippage, financing, expected default loss and variable robot compute; exclude costs already in the gross spread.' },
  { key: 'fixedCost', label: 'Annual fixed cost', unit: '$ / year', min: 0, max: 100000000, step: 1000, value: 120000, note: 'Include owner salary, maintenance, data, compliance, depreciation and recurring development.' },
  { key: 'ticket', label: 'Executable deal size', unit: '$ principal', min: 1, max: 1000000000, step: 1000, value: 25000, note: 'Indivisible ticket; allocated capital must fund at least one. All deals use this simplified size.' },
  { key: 'cycleDays', label: 'Capital lock-up', unit: 'days', min: 1, max: 365, step: 1, value: 30, note: 'Purchase to cash settlement, including inventory and receivables.' },
  { key: 'dealVolatility', label: 'Held-out deal volatility', unit: '% principal', min: 0, max: 200, step: .1, value: 8, note: 'Standard deviation of selected deals after variable costs; includes losing selections.' },
  { key: 'effectiveN', label: 'Effective validation sample', unit: 'independent deals', min: 1, max: 10000000, step: 1, value: 400, note: 'Independent information after overlap and autocorrelation, not raw rows or training examples.' },
  { key: 'confidenceZ', label: 'Evidence multiplier', unit: 'z', min: 0, max: 4, step: .001, value: 1.645, note: '1.645 gives a one-sided 95% normal approximation under its assumptions. Not a correction for multiple model trials.' },
  { key: 'selectionHaircut', label: 'Selection / drift haircut', unit: 'percentage points', min: 0, max: 20, step: .01, value: .25, note: 'Additional assumed margin reduction for model selection and live execution uncertainty; not a statistically calibrated adjustment.' },
  { key: 'halfLife', label: 'Gross-edge half-life', unit: 'years; 0 = stable', min: 0, max: 100, step: .5, value: 10, note: 'Gross spread converges toward zero. Cost savings persist; improvement through retraining is not assumed.' },
  { key: 'inflation', label: 'Expected inflation', unit: '% / year', min: -5, max: 50, step: .1, value: 3, note: 'Together with the real hurdle defines one nominal discount rate. Never subtracted a second time.' },
  { key: 'realHurdle', label: 'Required real return', unit: '% / year', min: 0, max: 50, step: .1, value: 4, note: 'Risk-appropriate opportunity cost on capital committed to this activity, before tax.' },
  { key: 'cashYield', label: 'Reserve cash yield', unit: '% / year', min: 0, max: 30, step: .1, value: 3, note: 'Nominal yield on the reserve committed to the venture. Uncommitted wealth is excluded.' },
  { key: 'systemicVolatility', label: 'Common annual shock', unit: '% allocated capital', min: 0, max: 200, step: .5, value: 10, note: 'Annual standard deviation that does not disappear when the deal count rises; captures correlated market exposure.' },
  { key: 'reserveMonths', label: 'Reserve target', unit: 'months fixed cost', min: 0, max: 60, step: 1, value: 12, note: 'Target reserve also includes the configured stress loss on deployed capital.' },
  { key: 'stressLoss', label: 'One-off stress loss', unit: '% allocated capital', min: 0, max: 100, step: 1, value: 25, note: 'Separate stress scenario, not a claimed event probability. Reserve must absorb this plus a 95th-percentile deal drought.' },
  { key: 'windowDays', label: 'Availability window', unit: 'days', min: 1, max: 365, step: 1, value: 30, note: 'How long the operator may wait for at least one detected, executable opportunity.' },
  { key: 'availabilityTarget', label: 'Required availability', unit: '% of windows', min: 0, max: 99.9, step: .1, value: 90, note: 'User-defined repeatability criterion, not a definition of business in law.' },
  { key: 'maxInterruption', label: 'Funding interruption limit', unit: '% over horizon', min: .1, max: 50, step: .1, value: 5, note: 'Tolerance for reserve exhaustion while maintaining the chosen deployment; not bankruptcy probability.' },
] as const;
export type EconomicKey = typeof ECONOMIC_FIELDS[number]['key'];
export type EconomicSettings = Record<EconomicKey, number>;
export const DEFAULT_ECONOMICS = Object.fromEntries(ECONOMIC_FIELDS.map(f => [f.key, f.value])) as EconomicSettings;
export const economicCapital = (coordinate: number) => 10 ** (3 + 7 * coordinate / 100);
export const grossEdge = (coordinate: number) => (-5 + .2 * coordinate) / 100;
export const opportunityRate = (coordinate: number) => 10 ** (coordinate / 25) - 1;
export const horizonYears = (coordinate: number) => Math.round(1 + 29 * coordinate / 100);
const clamp = (v: number, lo=0, hi=1) => Math.max(lo, Math.min(hi, v));

// Normal CDF approximation, with log-tail evaluation to keep first-passage terms stable.
function logPhi(x: number): number {
  if (x < -8) {
    const a = -x;
    return -.5*a*a - Math.log(a) - .5*Math.log(2*Math.PI) + Math.log(1 - 1/(a*a) + 3/(a**4) - 15/(a**6));
  }
  const t = 1 / (1 + .2316419 * Math.abs(x));
  const tail = .3989422804014327 * Math.exp(-x*x/2) * t * (.31938153 + t*(-.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429))));
  return Math.log(x < 0 ? tail : 1-tail);
}
export function fundingInterruption(buffer: number, annualDrift: number, annualSd: number, years: number) {
  if (buffer < 0) return 1;
  if (annualSd < 1e-9) return buffer + Math.min(0, annualDrift)*years < 0 ? 1 : 0;
  if (buffer === 0) return 1;
  const scale = annualSd*Math.sqrt(years);
  const first = Math.exp(logPhi((-buffer-annualDrift*years)/scale));
  const secondLog = -2*annualDrift*buffer/(annualSd*annualSd) + logPhi((-buffer+annualDrift*years)/scale);
  return clamp(first + Math.exp(Math.min(0, secondLog)));
}

export function calculateEconomics(s: Scenario, a: EconomicSettings = DEFAULT_ECONOMICS) {
  const allocated = economicCapital(s.capital);
  const available = economicCapital(s.resources);
  const years = horizonYears(s.horizon);
  const lambda = opportunityRate(s.flow);
  const gross = grossEdge(s.edge);
  const saving = a.humanCost / 100 * s.efficiency / 100;
  const robotCost = a.humanCost / 100 - saving;
  const variableCost = robotCost + a.otherCost / 100;
  const haircut = a.confidenceZ * (a.dealVolatility / 100) / Math.sqrt(a.effectiveN) + a.selectionHaircut / 100;
  const slots = Math.floor(allocated / a.ticket);
  const deals = Math.min(lambda, slots * 365 / a.cycleDays);
  const volume = deals * a.ticket;
  const decay = a.halfLife === 0 ? 0 : Math.LN2/a.halfLife;
  const decayAverage = decay === 0 ? 1 : -Math.expm1(-decay*years)/(decay*years);
  const netEdge = gross - variableCost;
  const humanEdge = gross - a.humanCost/100 - a.otherCost/100;
  const lowerEdge = gross - variableCost - haircut;
  const horizonEdge = gross*decayAverage - variableCost - haircut;
  const terminalEdge = gross*Math.exp(-decay*years) - variableCost - haircut;
  const reserveTarget = a.fixedCost*a.reserveMonths/12 + allocated*a.stressLoss/100;
  const reserve = Math.min(Math.max(0, available-allocated), reserveTarget);
  const committed = allocated + reserve;
  const unused = Math.max(0, available-committed);
  const nominalHurdle = (1+a.inflation/100)*(1+a.realHurdle/100)-1;
  const cashIncome = reserve*a.cashYield/100;
  const annualProfit = volume*horizonEdge-a.fixedCost+cashIncome;
  const annualCurrentProfit = volume*netEdge-a.fixedCost+cashIncome;
  const annualHumanProfit = volume*humanEdge-a.fixedCost+cashIncome;
  const discount = 1/(1+nominalHurdle);
  const annuity = Math.abs(nominalHurdle) < 1e-10 ? years : (1-discount**years)/nominalHurdle;
  const decayFirstYear = decay === 0 ? 1 : -Math.expm1(-decay)/decay;
  const ratio = Math.exp(-decay)*discount;
  const geometric = Math.abs(1-ratio) < 1e-10 ? years : (1-ratio**years)/(1-ratio);
  const pvGross = volume*gross*decayFirstYear*discount*geometric;
  const npv = pvGross - (volume*(variableCost+haircut)+a.fixedCost-cashIncome)*annuity - committed + committed*discount**years;
  const annualSurplus = npv/annuity;
  const humanNpv = npv-volume*saving*annuity;
  const requiredNetEdge = volume > 0 ? (a.fixedCost+nominalHurdle*committed-cashIncome)/volume : Infinity;
  const availability = -Math.expm1(-lambda*a.windowDays/365);
  const droughtDays = lambda > 0 ? -Math.log(.05)*365/lambda : Infinity;
  const stressRequired = allocated*a.stressLoss/100 + (a.fixedCost === 0 ? 0 : a.fixedCost*(droughtDays+a.cycleDays)/365);
  const stressMargin = reserve-stressRequired;
  // Drift uses the WORST endpoint of the decaying gross edge: a conservative envelope.
  const drift = volume*Math.min(lowerEdge, terminalEdge)-a.fixedCost;
  const variance = deals*a.ticket*a.ticket*((a.dealVolatility/100)**2+Math.max(Math.abs(lowerEdge),Math.abs(terminalEdge))**2) + (allocated*a.systemicVolatility/100)**2;
  const annualSd = Math.sqrt(variance);
  const interruption = available < allocated ? 1 : fundingInterruption(reserve, drift, annualSd, years);
  const gates = [
    {label:'Fund the deployment', margin:(available-allocated)/Math.max(1,allocated)},
    {label:'Fund one executable ticket', margin:allocated/a.ticket-1},
    {label:'Evidence-adjusted positive edge', strict:true, margin:Math.min(lowerEdge,terminalEdge)/.01},
    {label:'Positive discounted economic surplus', strict:true, margin:annualSurplus/Math.max(1,a.fixedCost+Math.abs(nominalHurdle)*committed)},
    {label:'Repeatable opportunity coverage', margin:(availability-a.availabilityTarget/100)/Math.max(.001,1-a.availabilityTarget/100)},
    {label:'Funding interruption within tolerance', margin:(a.maxInterruption/100-interruption)/(a.maxInterruption/100)},
    {label:'Stress loss plus deal drought funded', margin:stressMargin/Math.max(1,reserveTarget)},
  ];
  const bottleneck = gates.reduce((worst,g) => g.margin < worst.margin ? g : worst);
  const viable = gates.every(g=>g.strict ? g.margin > 0 : g.margin >= 0) && deals > 0;
  return {allocated,available,years,lambda,saving,robotCost,variableCost,haircut,deals,volume,netEdge,humanEdge,lowerEdge,horizonEdge,terminalEdge,reserveTarget,reserve,committed,unused,nominalHurdle,cashIncome,annualProfit,annualCurrentProfit,annualHumanProfit,annualSurplus,npv,humanNpv,requiredNetEdge,availability,droughtDays,stressRequired,stressMargin,drift,annualSd,interruption,gates,bottleneck,viable,margin:bottleneck.margin,score:100/(1+Math.exp(-3*clamp(bottleneck.margin,-200,200))),fundingMargin:(available-allocated)/allocated};
}
export type EconomicMetrics = ReturnType<typeof calculateEconomics>;
