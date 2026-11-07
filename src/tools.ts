// Tool registry shared by the stdio and Worker entries.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { InputError, REPO, SITE, compareGasPrices, estimateFillUpCost, getGasPrices } from './core.js';
import type { FetchText } from './types.js';

export const VERSION = '1.0.0';

export const META = {
  alias: 'gas-prices-today',
  metaDescription: 'MCP server for gas prices today: the EIA weekly average retail price of gasoline and diesel for the US, regions, nine states and ten cities, with change from last week and last year.',
  intro: 'Gas prices today for AI assistants, read live from the U.S. Energy Information Administration weekly retail price survey.',
};

export const TOOL_INFO = [
  { name: 'get_gas_prices', blurb: 'This week\'s EIA average retail price per gallon of regular, midgrade, premium gasoline or diesel for the US, a region, a surveyed state or city, with the change from last week, four weeks ago and a year ago.' },
  { name: 'compare_gas_prices', blurb: 'Ranks the states, cities and regions EIA prices from cheapest to most expensive for a grade, against the US average.' },
  { name: 'estimate_fill_up_cost', blurb: 'What a fill-up costs at the EIA area average or your own price, and the cost of a trip from miles and miles per gallon.' },
];

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

function ok(data: Record<string, unknown> & { summary: string }) {
  return { content: [{ type: 'text' as const, text: `${data.summary}\n\n${JSON.stringify(data, null, 2)}` }], structuredContent: data };
}
function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { isError: true, content: [{ type: 'text' as const, text: `${e instanceof InputError ? 'Error' : 'Upstream EIA error'}: ${msg}` }] };
}
const wrap = <A>(f: (a: A) => unknown) => async (a: A) => { try { return ok((await f(a)) as any); } catch (e) { return fail(e); } };
const area = z.string().max(40).optional().describe('US, a state name or code ("Texas", "CA"), a city EIA prices ("Chicago", "NYC"), or an EIA region ("Midwest", "PADD 2"). Default US. A state EIA does not price is answered with its region.');
const grade = z.enum(['regular', 'midgrade', 'premium', 'all_grades', 'diesel']).optional().describe('Default regular.');

export function createServer(fetchText: FetchText): McpServer {
  const server = new McpServer({ name: REPO, version: VERSION, websiteUrl: SITE } as any, {
    instructions:
      'Average retail gas and diesel prices per gallon, read at call time from the U.S. Energy Information Administration (EIA) weekly survey (published Mondays). ' +
      'A model cannot know this week\'s price. Use get_gas_prices for "gas prices today" or "price of gas in <place>", compare_gas_prices for the cheapest and most expensive places, and cite EIA. These are averages, not station prices.',
  });

  server.registerTool('get_gas_prices', {
    title: 'Get gas prices today',
    description:
      'Latest EIA weekly average retail price per gallon (taxes included) of regular, midgrade or premium gasoline, all grades or diesel for the US, an EIA region, one of nine surveyed states, one of ten surveyed cities, or the region of any other state, read at call time from eia.gov: ' +
      'price, change from last week and four weeks ago, the price a year ago, the last six survey weeks and the next release date.',
    inputSchema: { area, grade },
    annotations: { title: 'Gas prices today', ...RO },
  }, wrap((a: any) => getGasPrices(fetchText, a)));

  server.registerTool('compare_gas_prices', {
    title: 'Compare gas prices by place',
    description: 'Ranks the areas EIA prices (states, cities, regions) from cheapest to most expensive for a grade this week, with the US average, the cheapest and the most expensive area.',
    inputSchema: { grade, group: z.enum(['all', 'states', 'cities', 'regions']).optional().describe('Which areas to rank. Default all.') },
    annotations: { title: 'Gas prices ranked by place', ...RO },
  }, wrap((a: any) => compareGasPrices(fetchText, a)));

  server.registerTool('estimate_fill_up_cost', {
    title: 'Estimate fill-up and trip cost',
    description: 'Cost of filling a tank (gallons times this week\'s EIA average for the area, or your price per gallon), and optionally the fuel cost of a trip from miles and miles per gallon, including cents per mile.',
    inputSchema: {
      gallons: z.number().gt(0).max(500).describe('Gallons to buy, for example 15.'),
      area, grade,
      price_per_gallon: z.number().gt(0).lt(50).optional().describe('Your own price per gallon. Default the EIA average for the area.'),
      miles: z.number().gt(0).max(100000).optional().describe('Trip distance in miles. Give with miles_per_gallon.'),
      miles_per_gallon: z.number().gt(0).max(200).optional().describe('Your vehicle fuel economy. Give with miles.'),
    },
    annotations: { title: 'Fill-up and trip cost', ...RO },
  }, wrap((a: any) => estimateFillUpCost(fetchText, a)));

  return server;
}
