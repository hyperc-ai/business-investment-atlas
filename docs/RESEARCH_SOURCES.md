# Research sources and their role

These are the primary sources used in the model work. They support the conceptual distinctions; **they do not calibrate the supplied coefficients, establish default deal profitability or validate the funding-risk proxy**. The interactive page retains source links and its original legal-authority section.

| Source | Role in the model |
| --- | --- |
| Aswath Damodaran, NYU Stern: [Economic Value Added](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/invfables/eva.htm) | Economic surplus requires earning above a capital hurdle; operating income can rise without economic value creation. This simulator uses a consistent pre-tax version rather than reproducing an audited EVA calculation. |
| Federal Reserve Bank of St. Louis: [Constructing “ex ante” real interest rates on FRED](https://fred.stlouisfed.org/blog/2022/05/constructing-ex-ante-real-interest-rates-on-fred/) | Exact real/nominal/inflation relationship. The simulator uses one nominal hurdle and does not subtract inflation twice. |
| Bailey, Borwein, López de Prado & Zhu: [The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf) | Repeated strategy search can produce apparent historical edges from noise. The simple normal haircut in this simulator is not the paper's full PBO/CSCV method. |
| Busseti, Ryu & Boyd: [Risk-Constrained Kelly Gambling](https://arxiv.org/abs/1603.06183) | Long-run growth and drawdown protection are distinct objectives. The simulator does not implement Kelly optimization or claim that its Brownian funding proxy is the paper's risk bound. |
| IATA: [9 December 2025 airline outlook](https://www.iata.org/en/pressroom/2025-releases/2025-12-09-01/) | Dated illustration: forecast 2026 positive operating profit coexisted with forecast ROIC of 6.8% below WACC of 8.2%. This is explicitly a historical forecast example, not the latest airline outlook. |
| IRS: [Topic 429 — Traders in securities](https://www.irs.gov/taxtopics/tc429) | Activity, substantiality, continuity and regularity are relevant to the tax-business question; a universal profitability percentage is not the supplied legal test. Tax treatment is distinct from securities-law status. |
| U.S. Supreme Court: [SEC v. W.J. Howey Co., 328 U.S. 293](https://tile.loc.gov/storage-services/service/ll/usrep/usrep328/usrep328293/usrep328293.pdf) | A physical operating asset can be involved in an investment-contract arrangement. Economic operating character and the offered wrapper require separate analysis. |
| U.S. Supreme Court: [Reves v. Ernst & Young, 494 U.S. 56](https://www.law.cornell.edu/supremecourt/text/494/56) | Notes involve a distinct family-resemblance analysis. |
| SEC: [Investment Advisers](https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/investment-advisers) | Role/status comes before conditional registration/asset-size questions. |
| SEC: [Broker-Dealers](https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/broker-dealers) | Transaction participation, execution, compensation and custody facts matter independently of model accuracy. |
| SEC: [Robo-Advisers guidance, 2017](https://www.sec.gov/files/im-guidance-2017-02.pdf) | Algorithmic delivery does not alone remove adviser obligations. This is a dated source, not a claim to cover every later rule change. |
| CFTC: [Intermediaries](https://www.cftc.gov/IndustryOversight/Intermediaries/index.htm) | Commodity-interest roles differ from securities-law roles. |

The original tool's legal-authority text was reviewed for its earlier release and carries its own date. Packaging on 22 October 2026 does not constitute a fresh legal survey. Preserve the source dates and avoid updating a “current to” label without performing the underlying review.

## Core conclusions to preserve in publication

- Lower operating cost can unlock an economically viable workflow, but the cost difference alone does not define a legal business.
- There is no universal minimum percentage margin. Throughput, fixed cost, uncertainty, capital lock-up and the hurdle determine economic surplus.
- A model architecture does not guarantee that profitable opportunities exist or that it can identify them.
- Opportunity availability must be assessed over a stated time window and supported with actual executable outcomes.
- Available capital changes access and survival. It does not create an edge, and unnecessary committed reserve can reduce NPV.
- Businesses can survive while earning below their cost of capital; economic loss and immediate cash insolvency are different.
- Unobserved tails, dependence, selection bias and changing regimes can invalidate simplified uncertainty estimates.
