# gas-prices-today-mcp

Gas prices today for AI assistants. Ask for this week's price per gallon in your state or city and get the U.S. Energy Information Administration (EIA) average for regular, midgrade, premium or diesel, the change from last week, last month and a year ago, and what a fill-up or a trip costs.

This is a Model Context Protocol (MCP) server. It reads the EIA weekly retail gasoline and diesel survey at call time and needs no API key.

## Tools

| Tool | What it returns |
| --- | --- |
| `get_gas_prices` | This week's EIA average retail price per gallon (taxes included) for the US, a region, one of nine surveyed states, one of ten surveyed cities or the region of any other state, with the change from last week, four weeks ago and a year ago. |
| `compare_gas_prices` | The states, cities and regions EIA prices, ranked from cheapest to most expensive, against the US average. |
| `estimate_fill_up_cost` | The cost of a fill-up at the area average or your price, and the cost of a trip from miles and miles per gallon. |

Every result has structured JSON, a one-paragraph summary, `as_of`, `source` and `more` (a page on [mcpstamp.com](https://www.mcpstamp.com/servers/?utm_source=mcp&utm_medium=gas-prices-today-mcp)). Every tool is marked read-only.

## What it knows that your model does not

- This week's price. EIA publishes new averages every Monday, so a remembered number is stale.
- Which places EIA prices itself. It covers the US, five regions with sub-regions, nine states (California, Colorado, Florida, Massachusetts, Minnesota, New York, Ohio, Texas, Washington) and ten cities. For any other state the server says so and returns the EIA region that contains it.
- The price a year ago, read from the EIA weekly history file.

## Install

### Hosted (Claude.ai custom connector, ChatGPT developer mode)

Paste this URL. No token, no sign-up.

```
https://gas-prices-today-mcp.lipmichal.workers.dev/mcp
```

### Claude Code

```
claude mcp add --transport http gas-prices-today https://gas-prices-today-mcp.lipmichal.workers.dev/mcp
```

### Claude Desktop

Claude Desktop adds remote servers under Settings, Connectors, Add custom connector. Paste the URL above.

### Cursor

Add to `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "gas-prices-today": { "url": "https://gas-prices-today-mcp.lipmichal.workers.dev/mcp" }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`.

```json
{
  "servers": {
    "gas-prices-today": { "type": "http", "url": "https://gas-prices-today-mcp.lipmichal.workers.dev/mcp" }
  }
}
```

### Local stdio

The npm package is not published. Build it from this repository with Node 20 or newer.

```
git clone https://github.com/theluckystrike/gas-prices-today-mcp && cd gas-prices-today-mcp
npm install && npm run build
claude mcp add gas-prices-today -- node $(pwd)/dist/stdio.js
```

## Example prompts

- "What are gas prices today?"
- "How much is a gallon of regular in Texas right now, and what was it a year ago?"
- "Which state EIA surveys has the most expensive gas?"
- "What is the diesel price in California this week?"
- "What will a 300 mile trip cost at 30 miles per gallon?"

## Data sources

Full list with fetch dates in [DATA_SOURCES.md](DATA_SOURCES.md).

- [EIA weekly retail gasoline and diesel prices](https://www.eia.gov/petroleum/gasdiesel/), the per-area tables for regular, midgrade, premium, all grades and diesel, read at call time.
- EIA weekly history pages (LeafHandler) for the price a year ago.
- [EIA PADD definitions](https://www.eia.gov/dnav/pet/TblDefs/pet_pri_gnd_tbldef2.asp) for which states belong to which region.

## Limitations

- State, city and regional averages from a retail survey, not the price at your station.
- EIA prices nine states and ten cities directly. Other states get their region's average.
- Diesel is priced for the US, the regions and California only.
- The hosted server caches EIA pages for up to 15 minutes.

## More

More MCP servers that answer questions your assistant cannot answer alone are on [mcpstamp.com](https://www.mcpstamp.com/servers/?utm_source=mcp&utm_medium=gas-prices-today-mcp).

Part of the Zovo MCP collection at https://mcp.zovo.one

Built by [theluckystrike](https://github.com/theluckystrike).

## Development

```
npm install
npm test                              # builds, then runs the fixture tests and an offline stdio test
node scripts/stdio-transcript.mjs     # live stdio round trip, writes .live/stdio-transcript.jsonl
```

## License

MIT

## More from zovo

- [All free zovo VS Code extensions](https://marketplace.visualstudio.com/publishers/zovo) — file viewers, database clients, formatters. Offline, no telemetry, no sign-up.
- [Full MCP server catalogue](https://theluckystrike.github.io/mcp/) — local-first MCP servers for back-office work: invoices, VAT, PDFs, spreadsheets, payroll.
- [Hosted no-install MCP endpoints](https://mcp.zovo.one) — paste a URL in Claude / Cursor, nothing to install.
