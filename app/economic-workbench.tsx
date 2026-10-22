'use client';
import { type Scenario, formatMoney } from './model';
import { calculateEconomics, DEFAULT_ECONOMICS, ECONOMIC_FIELDS, type EconomicSettings, type EconomicMetrics, type EconomicKey } from './economics';
const pct = (n: number) => `${(n*100).toFixed(2)}%`;
const probability = (n:number) => n >= .99995 ? ">99.99%" : n>0 && n<.00005 ? "<0.01%" : pct(n);
const money = (n: number) => `${n<0?'−':''}${formatMoney(Math.abs(n))}`;

export function EconomicWorkbench({scenario,settings,metrics,onChange,onScenarioChange}:{scenario:Scenario;settings:EconomicSettings;metrics:EconomicMetrics;onChange:(a:EconomicSettings)=>void;onScenarioChange:(s:Scenario)=>void}) {
  const e=metrics;
  const comparisons = [
    {label:'Thinly funded', available:e.allocated*1.02},
    {label:'Target reserve funded', available:e.allocated+e.reserveTarget},
  ].map(v=>({...v, metrics:calculateEconomics({...scenario,resources:Math.min(100,Math.max(0,(Math.log10(v.available)-3)/7*100))},settings)}));
  return <section className="economic-workbench" aria-labelledby="economic-title">
    <div className="economic-heading"><div><span className="eyebrow">Economic viability · illustrative assumptions</span><h3 id="economic-title">Can this operator sustain the strategy?</h3></div><strong className={e.viable?'economic-pass':'economic-fail'}>{e.viable?'Passes configured criteria':'Criteria not met'}</strong></div>
    <p className="economic-caption">{e.viable?'All seven economic gates pass.':`Binding constraint: ${e.bottleneck.label}.`} Operating identity and legal classification remain separate. {e.npv>0 && e.humanNpv<=0 ? "Automation changes the human counterfactual from economic loss to positive NPV under the same overhead and capital assumptions." : ""}</p>
    <div className="economic-summary">
      <div><span>Robot / human net edge</span><strong>{pct(e.netEdge)} / {pct(e.humanEdge)}</strong><small>per dollar of deal principal; before fixed cost</small></div>
      <div><span>Conservative NPV · {e.years} years</span><strong className={e.npv>=0?'economic-pass':'economic-fail'}>{money(e.npv)}</strong><small>{money(e.annualSurplus)} equivalent annual surplus</small></div>
      <div><span>Opportunity availability</span><strong>{probability(e.availability)}</strong><small>≥1 qualifying opportunity in {settings.windowDays} days; target {settings.availabilityTarget}%</small></div>
      <div><span>Funding interruption proxy</span><strong className={e.interruption<=settings.maxInterruption/100?'economic-pass':'economic-fail'}>{probability(e.interruption)}</strong><small>over {e.years} years; tolerance {settings.maxInterruption}%</small></div>
    </div>
    <div className="economic-live-formula">
      <code>Robot edge = gross spread − human cost × (1 − saving) − other costs</code>
      <code>Evidence-adjusted edge = robot edge − z·σ/√nₑff − haircut = {pct(e.lowerEdge)}</code>
      <code>NPV = −C + Σ [V·mₗ(t) − F + reserve yield] / (1+h)ᵗ + C / (1+h)ᴴ</code>
      <p>V = {formatMoney(e.volume)} executed principal/year · C = {formatMoney(e.committed)} committed · h = {pct(e.nominalHurdle)} nominal hurdle. Gross spread decays; the displayed NPV includes capital recovery at the horizon.</p>
    </div>
    <details className="assumption-editor economic-details"><summary><span>Configure economics & inspect every gate</span><small>Costs · evidence · inflation · risk · time</small></summary>
      <div className="assumption-editor-body">
        <div className="economic-controls">{ECONOMIC_FIELDS.map(field=><label className="economic-field" key={field.key}><span>{field.label}<em>{field.unit}</em></span><input aria-label={field.label} type="number" min={field.min} max={field.max} step={field.step} value={settings[field.key]} onChange={event=>{const n=event.currentTarget.valueAsNumber;if(Number.isFinite(n))onChange({...settings,[field.key]:Math.min(field.max,Math.max(field.min,n))});}}/><small>{field.note}</small></label>)}</div>
        <div className="economic-detail-grid">
          <div><h4>The bridge from margin to survival</h4><dl>
            <dt>Operating saving</dt><dd>{pct(e.saving)} points per deal</dd>
            <dt>Initial net edge after evidence haircut</dt><dd>{pct(e.lowerEdge)}</dd>
            <dt>Conservative edge at horizon end</dt><dd>{pct(e.terminalEdge)}</dd>
            <dt>Executed deals / year</dt><dd>{e.deals.toFixed(1)} of {e.lambda.toFixed(1)} detected</dd>
            <dt>Flat-edge break-even net margin</dt><dd>{Number.isFinite(e.requiredNetEdge)?pct(e.requiredNetEdge):'No throughput'}</dd>
            <dt>Robot / human annual cash profit today</dt><dd>{money(e.annualCurrentProfit)} / {money(e.annualHumanProfit)}</dd>
            <dt>Robot / human conservative NPV</dt><dd>{money(e.npv)} / {money(e.humanNpv)}</dd>
            <dt>Reserve / target</dt><dd>{formatMoney(e.reserve)} / {formatMoney(e.reserveTarget)}</dd>
            <dt>Available capital left uncommitted</dt><dd>{formatMoney(e.unused)}</dd>
            <dt>95th-percentile wait for one opportunity</dt><dd>{Number.isFinite(e.droughtDays)?`${e.droughtDays.toFixed(1)} days`:'Unbounded'}</dd>
            <dt>Stress reserve required</dt><dd>{Number.isFinite(e.stressRequired)?formatMoney(e.stressRequired):'Unbounded'}</dd>
          </dl></div>
          <div><h4>All criteria must pass</h4><ul className="economic-gates">{e.gates.map(g=><li key={g.label}><span className={(g.strict?g.margin>0:g.margin>=0)?'economic-pass':'economic-fail'}>{(g.strict?g.margin>0:g.margin>=0)?'PASS':'FAIL'}</span>{g.label}</li>)}</ul><p className="economic-caption">“Viable” is a transparent policy screen, not an empirical probability of success. Edge and NPV must be positive; other gates include equality. The score colors visualize the weakest normalized margin, not a legal ruling. Index = 100/(1+exp(−3·minimum gate margin)).</p></div>
        </div>
        <div className="capital-comparison"><h4>Same strategy. Different starting capital.</h4><p>Deployment, costs, evidence and opportunities are identical. Only available funding changes. Available cash automatically fills the selected reserve target; excess wealth stays outside the venture. A larger reserve can reduce NPV when its yield is below the hurdle. Adjust the reserve target to compare another funding policy.</p><div>{comparisons.map(c=><section key={c.label}><span>{c.label}</span><strong>{formatMoney(c.available)} available</strong><p>{formatMoney(c.metrics.reserve)} reserve · {probability(c.metrics.interruption)} interruption proxy</p><small>{c.metrics.viable?'Passes economic criteria':c.metrics.bottleneck.label}</small><button type="button" onClick={()=>onScenarioChange({...scenario,resources:Math.min(100,Math.max(0,(Math.log10(c.available)-3)/7*100))})}>Use this funding</button></section>)}</div></div>
        <div className="assumption-actions"><p>Illustrative inputs until replaced with measured deal-level evidence. These economics use a steady deployment without reinvesting gains or borrowing.</p><button type="button" onClick={()=>onChange({...DEFAULT_ECONOMICS})}>Reset economic assumptions</button></div>
      </div>
    </details>
  </section>;
}

export function EconomicMethodology(){return <section className="economic-methodology" id="economics-method">
  <span className="section-kicker">Research extension · operating edge, opportunity, capital</span>
  <h3>A business can operate for years while destroying economic value.</h3>
  <p>The model now asks four different questions: is the activity business-like, does it create economic surplus, is the edge repeatable, and can this operator finance the adverse sequences? A loss-making airline is still an operating business. A systematic investor can have a repeatable edge. Neither label guarantees a return, and neither determines whether a particular offering is a security.</p>
  <div className="research-grid">
    <section><h4>01 · Efficiency must survive the full cost stack</h4><p>Hold the transaction and service quality fixed. Compare human and robot costs in percentage points of deal principal, not sales margin. Add owner replacement salary, compute, execution costs, losses, compliance and capital upkeep. A 0.001% edge is not automatically too small: it earns $10 on $1M of turnover, or $10,000 on $1B, before overhead and the capital charge. The relevant boundary is economic surplus, not a universal margin.</p><p>Use a real required return and expected inflation to calculate one nominal hurdle: <code>h = (1+π)(1+r)−1</code>. Inflation is not deducted again. All flows are pre-tax and nominal; the inputs must incorporate expected cost inflation. The base model holds costs constant in nominal dollars, so long-horizon scenarios need sensitivity checks.</p></section>
    <section><h4>02 · Detectable does not mean guaranteed</h4><p>Gradient boosting and foundation models receive no automatic credit. What matters is the distribution of net outcomes on unseen, executable selections, including rejected fills, losing trades and deployment costs. Prediction accuracy alone is insufficient. Use walk-forward validation, effective independent sample size, and live evidence across market regimes. Repeated strategy search can manufacture a good backtest from noise.</p><p>The normal approximation <code>mₗ = m − zσ/√nₑff − b</code> is an evidence haircut, not a measured success probability or a complete multiple-testing correction. No dataset is loaded here. Every default is illustrative, including in precedent mode.</p></section>
    <section><h4>03 · “Always” becomes coverage over a window</h4><p>Executable opportunity arrivals are assumed Poisson: <code>P(≥1 in w days) = 1−exp(−λw/365)</code>. The 95th-percentile waiting time is <code>−ln(.05)·365/λ</code>. More arrivals do not prove a positive edge. Zero opportunities means no economically sustainable deal engine.</p><p>Annual throughput is <code>q = min(λ, floor(A/ticket)·365/lock-up days)</code>, and <code>V=q·ticket</code>. This is a steady-state capacity approximation; congestion, clustered arrivals and start-up settlement delays can reduce realized throughput. Existing market-capacity and permission constraints also have to pass. Deal flow is measured at the selected ticket size, not extrapolated automatically when size changes.</p></section>
    <section><h4>04 · Wealth buys runway, not a return</h4><p>Available capital W must finance working capital A. Reserve <code>R=min(max(W−A,0), F·reserve months/12 + stress loss·A)</code>. Only <code>C=A+R</code> receives the capital charge; uncommitted wealth is excluded. Below one minimum ticket, the activity is inaccessible. With the same deployment, more available capital can fund adverse sequences; beyond the reserve target the benefit saturates. The policy automatically fills the chosen reserve target; reserving more can lower NPV when cash earns less than the hurdle. Change the reserve target to test another policy.</p><p>The solver keeps starting wealth, measured edge, opportunity flow, efficiency and horizon fixed. Its economic proposal changes deployment size only, in 0.5-coordinate steps. It never invents new funding or a better forecasting model. A suggested operating/legal movement can still have weak economics, which is reported separately.</p></section>
  </div>
  <div className="method-equations"><h4>Time, discounting, and risk: what the simulator actually computes</h4>
    <p>Gross spread decays as <code>g(t)=g₀·2^(−t/half-life)</code>; zero half-life means no decay. This models competitive erosion, not learned adaptation. Average gross spread within each year feeds annual-end cash flows. Costs and evidence haircuts are held constant. Working capital and reserve are recovered in full at the horizon in the base NPV; losses in liquidation would reduce it.</p>
    <code>NPVₗ = −C + Σₜ₌₁ᴴ [V·(average gₜ − variable costs − evidence haircut) − F + R·cash yield] / (1+h)ᵗ + C/(1+h)ᴴ</code>
    <p>Flat-edge break-even margin is <code>(F+hC−R·cash yield)/V</code>. With decay, the NPV calculation supplies the actual boundary. Equivalent annual surplus is NPV divided by the annuity factor. Positive cash profit can coexist with negative NPV; cost of capital is an opportunity cost, not a bill that immediately shuts the company down. IATA’s December 2025 outlook illustrated this: forecast 2026 airline ROIC of 6.8% was below 8.2% WACC despite positive forecast operating profit. This is a dated example, not the latest outlook.</p>
    <p>The funding-interruption proxy approximates reserve as a drifted Brownian process. Annual drift μ uses the worst initial/end-horizon evidence-adjusted margin and excludes cash yield as a conservative reserve-depletion assumption; <code>s²=q·ticket²·(σ²+max(|mₗ(0)|,|mₗ(H)|)²)+(A·common shock)²</code>. Independent deal noise diversifies; the common shock does not.</p>
    <code>P(hit reserve floor by H) ≈ Φ((−R−μH)/(s√H)) + exp(−2μR/s²)·Φ((−R+μH)/(s√H))</code>
    <p>This is a diffusion approximation for funding interruption while maintaining A, not a calibrated bankruptcy or drawdown forecast. Sparse deals, heavy tails, discrete jumps, regime changes and dependence can invalidate it. A separate deterministic gate requires reserves for the configured one-off loss plus fixed costs through a 95th-percentile deal drought and one capital lock-up cycle. Actual data should replace this proxy with block-bootstrap or cash-flow simulation before allocation decisions.</p>
    <p>Horizon is configurable from 1 to 30 years. Longer survival is not proof of economic value: refinancing, subsidies, creditor losses and owners accepting lower returns can keep an activity alive. Positive arithmetic average returns can also coexist with negative compounded growth. This simulator assumes fixed deployment and no reinvestment, and therefore reports cash-flow funding risk rather than claiming to solve optimal Kelly sizing.</p>
  </div>
  <div className="economic-sources">
    <a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/invfables/eva.htm" target="_blank" rel="noreferrer">Damodaran / NYU · Economic profit and capital charge ↗</a>
    <a href="https://fred.stlouisfed.org/blog/2022/05/constructing-ex-ante-real-interest-rates-on-fred/" target="_blank" rel="noreferrer">St. Louis Fed · Real versus nominal return ↗</a>
    <a href="https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf" target="_blank" rel="noreferrer">Bailey et al. · Probability of backtest overfitting ↗</a>
    <a href="https://arxiv.org/abs/1603.06183" target="_blank" rel="noreferrer">Busseti, Ryu & Boyd · Growth and drawdown constraints ↗</a>
    <a href="https://www.iata.org/en/pressroom/2025-releases/2025-12-09-01/" target="_blank" rel="noreferrer">IATA · December 2025 airline outlook example ↗</a>
    <a href="https://www.irs.gov/taxtopics/tc429" target="_blank" rel="noreferrer">IRS · Trading-business activity criteria ↗</a>
  </div>
</section>}
