import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
const dir = await mkdtemp(join(tmpdir(),'p34-econ-'));
try {
 for (const name of ['economics','model']) {
  const src=await readFile(new URL(`../app/${name}.ts`,import.meta.url),'utf8');
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('"./economics"','"./economics.mjs"');
  await writeFile(join(dir,`${name}.mjs`),js);
 }
 const {calculateEconomics:calc,DEFAULT_ECONOMICS:a,fundingInterruption,ECONOMIC_FIELDS}=await import(join(dir,'economics.mjs'));
 const {DEFAULT_SCENARIO:s,calculateMetrics,solveScenario,AXES}=await import(join(dir,'model.mjs'));
 let count=0;
 const test=(name,fn)=>{fn();count++;console.log(`PASS ${name}`);};
 const close=(x,y,tol=1e-7)=>assert.ok(Math.abs(x-y)<=tol*Math.max(1,Math.abs(y)),`${x} != ${y}`);
 test('Closed-form NPV matches independent annual discounted cash flows, including zero hurdle and decay',()=>{
  for(const h of [0,4,10])for(const inflation of [-5,0,3])for(const halfLife of [0,.5,10]) {
   const settings={...a,realHurdle:h,inflation,halfLife};const e=calc(s,settings);
   let npv=-e.committed;
   for(let year=1;year<=e.years;year++) {
    const k=halfLife?Math.LN2/halfLife:0;
    const g=.05*(k?(Math.exp(-k*(year-1))-Math.exp(-k*year))/k:1);
    const cf=e.volume*(g-e.variableCost-e.haircut)-settings.fixedCost+e.cashIncome;
    npv+=cf/(1+e.nominalHurdle)**year;
   }
   npv+=e.committed/(1+e.nominalHurdle)**e.years;
   close(e.npv,npv);
  }
 });
 test('Inflation is included exactly once and extra inflation reduces NPV',()=>{close(calc(s,a).nominalHurdle,.0712);assert.ok(calc(s,{...a,inflation:8}).npv<calc(s,a).npv);});
 test('Default robot has economic surplus while human counterfactual loses value',()=>{const e=calc(s,a);assert.ok(e.npv>0);assert.ok(e.humanNpv<0);assert.ok(e.viable);});
 test('Poorer operator loses resilience at identical deployment; excess wealth saturates',()=>{
  const poor=calc({...s,resources:48.1},a), rich=calc(s,a), richer=calc({...s,resources:100},a);
  assert.ok(poor.interruption>rich.interruption);assert.ok(!poor.viable);close(rich.npv,richer.npv);close(rich.interruption,richer.interruption);
 });
 test('Starting wealth alone cannot manufacture a positive edge',()=>{assert.ok(!calc({...s,resources:100,edge:25},a).viable);});
 test('Zero flow and sub-ticket deployment fail even with wealth',()=>{assert.equal(calc({...s,flow:0},a).viable,false);const e=calc({...s,capital:0,resources:100},a);assert.equal(e.deals,0);assert.equal(e.viable,false);});
 test('Fewer independent observations lower the evidence margin',()=>{assert.ok(calc(s,{...a,effectiveN:10}).lowerEdge<calc(s,a).lowerEdge);});
 test('A zero edge with no costs or risk does not count as viable',()=>{
  const zero={...a,humanCost:0,otherCost:0,fixedCost:0,confidenceZ:0,selectionHaircut:0,dealVolatility:0,inflation:0,realHurdle:0,cashYield:0,systemicVolatility:0,stressLoss:0,halfLife:0};
  assert.equal(calc({...s,edge:25},zero).viable,false);
 });
 test('First-passage approximation matches known drift-free case and deterministic paths',()=>{
  close(fundingInterruption(1,0,1,1),.3173105079,1e-6);assert.equal(fundingInterruption(100,-30,0,4),1);assert.equal(fundingInterruption(100,30,0,4),0);
  assert.ok(fundingInterruption(100,20,100,10)>=fundingInterruption(100,20,100,1));
  for(const drift of [-1e8,-100,0,100,1e8]){const p=fundingInterruption(1e5,drift,100,30);assert.ok(Number.isFinite(p)&&p>=0&&p<=1);}
 });
 test('Long settlement cannot be financed by optimistic smooth deal income',()=>{
  const coordinate=v=>(Math.log10(v)-3)/7*100;
  const e=calc({...s,capital:coordinate(1e8),resources:coordinate(1e8+1e4),edge:100,flow:100},{...a,ticket:1e4,cycleDays:365,humanCost:0,otherCost:0,confidenceZ:0,selectionHaircut:0,dealVolatility:0,systemicVolatility:0,halfLife:0,stressLoss:0});
  assert.ok(e.stressRequired>=120000);assert.equal(e.viable,false);
 });
 test('Shared economics propagate through both classifier lenses without changing legal identity',()=>{
  for(const mode of ['perceived','precedent']){const m=calculateMetrics(s,mode),low=calculateMetrics({...s,resources:0},mode);close(m.businessScore,low.businessScore);assert.equal(low.feasible,false);close(m.economics.npv,calc(s,a).npv);}
 });
 test('Solver preserves wealth and evidence, rejects underfunded moves, and economic candidates pass all gates',()=>{
  for(const sc of [s,{...s,resources:48.1},{...s,capital:60}]) {
   const results=solveScenario(sc,'perceived');
   for(const r of results){for(const key of ['resources','edge','flow','efficiency','horizon'])assert.equal(r.target[key],sc[key]);assert.ok(r.metrics.feasible);if(r.goal==='sustainable'){assert.ok(r.metrics.economics.viable);assert.ok(r.changes.every(c=>c.axis==='capital'));}}
  }
 });
 test('Full coordinate grid and setting extremes have finite score, NPV and risk',()=>{
  for(const axis of AXES)for(const val of [0,25,50,75,100]){
   const e=calc({...s,[axis.key]:val},a);for(const key of ['score','npv','interruption','annualSurplus','lowerEdge'])assert.ok(Number.isFinite(e[key]),`${axis.key} ${val} ${key}`);
  }
  for(const f of ECONOMIC_FIELDS)for(const val of [f.min,f.max]){const e=calc(s,{...a,[f.key]:val});for(const key of ['score','npv','interruption'])assert.ok(Number.isFinite(e[key]),`${f.key} ${key}`);}
 });
 console.log(`${count} economic model checks passed.`);
 const e=calc(s,a);console.log(JSON.stringify({default:{npv:e.npv,humanNpv:e.humanNpv,viable:e.viable,interruption:e.interruption,breakEven:e.requiredNetEdge,score:e.score}}));
} finally { await rm(dir,{recursive:true,force:true}); }
