import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

// Unit checks for the model helpers the page relies on: exact-value axes,
// value formatting, the typed-number rules, and model invariants the maps and
// the solver assume. Browser behavior is covered by e2e/atlas.spec.ts.
const dir = await mkdtemp(join(tmpdir(), 'p34-model-'));
try {
  for (const [source, name] of [['app/economics.ts', 'economics'], ['app/model.ts', 'model'], ['lib/number-draft.ts', 'number-draft']]) {
    const src = await readFile(new URL(`../${source}`, import.meta.url), 'utf8');
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText.replaceAll('"./economics"', '"./economics.mjs"');
    await writeFile(join(dir, `${name}.mjs`), js);
  }
  const m = await import(join(dir, 'model.mjs'));
  const { liveValue, settledValue } = await import(join(dir, 'number-draft.mjs'));
  let count = 0;
  const test = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };
  const close = (x, y, tol = 1e-9) => assert.ok(Math.abs(x - y) <= tol * Math.max(1, Math.abs(y)), `${x} != ${y}`);
  const grid = Array.from({ length: 201 }, (_, i) => i / 2);

  test('Every exact-value axis round-trips between coordinate and physical value', () => {
    const exact = m.AXES.map(a => [a.key, m.exactAxis(a.key)]).filter(([, e]) => e);
    assert.deepEqual(exact.map(([k]) => k).sort(), ['capital', 'edge', 'efficiency', 'flow', 'horizon', 'resources']);
    for (const [key, e] of exact) {
      close(e.value(0), e.min); close(e.value(100), e.max);
      for (const c of grid) {
        const v = e.value(c);
        assert.ok(v >= e.min - 1e-9 && v <= e.max + 1e-9, `${key} ${c} -> ${v}`);
        const back = e.coordinate(v);
        assert.ok(back >= -1e-9 && back <= 100 + 1e-9, `${key} ${v} -> ${back}`);
        // Horizon snaps to whole years; every other axis is continuous.
        if (key === 'horizon') assert.equal(e.value(back), v); else close(back, c, 1e-9);
      }
    }
  });

  test('Typed physical values land on the coordinate that displays them', () => {
    const cases = [['capital', 500000], ['capital', 1000], ['resources', 1e10], ['edge', 0.001], ['edge', -5], ['flow', 250], ['flow', 0], ['horizon', 12], ['efficiency', 37.5]];
    for (const [key, typed] of cases) {
      const e = m.exactAxis(key);
      close(e.value(e.coordinate(typed)), typed, 1e-9);
    }
  });

  test('Axis values format with their units, and small spreads keep their precision', () => {
    const edge = m.exactAxis('edge');
    assert.equal(m.formatAxisValue('edge', 50), '5.00%');
    assert.equal(m.formatAxisValue('edge', 0), '-5.00%');
    assert.equal(m.formatAxisValue('edge', edge.coordinate(0.001)), '0.001%');
    assert.equal(m.formatAxisValue('edge', edge.coordinate(3.7)), '3.70%');
    assert.equal(m.formatAxisValue('flow', 50), '99 / yr');
    assert.equal(m.formatAxisValue('horizon', 0), '1 yr');
    assert.equal(m.formatAxisValue('horizon', 100), '30 yr');
    assert.equal(m.formatAxisValue('capital', 50), '$3.2M');
    assert.equal(m.formatAxisValue('capital', m.exactAxis('capital').coordinate(500000)), '$500K');
    assert.equal(m.formatAxisValue('efficiency', 80), '80%');
    assert.equal(m.formatAxisValue('asset', 16), '16 / 100');
    assert.equal(m.formatAxisValue('asset', 16, true), '16');
    assert.equal(m.formatMoney(999), '$999');
    assert.equal(m.formatMoney(10e9), '$10B');
  });

  test('Typed numbers pass through only when complete and in range; leaving the field clamps', () => {
    assert.equal(liveValue('5', 1000, 1e10), null);
    assert.equal(liveValue('500', 1000, 1e10), null);
    assert.equal(liveValue('500000', 1000, 1e10), 500000);
    for (const partial of ['', ' ', '-', '.', 'e']) assert.equal(liveValue(partial, -5, 50), null);
    assert.equal(liveValue('-2', -5, 50), -2);
    assert.equal(liveValue('0', 0.1, 50), null);
    assert.equal(liveValue('0.5', 0.1, 50), 0.5);
    assert.equal(settledValue('80', 0.1, 50), 50);
    assert.equal(settledValue('0', 0.1, 50), 0.1);
    assert.equal(settledValue('1e3', 0, 5000), 1000);
    for (const unreadable of ['', '-', 'abc']) assert.equal(settledValue(unreadable, 0, 1), null);
  });

  test('Every axis is defined once and every preset sets all twelve coordinates in range', () => {
    const keys = m.AXES.map(a => a.key);
    assert.equal(keys.length, 12);
    assert.equal(new Set(keys).size, 12);
    assert.equal(m.PRESETS[0].values, m.DEFAULT_SCENARIO);
    for (const preset of m.PRESETS) {
      assert.deepEqual(Object.keys(preset.values).sort(), [...keys].sort(), preset.name);
      for (const key of keys) assert.ok(preset.values[key] >= 0 && preset.values[key] <= 100, `${preset.name} ${key}`);
    }
  });

  test('Classification bands follow the configured boundary', () => {
    for (const boundary of [20, 50, 80]) {
      assert.equal(m.classificationFor(boundary - 15.01, boundary), 'Investor-like');
      assert.equal(m.classificationFor(boundary - 0.01, boundary), 'Investment-led hybrid');
      assert.equal(m.classificationFor(boundary, boundary), 'Business-led hybrid');
      assert.equal(m.classificationFor(boundary + 15, boundary), 'Enterprise / trading business');
    }
  });

  test('Market capacity margin agrees with the markets-required count shown on the page', () => {
    for (const mode of ['perceived', 'precedent']) for (const asset of [0, 20, 50, 80, 100]) for (const enterprise of [0, 30, 60, 90]) for (const capital of [0, 25, 50, 75, 100]) {
      const metrics = m.calculateMetrics({ ...m.DEFAULT_SCENARIO, asset, enterprise, capital }, mode);
      if (Math.abs(metrics.capacityMargin) < 1e-9) continue;
      assert.equal(metrics.requiredMarkets <= metrics.supportedMarkets, metrics.capacityMargin >= 0, `${mode} ${asset} ${enterprise} ${capital}`);
    }
  });

  test('The business score is monotone in its positively weighted coordinates', () => {
    for (const mode of ['perceived', 'precedent']) for (const axis of ['operations', 'enterprise', 'authority']) {
      let previous = -Infinity;
      for (const value of grid) {
        const score = m.calculateMetrics({ ...m.DEFAULT_SCENARIO, [axis]: value }, mode).businessScore;
        assert.ok(score >= previous - 1e-12, `${mode} ${axis} ${value}`);
        previous = score;
      }
    }
  });

  test('Signals are capped at four and solver descriptions name real axes', () => {
    for (const preset of m.PRESETS) for (const mode of ['perceived', 'precedent']) {
      const metrics = m.calculateMetrics(preset.values, mode);
      const signals = m.legalSignals(preset.values, metrics);
      assert.ok(signals.length >= 1 && signals.length <= 4, preset.name);
      for (const result of m.solveScenario(preset.values, mode)) {
        const text = m.movementDescription(result);
        assert.ok(text.length > 0);
        for (const change of result.changes) assert.ok(text.includes(m.axisDefinition(change.axis).short.toLowerCase()), text);
      }
    }
  });

  console.log(`${count} model checks passed.`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
