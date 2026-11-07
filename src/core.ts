// Pure core for gas-prices-today-mcp. The only I/O is keyless reads of the U.S. Energy Information Administration (EIA)
// weekly retail gasoline and diesel price tables and their history pages, done through an injected fetchText. EIA data is public domain.
import type { FetchText } from './types.js';

export const REPO = 'gas-prices-today-mcp';
export const SITE = 'https://www.mcpstamp.com';
export const UTM = `utm_source=mcp&utm_medium=${REPO}`;
export const more = () => `${SITE}/servers/?${UTM}`;
export const SHOPP = 'https://www.eia.gov/petroleum/gasdiesel/';

export type Grade = 'regular' | 'midgrade' | 'premium' | 'all_grades' | 'diesel';
export const GRADES: Grade[] = ['regular', 'midgrade', 'premium', 'all_grades', 'diesel'];
const PAGE: Record<Grade, string> = { regular: 'epmr', midgrade: 'epmm', premium: 'epmp', all_grades: 'epm0', diesel: 'epd2d' };
export const WEEKLY = (g: Grade) => `https://www.eia.gov/dnav/pet/pet_pri_gnd_a_${PAGE[g]}_pte_dpgal_w.htm`;
export const histUrl = (series: string) => `https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=${series}&f=W`;
export const NAME: Record<Grade, string> = { regular: 'regular gasoline', midgrade: 'midgrade gasoline', premium: 'premium gasoline', all_grades: 'all-grades gasoline', diesel: 'on-highway diesel' };
export const PADD_URL = 'https://www.eia.gov/dnav/pet/TblDefs/pet_pri_gnd_tbldef2.asp';

export class InputError extends Error {}
export class UpstreamError extends Error {}

export interface Row { area: string; series: string; values: (number | null)[] }
export interface Weekly { grade: Grade; weeks: string[]; rows: Row[]; release: string | null; next_release: string | null }
export interface Point { week_of: string; price: number }

const clean = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const mdy = (s: string) => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s.trim()); if (!m) return null; const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; };
const num = (s: string) => { const t = clean(s); return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null; };

/** Parse an EIA weekly retail price table by area (pet_pri_gnd_a_*_pte_dpgal_w.htm). */
export function parseWeekly(html: string, grade: Grade): Weekly {
  const weeks = [...html.matchAll(/<th class="Series5">\s*(\d{2}\/\d{2}\/\d{2})\s*<\/th>/g)].map((m) => mdy(m[1])!);
  if (weeks.length < 2) throw new UpstreamError('the EIA weekly table had no week columns');
  const rows: Row[] = [];
  for (const chunk of html.split('<tr class="DataRow">').slice(1)) {
    const name = /class="DataStub1">([\s\S]*?)<\/td>/.exec(chunk);
    const series = /LeafHandler\.ashx\?n=PET&(?:amp;)?s=([A-Z0-9_]+)&/.exec(chunk);
    if (!name || !series) continue;
    const cells = [...chunk.matchAll(/<td[^>]*class="(?:DataB|Current2)[^"]*"[^>]*>([\s\S]*?)<\/td>/g)].map((m) => num(m[1]));
    rows.push({ area: clean(name[1]), series: series[1], values: cells.slice(-weeks.length) });
  }
  if (!rows.length || rows[0].area !== 'U.S.') throw new UpstreamError('the EIA weekly table did not start with the U.S. row');
  const rel = /Release Date:\s*([0-9/]+)/.exec(html), nxt = /Next Release Date:\s*([0-9/]+)/.exec(html);
  return { grade, weeks, rows, release: rel ? mdy(rel[1]) : null, next_release: nxt ? mdy(nxt[1]) : null };
}

const MON: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
/** Parse an EIA weekly history page (LeafHandler.ashx ... f=W): rows of "YYYY-Mon" then MM/DD and price pairs. */
export function parseHistory(html: string): Point[] {
  const out: Point[] = [];
  let year = '';
  let pending: string | null = null;
  for (const m of html.matchAll(/<td class='(B6|B5|B3)'>([\s\S]*?)<\/td>/g)) {
    const v = clean(m[2]);
    if (m[1] === 'B6') { const ym = /^(\d{4})-([A-Z][a-z]{2})$/.exec(v); year = ym && MON[ym[2]] ? ym[1] : ''; continue; }
    if (m[1] === 'B5') { const md = /^(\d{2})\/(\d{2})$/.exec(v); pending = md && year ? `${year}-${md[1]}-${md[2]}` : null; continue; }
    const p = num(v);
    if (pending && p !== null) out.push({ week_of: pending, price: p });
    pending = null;
  }
  if (out.length < 10) throw new UpstreamError('the EIA history page had too few weekly prices');
  return out.sort((a, b) => (a.week_of < b.week_of ? -1 : 1));
}

export async function loadWeekly(fetchText: FetchText, grade: Grade): Promise<Weekly> {
  return parseWeekly(await fetchText(WEEKLY(grade), { cacheTtl: 900, timeoutMs: 12000, accept: 'text/html,*/*' }), grade);
}
export async function loadHistory(fetchText: FetchText, series: string): Promise<Point[]> {
  return parseHistory(await fetchText(histUrl(series), { cacheTtl: 3600, timeoutMs: 12000, accept: 'text/html,*/*' }));
}

// ---------------------------------------------------------------- areas

const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
/** PADD sub-regions as EIA defines them (PADD_URL). 1A New England, 1B Central Atlantic, 1C Lower Atlantic, 2 Midwest, 3 Gulf Coast, 4 Rocky Mountain, 5 West Coast. */
const REGION_OF: Record<string, string> = {};
for (const [k, codes] of Object.entries({
  'New England (PADD 1A)': 'CT ME MA NH RI VT', 'Central Atlantic (PADD 1B)': 'DE DC MD NJ NY PA', 'Lower Atlantic (PADD 1C)': 'FL GA NC SC VA WV',
  'Midwest (PADD 2)': 'IL IN IA KS KY MI MN MO NE ND OH OK SD TN WI', 'Gulf Coast (PADD 3)': 'AL AR LA MS NM TX', 'Rocky Mountain (PADD 4)': 'CO ID MT UT WY',
  'West Coast (PADD 5)': 'AK AZ CA HI NV OR WA',
})) for (const c of codes.split(' ')) REGION_OF[STATES[c]] = k;
const CITY_ALIAS: Record<string, string> = { nyc: 'New York City', 'new york city': 'New York City', la: 'Los Angeles', sf: 'San Francisco', 'san fran': 'San Francisco' };
const CITIES = ['Boston', 'Chicago', 'Cleveland', 'Denver', 'Houston', 'Los Angeles', 'Miami', 'New York City', 'San Francisco', 'Seattle'];
export const stateName = (v: string) => (/^[a-z]{2}$/i.test(v) && STATES[v.toUpperCase()]) || Object.values(STATES).find((s) => s.toLowerCase() === v.toLowerCase()) || null;

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9()]/g, '');
const hasData = (r: Row) => r.values.some((x) => x !== null);
const isRegion = (r: Row) => /padd/i.test(r.area) || r.area === 'West Coast less California';
export interface Resolved { row: Row; asked: string; kind: 'us' | 'region' | 'state' | 'city'; fallback_from: string | null }

/** Find the EIA row for an area word. A state EIA does not publish is answered with its PADD region and says so. */
export function resolveArea(w: Weekly, area?: string): Resolved {
  const v = (area ?? '').trim();
  const rows = w.rows.filter(hasData);
  if (!v || /^(u\.?s\.?a?|united states|national|nationwide|america)$/i.test(v)) return { row: rows[0], asked: 'U.S.', kind: 'us', fallback_from: null };
  const lc = v.toLowerCase();
  const city = CITY_ALIAS[lc] ?? CITIES.find((c) => c.toLowerCase() === lc);
  if (city) { const r = rows.find((x) => x.area === city); if (r) return { row: r, asked: city, kind: 'city', fallback_from: null }; }
  const st = stateName(v);
  if (st) {
    const r = rows.find((x) => x.area === st);
    if (r) return { row: r, asked: st, kind: 'state', fallback_from: null };
    const reg = REGION_OF[st];
    const rr = rows.find((x) => x.area === reg);
    if (rr) return { row: rr, asked: st, kind: 'region', fallback_from: st };
  }
  const c = compact(v);
  const reg = rows.find((x) => isRegion(x) && (compact(x.area).startsWith(c) || compact(x.area).includes(`(${c})`)));
  if (reg) return { row: reg, asked: reg.area, kind: 'region', fallback_from: null };
  throw new InputError(`"${v}" is not a US state, a surveyed city or an EIA region. Cities EIA prices: ${CITIES.join(', ')}. Regions: ${rows.filter(isRegion).map((r) => r.area).join(', ')}. States EIA prices itself: ${rows.filter((r) => Object.values(STATES).includes(r.area)).map((r) => r.area).join(', ')}. Any other state is answered with its region.`);
}

export function parseGrade(g?: string): Grade {
  const v = (g ?? 'regular').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const map: Record<string, Grade> = { regular: 'regular', unleaded: 'regular', midgrade: 'midgrade', mid: 'midgrade', plus: 'midgrade', premium: 'premium', super: 'premium', all: 'all_grades', all_grades: 'all_grades', gasoline: 'all_grades', diesel: 'diesel' };
  if (!map[v]) throw new InputError(`grade must be one of ${GRADES.join(', ')}.`);
  return map[v];
}

// ---------------------------------------------------------------- tools

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const usd = (n: number) => `$${n.toFixed(3)}`;
const day = (s: string) => Date.parse(`${s}T00:00:00Z`);
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const signed = (n: number) => (n > 0 ? `up ${usd(n)}` : n < 0 ? `down ${usd(-n)}` : 'unchanged');
const inArea = (a: string) => (a === 'U.S.' ? 'the U.S.' : a);

function nearest(points: Point[], d: string): Point | null {
  let best: Point | null = null, bd = Infinity;
  for (const p of points) { const x = Math.abs(day(p.week_of) - day(d)); if (x < bd) { bd = x; best = p; } }
  return best && bd <= 7 * 86400000 ? best : null;
}
const lastIdx = (row: Row) => { let i = row.values.length - 1; while (i >= 0 && row.values[i] === null) i--; return i; };

async function now(fetchText: FetchText, grade: Grade, area: string | undefined, withYearAgo = true) {
  const w = await loadWeekly(fetchText, grade);
  const res = resolveArea(w, area);
  const row = res.row;
  const li = lastIdx(row);
  const price = row.values[li]!;
  const prev = li > 0 ? row.values[li - 1] : null;
  const fourAgo = li >= 4 ? row.values[li - 4] : null;
  let yearAgo: Point | null = null; let yearNote: string | null = null;
  if (withYearAgo) {
    try { yearAgo = nearest(await loadHistory(fetchText, row.series), isoDay(day(w.weeks[li]) - 364 * 86400000)); }
    catch (e) { yearNote = `year-ago price not available (${(e as Error).message})`; }
  }
  return {
    grade, area: row.area, asked: res.asked, kind: res.kind, fallback_from: res.fallback_from, series: row.series,
    week_of: w.weeks[li], price_per_gallon: price,
    week_change: prev !== null ? r3(price - prev) : null,
    four_weeks_ago: fourAgo !== null ? { week_of: w.weeks[li - 4], price_per_gallon: fourAgo, change: r3(price - fourAgo) } : null,
    year_ago: yearAgo ? { week_of: yearAgo.week_of, price_per_gallon: yearAgo.price, change: r3(price - yearAgo.price), change_percent: r2(((price - yearAgo.price) / yearAgo.price) * 100) } : null,
    year_ago_note: yearNote,
    recent_weeks: w.weeks.map((wk, i) => ({ week_of: wk, price_per_gallon: row.values[i] })),
    release_date: w.release, next_release: w.next_release,
    source: WEEKLY(grade), history: histUrl(row.series), weekly: w,
  };
}

export async function getGasPrices(fetchText: FetchText, a: { area?: string; grade?: string }) {
  const grade = parseGrade(a.grade);
  const r = await now(fetchText, grade, a.area);
  const { weekly, ...rest } = r;
  const fb = r.fallback_from ? ` EIA does not publish a price for ${r.fallback_from}, so this is the ${r.area} average that includes it.` : '';
  return {
    summary: `${NAME[grade][0].toUpperCase()}${NAME[grade].slice(1)} in ${inArea(r.area)} averaged ${usd(r.price_per_gallon)} a gallon in the week of ${r.week_of} (${signed(r.week_change ?? 0)} from the week before` +
      `${r.four_weeks_ago ? `, ${signed(r.four_weeks_ago.change)} from four weeks ago` : ''}${r.year_ago ? `, ${usd(r.year_ago.price_per_gallon)} a year ago` : ''}).${fb} ` +
      `Source: U.S. Energy Information Administration weekly retail price survey, released ${weekly.release ?? 'weekly'}; next release ${weekly.next_release ?? 'next week'}.`,
    ...rest,
    note: 'EIA publishes average retail prices including taxes every Monday (Tuesday after a holiday). It prices the U.S., five regions with sub-regions, nine states and ten cities directly. Station prices vary by brand, street and day, so a price on a pump sign can differ from the average.',
    as_of: new Date().toISOString(), source_page: SHOPP, more: more(),
  };
}

export async function compareGasPrices(fetchText: FetchText, a: { grade?: string; group?: string }) {
  const grade = parseGrade(a.grade);
  const group = (a.group ?? 'all').toLowerCase();
  if (!['all', 'states', 'cities', 'regions'].includes(group)) throw new InputError('group must be all, states, cities or regions.');
  const w = await loadWeekly(fetchText, grade);
  const kindOf = (r: Row) => (r.area === 'U.S.' ? 'us' : isRegion(r) ? 'region' : CITIES.includes(r.area) ? 'city' : 'state');
  const ranked = w.rows.filter(hasData).filter((r) => kindOf(r) !== 'us')
    .map((r) => { const i = lastIdx(r); return { area: r.area, kind: kindOf(r), price_per_gallon: r.values[i]!, week_change: i > 0 && r.values[i - 1] !== null ? r3(r.values[i]! - r.values[i - 1]!) : null }; })
    .filter((r) => group === 'all' || r.kind === ({ states: 'state', cities: 'city', regions: 'region' } as Record<string, string>)[group])
    .sort((x, y) => x.price_per_gallon - y.price_per_gallon);
  if (!ranked.length) throw new InputError(`EIA has no ${NAME[grade]} prices for ${group}.`);
  const us = w.rows[0]; const ui = lastIdx(us);
  const lo = ranked[0], hi = ranked[ranked.length - 1];
  return {
    summary: `Among the ${ranked.length} ${group === 'all' ? 'areas' : group} EIA prices for ${NAME[grade]} in the week of ${w.weeks[ui]}, ${lo.area} is cheapest at ${usd(lo.price_per_gallon)} a gallon and ${hi.area} is most expensive at ${usd(hi.price_per_gallon)}. ` +
      `The U.S. average is ${usd(us.values[ui]!)}. Source: EIA weekly retail price survey, released ${w.release ?? 'weekly'}.`,
    grade, group, week_of: w.weeks[ui], us_average: us.values[ui], cheapest: lo, most_expensive: hi, ranking: ranked,
    note: 'EIA publishes prices for nine states and ten cities, not all 50 states, so this is a ranking of the areas it surveys. Other states are covered by their region in get_gas_prices.',
    release_date: w.release, next_release: w.next_release,
    as_of: new Date().toISOString(), source: WEEKLY(grade), more: more(),
  };
}

export async function estimateFillUpCost(fetchText: FetchText, a: { gallons: number; area?: string; grade?: string; price_per_gallon?: number; miles?: number; miles_per_gallon?: number }) {
  if (!(a.gallons > 0 && a.gallons <= 500)) throw new InputError('gallons must be between 0 and 500.');
  if (a.miles !== undefined && !(a.miles > 0 && a.miles <= 100000)) throw new InputError('miles must be between 0 and 100,000.');
  if (a.miles_per_gallon !== undefined && !(a.miles_per_gallon > 0 && a.miles_per_gallon <= 200)) throw new InputError('miles_per_gallon must be between 0 and 200.');
  if ((a.miles !== undefined) !== (a.miles_per_gallon !== undefined)) throw new InputError('Give miles and miles_per_gallon together for a trip cost.');
  const grade = parseGrade(a.grade);
  let price = a.price_per_gallon, from = 'given price', area = a.area ?? 'U.S.', week: string | null = null;
  if (price === undefined) {
    const r = await now(fetchText, grade, a.area, false);
    price = r.price_per_gallon; area = r.area; week = r.week_of;
    from = `EIA average for ${NAME[grade]}, ${r.area}, week of ${r.week_of}${r.fallback_from ? ` (EIA has no price for ${r.fallback_from}, so its region)` : ''}`;
  } else if (!(price > 0 && price < 50)) throw new InputError('price_per_gallon must be between 0 and 50.');
  const fill = price * a.gallons;
  const trip = a.miles !== undefined ? price * (a.miles / a.miles_per_gallon!) : null;
  return {
    summary: `${a.gallons} gallons of ${NAME[grade]} at ${usd(price)} a gallon (${from}) costs $${r2(fill).toLocaleString('en-US', { minimumFractionDigits: 2 })}.` +
      (trip !== null ? ` A ${a.miles}-mile trip at ${a.miles_per_gallon} miles per gallon uses ${r2(a.miles! / a.miles_per_gallon!)} gallons and costs about $${r2(trip).toLocaleString('en-US', { minimumFractionDigits: 2 })}, or ${r2((trip / a.miles!) * 100)} cents a mile.` : ''),
    grade, area, week_of: week, gallons: a.gallons, price_per_gallon: price, price_source: from, total_cost: r2(fill),
    trip: trip !== null ? { miles: a.miles, miles_per_gallon: a.miles_per_gallon, gallons_used: r2(a.miles! / a.miles_per_gallon!), cost: r2(trip), cents_per_mile: r2((trip / a.miles!) * 100) } : null,
    note: 'Uses the EIA area average unless you give your own price. Pump prices vary by station.',
    as_of: new Date().toISOString(), source: WEEKLY(grade), more: more(),
  };
}
