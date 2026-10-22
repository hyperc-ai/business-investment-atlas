# Model specification and interpretation

The implementation is authoritative. Equations below document the supplied version; they are not a new empirical calibration. All margins are fractions of **deal principal**, not sales revenue. Economic flows use a consistent pre-tax nominal basis. Source modules are `app/model.ts` and `app/economics.ts`.

## Independent questions

1. **Operating character:** a heuristic business-versus-investment score under perceived or precedent-informed factors.
2. **Economic sustainability:** evidence-adjusted operating surplus, repeatable opportunities and funding resilience for this operator and horizon.
3. **Market capacity:** whether the deployment can fit within the model's accessible markets.
4. **Regulatory readiness:** whether the assumed permission stack meets the model's role requirement.

The simulator must not imply that positive profit, large starting wealth, or a particular score automatically creates legal business/security status. It has no labeled legal-case dataset and loads no actual deal history.

## Coordinates

All internal coordinates use a 0–100 scale. Physical-value inputs convert to the following mappings:

| Coordinate | Physical interpretation |
| --- | --- |
| `asset` | Regulated-instrument exposure, 0–100. |
| `authority` | Robot decision authority, 0–100. |
| `operations` | Operational share of return, 0–100. |
| `enterprise` | Frequency, continuity, market breadth and lifecycle intensity, 0–100. |
| `wrapper` | Internal use through public profit participation, 0–100. |
| `readiness` | Completion of role-specific legal/access stack, 0–100. |
| `capital` | Allocated working capital A = 10^(3 + 7x/100), $1K–$10B. |
| `resources` | Available capital W, same logarithmic scale; different from ownership/control. |
| `efficiency` | Robot reduction in human variable operating cost, 0–100%. |
| `edge` | Held-out gross spread g = (−5 + 0.2x)/100, −5%–15% per deal. |
| `flow` | Detected qualifying opportunity rate λ = 10^(x/25) − 1 per year. |
| `horizon` | H = round(1 + 29x/100), 1–30 whole years. |

## Structural character

Let O, E, Aᵣ, Cᵣ, L, Wᵣ and F be the normalized original operating/legal coordinates (capital here is its logarithmic coordinate, not dollar capital). The UI exposes every coefficient in:

```text
z = β0 + βO O + βE E + βA Aᵣ + βC Cᵣ + βL L + βW Wᵣ + βF F
    + βOE OE + βEA EAᵣ + βCE CᵣE + βON O(1−F)
B = 100 / (1 + exp(−z))
```

Perceived defaults, in that coefficient order:

```text
−1.62, 2.58, 2.20, 0.62, 0.46, 0.28, 0.16, −1.48, 0.66, 0.54, 0.28, 0
```

Precedent-informed defaults:

```text
−1.94, 2.08, 2.48, 0.78, 0.34, 0.16, 0.22, −0.52, 0, 0.96, 0.38, 0.72
```

The default business-character threshold T is 50, configurable from 20 to 80. Classification bands are below T−15, below T, below T+15, and above. Weights are editable hypotheses, not measured reclassification frequencies. Starting resources, measured economic edge and the other new economic coordinates do not change legal identity by themselves.

## Operating advantage, evidence and execution

Let cₕ be human variable operating cost, s the robot saving fraction, and cₒ the remaining variable cost fraction:

```text
cᵣ = cₕ(1−s)
m_robot = g − cᵣ − cₒ
m_human = g − cₕ − cₒ
Δm = cₕ − cᵣ
haircut = z_confidence · σ_deal / sqrt(n_effective) + selection_haircut
m_L(t) = g(t) − cᵣ − cₒ − haircut
```

`otherCost` must include costs not already deducted elsewhere: fees, slippage, financing during settlement, expected losses and variable compute. Fixed annual cost F includes owner replacement salary, maintenance, compliance, data, depreciation and recurring development. Avoid double counting costs/losses.

A confidence multiplier of 1.645 is a one-sided normal approximation under its assumptions. Effective sample size measures independent information; training rows and correlated trades are not automatically independent. The extra selection/drift haircut is a judgment input, not an implementation of a complete multiple-testing correction. Real validation must examine unseen time periods, regimes and execution outcomes.

For ticket size v and capital lock-up d days:

```text
slots = floor(A/v)
q = min(λ, slots · 365/d)
V = qv
P(at least one qualifying opportunity in w days) = 1 − exp(−λw/365)
drought_95_days = −ln(.05) · 365/λ
```

The Poisson model assumes stationary independent arrivals. Availability describes qualifying opportunities before operator capital constraints. The model separately tests funding and ticket access. Executed throughput is a steady-state approximation; clustering, congestion, startup delays and finite-capacity occupancy can make actual throughput smaller. λ is measured at the configured ticket size and cannot be extrapolated indiscriminately to larger tickets.

## Capital, reserves and discounting

```text
R_target = F · reserve_months/12 + A · stress_loss_fraction
R = min(max(W−A, 0), R_target)
C = A + R
uncommitted_wealth = max(W−C, 0)
h = (1+expected_inflation)(1+required_real_return) − 1
```

Available cash automatically fills the selected reserve target. Because cash yield can be below the hurdle, committing more reserve can lower NPV even as it improves funding resilience. This is a fixed policy, not a global optimization over reserve choices. Change the reserve target to compare another policy. Wealth above the target remains outside the venture and does not receive a capital charge.

Gross spread decays toward zero with half-life τ:

```text
g(t) = g0 · exp(−ln(2)t/τ)
```

Zero half-life means no decay. Costs and evidence haircuts are held constant. Annual NPV uses the within-year average of g(t), with cash flows paid at each year end:

```text
NPV_L = −C
        + Σ[t=1..H] (V · average_year(m_L(t)) − F + R · cash_yield)/(1+h)^t
        + C/(1+h)^H
annuity_factor = (1−(1+h)^−H)/h, or H if h=0
annual_equivalent_surplus = NPV_L / annuity_factor
flat_edge_break_even_net_margin = (F+hC−R·cash_yield)/V
human_NPV = robot_NPV − V · Δm · annuity_factor
```

The implementation evaluates the annual-decay series in closed form; the tests independently verify it by summing year-end cash flows. Inflation enters h once. Costs are constant nominal inputs; they are not automatically escalated with inflation. Terminal committed capital is fully recovered in the base scenario. Setup investment, taxes, borrowing, nonlinear impact, liquidation loss and reinvestment are outside this base model. Do not interpret NPV as observed profit or a guaranteed future return.

## Funding interruption and stress

The model estimates the probability of exhausting reserve while maintaining deployment A using a constant-drift diffusion approximation. It does not estimate legal bankruptcy probability or optimize reinvested log growth.

```text
μ = V · min(m_L(0), m_L(H)) − F
s² = qv² · [σ_deal² + max(|m_L(0)|,|m_L(H)|)²]
     + (A · common_annual_shock_fraction)²
P_hit ≈ Φ((−R−μH)/(s√H))
        + exp(−2μR/s²) · Φ((−R+μH)/(s√H))
```

Risk drift excludes reserve yield to avoid assuming that depleted reserves keep earning their original cash income. The worst-endpoint drift envelope is cautious, but the entire diffusion estimate is not a proven bound for arbitrary clustered, heavy-tailed or nonstationary cash flows. Deal noise is treated as independent; common shock remains undiversified.

A separate deterministic gate requires:

```text
R ≥ A · stress_loss_fraction + F · (drought_95_days + d)/365
```

This includes the first settlement delay and a 95th-percentile wait for an opportunity. The configured stress loss is a scenario, not an event probability. With no opportunities, the drought is unbounded when fixed costs remain. Zero throughput never passes viability.

## Economic gates and map contours

All seven gates must pass:

1. W ≥ A.
2. A ≥ one executable ticket.
3. Evidence-adjusted edge is positive at both endpoints of the decaying path.
4. Discounted economic surplus is positive.
5. Opportunity coverage meets the chosen window target.
6. Funding interruption proxy is within tolerance for the chosen horizon.
7. Reserve covers the one-off loss plus drought/settlement stress.

The first two positivity gates in the implementation that concern edge and surplus are strict; the other comparisons include equality. The color index is:

```text
I = 100 / (1 + exp(−3 · minimum_normalized_gate_margin))
```

Normalization is a visualization convention, not probability calibration. Gate units/scales are explicit in `calculateEconomics`. The white economic frontier is I=50; separate contours show NPV=0, available=allocated, and interruption=tolerance. Character mode has its own white threshold and market-capacity, legal-readiness and regulated-role contours. Four selected 2D fields hold all other coordinates fixed. The UI labels boundary sides and handles whole-slice cases with no crossing.

## Capacity and solver

Existing market-capacity and regulatory-readiness formulas are preserved in `calculateMetrics`. Per-market capacity, enterprise-supported market count, and role-specific readiness are heuristic constraints. Dollar capital is not a universal SEC security threshold.

- Character, feasibility and de-risking goals search at most two of the seven original coordinates on a coarse candidate grid with movement weights and role/capacity/funding constraints.
- The economic sizing goal changes **allocated capital only**, in 0.5 coordinate steps across its logarithmic scale. It holds starting wealth, efficiency, measured edge, opportunity flow and horizon fixed.
- An economic sizing candidate must pass the seven economic gates and the market/funding/readiness constraints.
- A character movement can still fail economic viability; its output reports that separately.
- If no candidate passes the grid, the page reports that result. It does not assert mathematical global infeasibility.

## Illustrative defaults

The original default scenario allocates approximately $2.29M with approximately $7.08M available, an 80% reduction in 4%-of-principal human operating cost, a 5% gross spread, other variable cost of 0.5%, and 999 detected opportunities/year at a $25K ticket. Annual fixed cost is $120K and lock-up is 30 days. The evaluation horizon is five years.

The source exposes all 19 economic settings, their bounds, units, descriptions and defaults in `ECONOMIC_FIELDS`. The reproduced default NPV is approximately +$826,699.72 for the robot and −$2,439,676.22 for the same-overhead human counterfactual. These numbers verify implementation consistency only; they are not claims about an actual HyperC deployment.
