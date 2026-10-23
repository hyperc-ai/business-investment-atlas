import { expect, test, type Locator, type Page } from "@playwright/test";

// Browser tests for the atlas. They run against a local production build
// (`npm run test:e2e`) and against the deployed page (`npm run test:live`).
// Nothing here submits anything: third-party requests are blocked, and the
// hyperc.com consent banner is declined, which is stored only in the browser.

type Problems = { errors: string[]; failed: string[] };

async function openAtlas(page: Page, { keepConsentBanner = false } = {}): Promise<Problems> {
  const problems: Problems = { errors: [], failed: [] };
  const origin = new URL(test.info().project.use.baseURL!).host;
  await page.route("**/*", (route) =>
    new URL(route.request().url()).host === origin ? route.continue() : route.abort(),
  );
  page.on("pageerror", (error) => problems.errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const source = message.location().url;
    // A blocked third-party request logs a load error; that is the test's doing.
    if (source && new URL(source).host !== origin) return;
    if (message.text().includes("net::ERR_FAILED")) return;
    problems.errors.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (new URL(response.url()).host === origin && response.status() >= 400)
      problems.failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("./");
  await expect(page.locator("section.slice-card")).toHaveCount(4);
  if (!keepConsentBanner) {
    const decline = page.locator(".hc-cc .hc-cc-n");
    if (await decline.isVisible().catch(() => false)) await decline.click();
  }
  return problems;
}

const readout = (page: Page, short: string) =>
  page
    .locator(".axis-control")
    .filter({ has: page.getByText(short, { exact: true }) })
    .locator(".axis-control-head strong");

const slider = (page: Page, name: string) => page.getByRole("slider", { name, exact: true });

async function sliderValue(page: Page, name: string) {
  return Number(await slider(page, name).getAttribute("aria-valuenow"));
}

async function typeNumber(field: Locator, text: string) {
  await field.scrollIntoViewIfNeeded();
  await field.click();
  await field.press("ControlOrMeta+a");
  await field.pressSequentially(text);
  await field.press("Tab");
}

async function openEconomics(page: Page) {
  await page.getByText("Configure economics & inspect every gate").click();
}

// The chart's viewBox is 760 × 510 with the plot inset by (76, 28) and sized
// 660 × 416; this converts axis coordinates (0–100) to a position on the SVG.
async function chartPoint(chart: Locator, x: number, y: number) {
  const box = (await chart.boundingBox())!;
  const svgX = 76 + (x / 100) * 660;
  const svgY = 28 + ((100 - y) / 100) * 416;
  return { box, x: (svgX / 760) * box.width, y: (svgY / 510) * box.height };
}

const isMobile = () => test.info().project.name === "mobile";

test.describe("the atlas page", () => {
  test("loads four linked slices without errors or failed requests", async ({ page }) => {
    const problems = await openAtlas(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("When does an AI allocator become a business?");
    await expect(page.locator("svg.heat-map")).toHaveCount(4);
    // 30 × 22 colored cells per slice.
    await expect(page.locator("svg.heat-map").first().locator("rect[fill^='hsl']")).toHaveCount(660);
    await expect(page.getByRole("link", { name: "Sources" })).toBeVisible({ visible: !isMobile() });
    await page.waitForLoadState("networkidle");
    expect(problems.errors).toEqual([]);
    expect(problems.failed).toEqual([]);
  });

  test("default assumptions reproduce the documented fixture", async ({ page }) => {
    await openAtlas(page);
    const summary = page.locator(".economic-summary");
    await expect(summary).toContainText("3.70% / 0.50%");
    await expect(summary).toContainText("$827K");
    await expect(page.locator(".economic-heading")).toContainText("Passes configured criteria");
  });

  test("fits the viewport without horizontal scrolling", async ({ page }) => {
    await openAtlas(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("controls", () => {
  test("every slider has an accessible name and moves with the keyboard", async ({ page }) => {
    await openAtlas(page);
    await expect(page.getByRole("slider")).toHaveCount(12);
    // The thirteenth, the reclassification boundary, sits in the formula panel.
    await page.getByText("Configure formula assumptions").click();
    const sliders = page.getByRole("slider");
    await expect(sliders).toHaveCount(13);
    await expect(slider(page, "Business reclassification boundary")).toHaveAttribute("aria-valuenow", "50");
    for (const thumb of await sliders.all()) await expect(thumb).toHaveAccessibleName(/\S/);
    const authority = slider(page, "Robot decision authority");
    await authority.focus();
    await authority.press("ArrowRight");
    await expect(authority).toHaveAttribute("aria-valuenow", "83");
    await expect(readout(page, "Robot authority")).toHaveText("83 / 100");
  });

  test("exact-value fields keep what is typed", async ({ page }) => {
    await openAtlas(page);
    const capital = page.getByLabel("Total capital allocated exact value");
    await typeNumber(capital, "500000");
    await expect(capital).toHaveValue("500000");
    await expect(readout(page, "Capital allocated")).toHaveText("$500K");

    const spread = page.getByLabel("Held-out gross deal spread exact value");
    await typeNumber(spread, "0.001");
    await expect(spread).toHaveValue("0.001");
    await expect(readout(page, "Gross deal spread")).toHaveText("0.001%");

    const flow = page.getByLabel("Detected executable opportunities exact value");
    await typeNumber(flow, "250");
    await expect(readout(page, "Opportunity flow")).toHaveText("250 / yr");

    const horizon = page.getByLabel("Economic evaluation horizon exact value");
    await typeNumber(horizon, "12");
    await expect(readout(page, "Operating horizon")).toHaveText("12 yr");
  });

  test("economic assumptions accept negative and small decimal values", async ({ page }) => {
    await openAtlas(page);
    await openEconomics(page);
    const inflation = page.getByLabel("Expected inflation", { exact: true });
    await typeNumber(inflation, "-2");
    await expect(inflation).toHaveValue("-2");

    const limit = page.getByLabel("Funding interruption limit", { exact: true });
    await typeNumber(limit, "0.5");
    await expect(limit).toHaveValue("0.5");
    await expect(page.locator(".line-legend")).toContainText("interruption = 0.5%");

    const z = page.getByLabel("Evidence multiplier", { exact: true });
    await typeNumber(z, "1.96");
    await expect(z).toHaveValue("1.96");
  });

  test("out-of-range entries are clamped when the field is left, and an empty field reverts", async ({ page }) => {
    await openAtlas(page);
    await openEconomics(page);
    const limit = page.getByLabel("Funding interruption limit", { exact: true });
    await typeNumber(limit, "80");
    await expect(limit).toHaveValue("50");
    await expect(page.locator(".line-legend")).toContainText("interruption = 50%");

    const ticket = page.getByLabel("Executable deal size", { exact: true });
    await ticket.click();
    await ticket.press("ControlOrMeta+a");
    await ticket.press("Backspace");
    await ticket.press("Tab");
    await expect(ticket).toHaveValue("25000");
  });

  test("formula coefficients accept negative values and rewrite the formula", async ({ page }) => {
    await openAtlas(page);
    await page.getByText("Configure formula assumptions").click();
    const authority = page.getByLabel("Robot authority coefficient");
    await typeNumber(authority, "-1.5");
    await expect(authority).toHaveValue("-1.5");
    await expect(page.locator(".formula-workbench .formula-z")).toContainText("− 1.5·A");
    await page.getByRole("button", { name: "Reset perceived lens" }).click();
    await expect(authority).toHaveValue("0.62");
  });

  test("economic reset restores the defaults", async ({ page }) => {
    await openAtlas(page);
    await openEconomics(page);
    const human = page.getByLabel("Human operating cost", { exact: true });
    await typeNumber(human, "10");
    await expect(page.locator(".economic-summary")).not.toContainText("3.70% / 0.50%");
    await page.getByRole("button", { name: "Reset economic assumptions" }).click();
    await expect(human).toHaveValue("4");
    await expect(page.locator(".economic-summary")).toContainText("3.70% / 0.50%");
  });

  test("a funding comparison can be applied to the scenario", async ({ page }) => {
    await openAtlas(page);
    await openEconomics(page);
    await expect(readout(page, "Starting capital")).toHaveText("$7.1M");
    const thin = page.locator(".capital-comparison section").filter({ hasText: "Thinly funded" });
    const amount = (await thin.locator("strong").innerText()).replace(" available", "");
    await thin.getByRole("button", { name: "Use this funding" }).click();
    await expect(readout(page, "Starting capital")).toHaveText(amount);
  });

  test("presets load their coordinates", async ({ page }) => {
    await openAtlas(page);
    await page.getByRole("button", { name: "One ETF selector" }).click();
    await expect(readout(page, "Instrument exposure")).toHaveText("100 / 100");
    await expect(readout(page, "Operational value")).toHaveText("4 / 100");
  });
});

test.describe("lenses, layers and slices", () => {
  test("the precedent switch changes the lens and the formula", async ({ page }) => {
    await openAtlas(page);
    await expect(page.locator(".stage-head .eyebrow")).toHaveText("Ordinary-language perception lens");
    await page.getByRole("switch", { name: "Use precedent-informed mode" }).click();
    await expect(page.locator(".stage-head .eyebrow")).toHaveText("U.S. federal precedent lens");
    await expect(page.locator("#live-formula-title")).toContainText("Live precedent business formula");
  });

  test("the character layer relabels the legend and draws the regulatory screen in precedent mode", async ({ page }) => {
    await openAtlas(page);
    const character = page.getByRole("button", { name: "Business / investment character" });
    await character.click();
    await expect(character).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".score-legend-head")).toContainText("Investment-like");
    await expect(page.locator(".score-legend-head")).toContainText("Boundary score");
    await expect(page.locator(".line-legend")).not.toContainText("regulated-role screen");
    await page.getByRole("switch", { name: "Use precedent-informed mode" }).click();
    await expect(page.locator(".line-legend")).toContainText("60-point regulated-role screen");
  });

  test("suggested slices switch to the character views", async ({ page }) => {
    await openAtlas(page);
    await page.getByRole("button", { name: "Business / investment character" }).click();
    await page.getByRole("button", { name: "Use suggested slices" }).click();
    await expect(page.locator(".slice-name strong").first()).toHaveText("Enterprise intensity × Operational value");
  });

  test("choosing an axis already on the other side swaps the two axes", async ({ page }) => {
    await openAtlas(page);
    const first = page.locator("section.slice-card").first();
    await expect(first.locator(".slice-name strong")).toHaveText("Opportunity flow × Robot cost saving");
    await page.getByRole("combobox", { name: "Slice 1 X axis" }).click();
    await page.getByRole("option", { name: "Opportunity flow" }).click();
    await expect(first.locator(".slice-name strong")).toHaveText("Robot cost saving × Opportunity flow");
    await expect(page.getByRole("combobox", { name: "Slice 1 Y axis" })).toHaveText("Robot cost saving");
  });
});

test.describe("charts", () => {
  test("clicking or tapping a chart moves the scenario to that point", async ({ page }) => {
    await openAtlas(page);
    const chart = page.locator("svg.heat-map").first();
    await chart.scrollIntoViewIfNeeded();
    const point = await chartPoint(chart, 25, 40);
    if (isMobile()) await chart.tap({ position: point });
    else await chart.click({ position: point });
    await expect.poll(() => sliderValue(page, "Robot operating-cost reduction")).toBeCloseTo(25, 0);
    await expect.poll(() => sliderValue(page, "Detected executable opportunities")).toBeCloseTo(40, 0);
  });

  test("a vertical swipe over a chart scrolls the page and leaves the scenario alone", async ({ page }) => {
    test.skip(!isMobile(), "touch gesture");
    await openAtlas(page);
    const chart = page.locator("svg.heat-map").first();
    await chart.scrollIntoViewIfNeeded();
    const { box } = await chartPoint(chart, 0, 0);
    const before = await page.evaluate(() => scrollY);
    const efficiency = await sliderValue(page, "Robot operating-cost reduction");
    const flow = await sliderValue(page, "Detected executable opportunities");
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width * 0.6;
    const y = box.y + box.height * 0.8;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 12; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - step * 15 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 50);
    expect(await sliderValue(page, "Robot operating-cost reduction")).toBe(efficiency);
    expect(await sliderValue(page, "Detected executable opportunities")).toBe(flow);
  });

  test("a horizontal drag over a chart moves the scenario with the finger", async ({ page }) => {
    test.skip(!isMobile(), "touch gesture");
    await openAtlas(page);
    const chart = page.locator("svg.heat-map").first();
    await chart.scrollIntoViewIfNeeded();
    const start = await chartPoint(chart, 30, 50);
    const end = await chartPoint(chart, 70, 50);
    const cdp = await page.context().newCDPSession(page);
    const at = (p: { x: number; y: number }) => ({ x: start.box.x + p.x, y: start.box.y + p.y });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(start)] });
    for (let step = 1; step <= 10; step += 1) {
      const x = start.x + ((end.x - start.x) * step) / 10;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at({ x, y: start.y })] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => sliderValue(page, "Robot operating-cost reduction")).toBeCloseTo(70, 0);
  });

  test("section links land below the sticky header", async ({ page }) => {
    test.skip(isMobile(), "the section nav is hidden on phones");
    await openAtlas(page);
    await page.locator(".site-header nav").getByRole("link", { name: "Model" }).click();
    await expect(page).toHaveURL(/#model$/);
    await expect
      .poll(async () => {
        const header = (await page.locator(".site-header").boundingBox())!;
        const heading = (await page.locator("#model h2").first().boundingBox())!;
        return heading.y - (header.y + header.height);
      })
      .toBeGreaterThanOrEqual(0);
  });
});

// The hyperc.com page wraps the app with a return bar, the consent banner and
// the feedback widget. These checks only apply where that wrapper is present.
test.describe("hyperc.com wrapper", () => {
  test("links back to the site, the introduction and the source", async ({ page }) => {
    await openAtlas(page);
    const bar = page.locator("nav.hc-return");
    test.skip((await bar.count()) === 0, "no site wrapper on this deployment");
    await expect(bar.getByRole("link", { name: "HyperC" })).toHaveAttribute("href", "/");
    await expect(bar.getByRole("link", { name: "Research & evidence" })).toHaveAttribute("href", "/research.html");
    await expect(bar.getByRole("link", { name: "Introduction" })).toHaveAttribute("href", "/blog/when-does-a-robot-become-a-business.html");
    await expect(bar.locator('a[href="https://github.com/hyperc-ai/business-investment-atlas"]')).toHaveCount(1);
    await expect(bar).toContainText("not measured P34 results");
  });

  test("the consent banner stays readable over the atlas palette", async ({ page }) => {
    await openAtlas(page, { keepConsentBanner: true });
    test.skip((await page.locator("nav.hc-return").count()) === 0, "no site wrapper on this deployment");
    const banner = page.locator(".hc-cc");
    await expect(banner).toBeVisible();
    const contrast = await banner.evaluate((element) => {
      const rgb = (value: string) => value.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
      const luminance = ([r, g, b]: number[]) => {
        const c = [r, g, b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const ratio = (a: string, b: string) => {
        const [x, y] = [luminance(rgb(a)), luminance(rgb(b))].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const background = getComputedStyle(element).backgroundColor;
      return [".hc-cc-t strong", ".hc-cc-n"].map((selector) =>
        ratio(getComputedStyle(element.querySelector(selector)!).color, background),
      );
    });
    for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
