// Fixtures in test/fixtures/ are the EIA pages downloaded 2026-11-07: weekly retail regular, all-grades and diesel tables by area
// (release 2026-11-03, latest week 2026-11-02, next release 2026-11-10) and the weekly history pages for U.S. and California regular.
// Expected values are read off those pages: U.S. regular 4.153 (4.269 the week before, 4.354 four weeks before, 3.019 on 2025-11-03),
// California 5.748, Texas 3.578, Chicago 4.706, Houston 3.625, San Francisco 5.699, West Coast (PADD 5) 5.296, Lower Atlantic (PADD 1C) 3.695,
// U.S. diesel 6.292, California diesel 8.076, Gulf Coast diesel 5.912, U.S. all grades 4.290.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import {
  parseWeekly, parseHistory, resolveArea, parseGrade, getGasPrices, compareGasPrices, estimateFillUpCost, WEEKLY, histUrl, InputError, UpstreamError, UTM,
} from '../dist/core.js';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const MAP = {
  [WEEKLY('regular')]: 'gas-regular-weekly-2026-11-07.html', [WEEKLY('diesel')]: 'gas-diesel-weekly-2026-11-07.html', [WEEKLY('all_grades')]: 'gas-all-grades-weekly-2026-11-07.html',
  [histUrl('EMM_EPMR_PTE_NUS_DPG')]: 'hist-EMM_EPMR_PTE_NUS_DPG-2026-11-07.html', [histUrl('EMM_EPMR_PTE_SCA_DPG')]: 'hist-EMM_EPMR_PTE_SCA_DPG-2026-11-07.html',
};
const f = async (u) => { if (!MAP[u]) throw new Error(`HTTP 404 (no fixture for ${u})`); return fx(MAP[u]); };
const W = parseWeekly(fx(MAP[WEEKLY('regular')]), 'regular');
const D = parseWeekly(fx(MAP[WEEKLY('diesel')]), 'diesel');

test('weekly regular: six weeks to 2026-11-02, 29 areas, U.S. 4.153, release 2026-11-03, next 2026-11-10', () => {
  assert.deepEqual(W.weeks, ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
  assert.deepEqual(W.rows[0], { area: 'U.S.', series: 'EMM_EPMR_PTE_NUS_DPG', values: [4.465, 4.354, 4.331, 4.284, 4.269, 4.153] });
  assert.equal(W.rows.length, 29); assert.equal(W.release, '2026-11-03'); assert.equal(W.next_release, '2026-11-10');
});
test('weekly regular: California, Texas, Chicago, Houston and San Francisco latest prices', () => {
  const at = (a) => W.rows.find((r) => r.area === a).values[5];
  assert.equal(at('California'), 5.748); assert.equal(at('Texas'), 3.578); assert.equal(at('Chicago'), 4.706); assert.equal(at('Houston'), 3.625); assert.equal(at('San Francisco'), 5.699);
});
test('weekly diesel: 11 areas, U.S. 6.292, California 8.076', () => {
  assert.equal(D.rows.length, 11); assert.equal(D.rows[0].values[5], 6.292); assert.equal(D.rows.find((r) => r.area === 'California').values[5], 8.076);
});
test('weekly all grades: U.S. 4.290', () => {
  assert.equal(parseWeekly(fx(MAP[WEEKLY('all_grades')]), 'all_grades').rows[0].values[5], 4.29);
});
test('parse errors: a blocked page is an upstream error', () => {
  assert.throws(() => parseWeekly('<html>Access Denied</html>', 'regular'), UpstreamError);
  assert.throws(() => parseHistory('<html></html>'), UpstreamError);
});
test('history: U.S. regular 3.019 on 2025-11-03 and 4.153 on 2026-11-02', () => {
  const h = parseHistory(fx(MAP[histUrl('EMM_EPMR_PTE_NUS_DPG')]));
  assert.deepEqual(h.find((p) => p.week_of === '2025-11-03'), { week_of: '2025-11-03', price: 3.019 });
  assert.deepEqual(h[h.length - 1], { week_of: '2026-11-02', price: 4.153 });
});
test('areas: state, code, city alias, region words and US', () => {
  assert.equal(resolveArea(W, 'Texas').row.values[5], 3.578); assert.equal(resolveArea(W, 'ca').row.area, 'California');
  assert.equal(resolveArea(W, 'NYC').row.area, 'New York City'); assert.equal(resolveArea(W, 'nyc').row.values[5], 4.114);
  assert.equal(resolveArea(W, 'Midwest').row.values[5], 4.102); assert.equal(resolveArea(W, 'PADD 2').row.area, 'Midwest (PADD 2)');
  assert.equal(resolveArea(W, 'padd 1').row.area, 'East Coast (PADD1)'); assert.equal(resolveArea(W, '').row.area, 'U.S.'); assert.equal(resolveArea(W, 'USA').kind, 'us');
});
test('areas: states EIA does not price fall back to their PADD region (Arizona to West Coast, Georgia to Lower Atlantic, Maine to New England)', () => {
  const az = resolveArea(W, 'Arizona'); assert.equal(az.row.area, 'West Coast (PADD 5)'); assert.equal(az.fallback_from, 'Arizona'); assert.equal(az.row.values[5], 5.296);
  assert.equal(resolveArea(W, 'GA').row.values[5], 3.695); assert.equal(resolveArea(W, 'Maine').row.area, 'New England (PADD 1A)');
  assert.equal(resolveArea(W, 'Texas').fallback_from, null);
  assert.equal(resolveArea(D, 'Texas').row.area, 'Gulf Coast (PADD 3)'); assert.equal(resolveArea(D, 'Washington').row.values[5], 7.272);
});
test('areas: unknown place and unknown grade are input errors', () => {
  assert.throws(() => resolveArea(W, 'Narnia'), InputError); assert.throws(() => parseGrade('rocket'), InputError);
  assert.equal(parseGrade('unleaded'), 'regular'); assert.equal(parseGrade('Premium'), 'premium'); assert.equal(parseGrade(undefined), 'regular');
});
test('prices today, U.S. regular: 4.153 down 0.116 from last week, down 0.201 from four weeks ago, 3.019 a year ago (up 1.134, 37.56%)', async () => {
  const r = await getGasPrices(f, {});
  assert.equal(r.price_per_gallon, 4.153); assert.equal(r.week_change, -0.116); assert.equal(r.four_weeks_ago.change, -0.201); assert.equal(r.four_weeks_ago.week_of, '2026-10-05');
  assert.equal(r.year_ago.price_per_gallon, 3.019); assert.equal(r.year_ago.change, 1.134); assert.equal(r.year_ago.change_percent, 37.56);
  assert.match(r.summary, /the U\.S\. averaged \$4\.153/); assert.match(r.summary, /down \$0\.116 from the week before/); assert.ok(r.more.includes(UTM));
  assert.equal(r.release_date, '2026-11-03'); assert.equal(r.next_release, '2026-11-10'); assert.equal(r.recent_weeks.length, 6);
});
test('prices today, California regular 5.748 down 0.140; a year ago from the California history', async () => {
  const r = await getGasPrices(f, { area: 'California' });
  assert.equal(r.price_per_gallon, 5.748); assert.equal(r.week_change, -0.14); assert.ok(r.year_ago && r.year_ago.week_of === '2025-11-03');
});
test('prices today, Arizona says EIA has no price for Arizona and uses West Coast (PADD 5) at 5.296', async () => {
  const r = await getGasPrices(f, { area: 'Arizona' });
  assert.equal(r.price_per_gallon, 5.296); assert.equal(r.area, 'West Coast (PADD 5)'); assert.match(r.summary, /EIA does not publish a price for Arizona/);
  assert.equal(r.year_ago, null); assert.match(r.year_ago_note, /year-ago price not available/);
});
test('prices today, diesel U.S. 6.292 and California 8.076; all grades 4.290', async () => {
  assert.equal((await getGasPrices(f, { grade: 'diesel' })).price_per_gallon, 6.292);
  assert.equal((await getGasPrices(f, { grade: 'diesel', area: 'California' })).price_per_gallon, 8.076);
  assert.equal((await getGasPrices(f, { grade: 'all_grades' })).price_per_gallon, 4.29);
});
test('compare: states ranked, Texas 3.578 cheapest and California 5.748 most expensive; cities Houston 3.625 to Los Angeles 5.742', async () => {
  const s = await compareGasPrices(f, { group: 'states' });
  assert.equal(s.ranking.length, 9); assert.equal(s.cheapest.area, 'Texas'); assert.equal(s.cheapest.price_per_gallon, 3.578); assert.equal(s.most_expensive.area, 'California'); assert.equal(s.us_average, 4.153);
  const c = await compareGasPrices(f, { group: 'cities' });
  assert.equal(c.ranking.length, 10); assert.equal(c.cheapest.area, 'Houston'); assert.equal(c.most_expensive.area, 'Los Angeles'); assert.equal(c.most_expensive.price_per_gallon, 5.742);
  assert.equal((await compareGasPrices(f, {})).ranking.length, 28); assert.equal((await compareGasPrices(f, { group: 'regions' })).ranking.length, 9);
  await assert.rejects(compareGasPrices(f, { group: 'planets' }), InputError);
});
test('fill-up: 20 gallons at the U.S. average 4.153 is $83.06; 15 gallons at a given $4.00 is $60; California 15 gallons at 5.748 is $86.22', async () => {
  assert.equal((await estimateFillUpCost(f, { gallons: 20 })).total_cost, 83.06);
  assert.equal((await estimateFillUpCost(f, { gallons: 15, price_per_gallon: 4 })).total_cost, 60);
  assert.equal((await estimateFillUpCost(f, { gallons: 15, area: 'CA' })).total_cost, 86.22);
});
test('trip: 300 miles at 30 mpg is 10 gallons, $41.53 and 13.84 cents a mile at 4.153', async () => {
  const r = await estimateFillUpCost(f, { gallons: 10, miles: 300, miles_per_gallon: 30 });
  assert.equal(r.trip.gallons_used, 10); assert.equal(r.trip.cost, 41.53); assert.equal(r.trip.cents_per_mile, 13.84); assert.match(r.summary, /13\.84 cents a mile/);
});
test('fill-up input errors', async () => {
  await assert.rejects(estimateFillUpCost(f, { gallons: 0 }), InputError);
  await assert.rejects(estimateFillUpCost(f, { gallons: 10, miles: 100 }), InputError);
  await assert.rejects(estimateFillUpCost(f, { gallons: 10, price_per_gallon: 90 }), InputError);
  await assert.rejects(estimateFillUpCost(f, { gallons: 10, area: 'Narnia' }), InputError);
});
test('stdio: initialize, tools/list with annotations and a tools/call error over JSON-RPC (offline)', async () => {
  const child = spawn(process.execPath, [new URL('../dist/stdio.js', import.meta.url).pathname], { stdio: ['pipe', 'pipe', 'ignore'] });
  const lines = []; let buf = '';
  const got = (id) => new Promise((res) => { const iv = setInterval(() => { const m = lines.find((l) => l.id === id); if (m) { clearInterval(iv); res(m); } }, 10); });
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const send = (m) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
  send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.equal((await got(1)).result.serverInfo.name, 'gas-prices-today-mcp');
  send({ method: 'notifications/initialized' });
  send({ id: 2, method: 'tools/list' });
  const tools = (await got(2)).result.tools;
  assert.deepEqual(tools.map((t) => t.name), ['get_gas_prices', 'compare_gas_prices', 'estimate_fill_up_cost']);
  for (const t of tools) { assert.ok(t.title); assert.equal(t.annotations.readOnlyHint, true); assert.equal(t.annotations.destructiveHint, false); assert.equal(t.annotations.openWorldHint, true); }
  send({ id: 3, method: 'tools/call', params: { name: 'estimate_fill_up_cost', arguments: { gallons: 10, miles: 100 } } });
  const r3 = await got(3);
  child.kill();
  assert.equal(r3.result?.isError ?? Boolean(r3.error), true);
});
