import fs from "node:fs";

const creds = JSON.parse(fs.readFileSync(new URL("./credentials.json", import.meta.url), "utf8"));
const BASE = creds.url;
const DB = creds.databaseId;
const headers = { "Content-Type": "application/json", "X-Metabase-Session": creds.sessionId };

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`${method} ${path} -> ${res.status}\n${text}`);
    throw new Error(`${method} ${path} failed`);
  }
  return text ? JSON.parse(text) : null;
}
const get = (path) => api("GET", path);
const post = (path, body) => api("POST", path, body);
const put = (path, body) => api("PUT", path, body);

// ---------------------------------------------------------------------------
// Table / field metadata lookup
// ---------------------------------------------------------------------------

const meta = await get(`/api/database/${DB}/metadata`);
const tableByName = {};
const fieldByTableAndName = {};
for (const t of meta.tables) {
  tableByName[t.name] = t.id;
  fieldByTableAndName[t.name] = {};
  for (const f of t.fields) fieldByTableAndName[t.name][f.name] = f.id;
}

const T = { asset: tableByName.v_asset_report, license: tableByName.v_license_usage };
const TABLE_NAME = { asset: "v_asset_report", license: "v_license_usage" };

function fieldId(tableKey, fieldName) {
  const id = fieldByTableAndName[TABLE_NAME[tableKey]]?.[fieldName];
  if (!id) throw new Error(`Unknown field ${fieldName} on ${TABLE_NAME[tableKey]}`);
  return id;
}
function fref(tableKey, fieldName) {
  return ["field", fieldId(tableKey, fieldName), null];
}

// ---------------------------------------------------------------------------
// Small MBQL helpers
// ---------------------------------------------------------------------------

const notBlank = (t, f) => ["!=", fref(t, f), ""];
const isTrue = (t, f) => ["=", fref(t, f), true];
const isFalse = (t, f) => ["=", fref(t, f), false];
const eq = (t, f, v) => ["=", fref(t, f), v];
const inList = (t, f, values) => ["=", fref(t, f), ...values];

function baseQuery(tableKey) {
  return { "source-table": T[tableKey] };
}

/** A KPI number tile. */
function scalarCard(name, tableKey, aggregation, opts = {}) {
  return {
    name,
    section: opts.section,
    display: "scalar",
    table: tableKey,
    description: opts.description,
    dataset_query: {
      type: "query",
      database: DB,
      query: { ...baseQuery(tableKey), aggregation: [aggregation], ...(opts.filter ? { filter: opts.filter } : {}) },
    },
    visualization_settings: opts.vizSettings ?? {},
    size: opts.size ?? { x: 4, y: 4 },
  };
}

/** A grouped chart (bar/line/pie/row). breakout: fieldName or [fieldName, seriesFieldName]. */
function chartCard(name, tableKey, display, breakout, opts = {}) {
  const breakoutFields = Array.isArray(breakout) ? breakout : [breakout];
  const query = {
    ...baseQuery(tableKey),
    aggregation: [opts.aggregation ?? ["count"]],
    breakout: breakoutFields.map((f) => fref(tableKey, f)),
  };
  if (opts.filter) query.filter = opts.filter;
  if (opts.orderByCountDesc) query["order-by"] = [["desc", ["aggregation", 0]]];
  if (opts.limit) query.limit = opts.limit;

  return {
    name,
    section: opts.section,
    display,
    table: tableKey,
    description: opts.description,
    dataset_query: { type: "query", database: DB, query },
    visualization_settings: opts.vizSettings ?? {},
    size: opts.size ?? { x: 12, y: 8 },
  };
}

/** A plain data table (no aggregation) listing specific columns. */
function tableCard(name, tableKey, fields, opts = {}) {
  const query = { ...baseQuery(tableKey), fields: fields.map((f) => fref(tableKey, f)) };
  if (opts.filter) query.filter = opts.filter;
  if (opts.orderBy) query["order-by"] = opts.orderBy;
  if (opts.limit) query.limit = opts.limit;

  return {
    name,
    section: opts.section,
    display: "table",
    table: tableKey,
    description: opts.description,
    dataset_query: { type: "query", database: DB, query },
    visualization_settings: opts.vizSettings ?? {},
    size: opts.size ?? { x: 24, y: 8 },
  };
}

/** A custom-aggregation table, for cases the helpers above can't express directly. */
function customCard(name, tableKey, aggregation, breakout, opts = {}) {
  const query = {
    ...baseQuery(tableKey),
    aggregation,
    breakout: (Array.isArray(breakout) ? breakout : [breakout]).map((f) => fref(tableKey, f)),
  };
  if (opts.filter) query.filter = opts.filter;
  if (opts.orderBy) query["order-by"] = opts.orderBy;
  return {
    name,
    section: opts.section,
    display: opts.display ?? "table",
    table: tableKey,
    description: opts.description,
    dataset_query: { type: "query", database: DB, query },
    visualization_settings: opts.vizSettings ?? {},
    size: opts.size ?? { x: 24, y: 8 },
  };
}

// The "software license" boolean fields, unpivoted in v_license_usage.softwareName - listed
// here only for readability/reference; cards below query v_license_usage directly.
const SOFTWARE_NAMES = [
  "Microsoft Office", "Microsoft Project", "Power BI", "AutoCAD", "ZWCAD", "Photoshop",
  "Creative Cloud Pro", "Illustrator", "Acrobat Pro", "SketchUp Pro", "RocketReach Pro",
  "D5 Render", "Zoom", "Canva",
];

// ---------------------------------------------------------------------------
// Card definitions, grouped by dashboard section (matches spec section 15 order)
// ---------------------------------------------------------------------------

const licensedCase = ["case", [[isTrue("license", "hasLicense"), 1]], { default: 0 }];

const CARDS = [
  // 2. Executive Summary --------------------------------------------------
  scalarCard("Total Employees", "asset", ["distinct", fref("asset", "employeeId")], {
    section: "Executive Summary",
    filter: notBlank("asset", "employeeId"),
    description: "Distinct Employee IDs present on the asset register.",
  }),
  scalarCard("Total IT Assets", "asset", ["count"], { section: "Executive Summary" }),
  scalarCard("Active Assets", "asset", ["count"], {
    section: "Executive Summary",
    filter: eq("asset", "status", "Assigned"),
    description: "Assets currently assigned to and in active use by an employee.",
  }),
  scalarCard("Available Assets", "asset", ["count"], {
    section: "Executive Summary",
    filter: inList("asset", "status", ["Available", "In Stock"]),
  }),
  scalarCard("Assets Under Repair", "asset", ["count"], {
    section: "Executive Summary",
    filter: eq("asset", "status", "Under Repair"),
  }),
  scalarCard("Assets Retired", "asset", ["count"], {
    section: "Executive Summary",
    filter: eq("asset", "status", "Retired"),
  }),
  scalarCard("Laptops", "asset", ["count"], { section: "Executive Summary", filter: eq("asset", "category", "Laptop") }),
  scalarCard("Desktops", "asset", ["count"], { section: "Executive Summary", filter: eq("asset", "category", "Desktop") }),
  scalarCard("Warranty Expiring Soon", "asset", ["count"], {
    section: "Executive Summary",
    filter: inList("asset", "warrantyStatus", ["Expiring in 30 Days", "Expiring in 60 Days", "Expiring in 90 Days"]),
  }),
  scalarCard("Total Asset Purchase Value", "asset", ["sum", fref("asset", "purchaseCost")], {
    section: "Executive Summary",
    vizSettings: { column_settings: {} },
  }),
  scalarCard("Licensed Software (assignments)", "license", ["sum", licensedCase], {
    section: "Executive Summary",
    description: "Count of asset+software pairs currently flagged as licensed, across all 14 tracked applications.",
  }),
  scalarCard("Unlicensed / Missing Software Licenses", "license", ["count"], {
    section: "Executive Summary",
    filter: isFalse("license", "hasLicense"),
    description: "Count of asset+software pairs NOT flagged as licensed (includes software simply not installed).",
  }),

  // 3. Asset Overview ------------------------------------------------------
  chartCard("Assets by Location", "asset", "bar", "location", { section: "Asset Inventory" }),
  chartCard("Assets by Sub-Location", "asset", "bar", "subLocation", { section: "Asset Inventory", orderByCountDesc: true, limit: 15 }),
  chartCard("Assets by Department", "asset", "bar", "department", { section: "Asset Inventory", orderByCountDesc: true, limit: 15 }),
  chartCard("Assets by Designation", "asset", "bar", "designation", { section: "Asset Inventory", orderByCountDesc: true, limit: 15 }),
  chartCard("Laptop vs Desktop", "asset", "pie", "category", {
    section: "Asset Inventory",
    filter: inList("asset", "category", ["Laptop", "Desktop"]),
    size: { x: 8, y: 8 },
  }),
  chartCard("Assets by Make / Brand", "asset", "bar", "manufacturer", { section: "Asset Inventory", orderByCountDesc: true, limit: 15 }),
  chartCard("Assets by Model", "asset", "bar", "model", { section: "Asset Inventory", orderByCountDesc: true, limit: 15 }),
  chartCard("Assets by Operating System", "asset", "bar", "operatingSystem", { section: "Asset Inventory", orderByCountDesc: true, limit: 15 }),
  chartCard("Assets by Asset Type", "asset", "bar", "assetType", { section: "Asset Inventory", orderByCountDesc: true, limit: 15 }),
  chartCard("Assets by Current Owner", "asset", "bar", "currentOwner", { section: "Asset Inventory", orderByCountDesc: true, limit: 15 }),

  // 4. Asset Status ---------------------------------------------------------
  chartCard("Assets by Status", "asset", "bar", "status", { section: "Asset Inventory", orderByCountDesc: true }),
  chartCard("Assets by Approval Status", "asset", "bar", "approvalStatus", { section: "Asset Inventory" }),

  // 5. Employee & Ownership -------------------------------------------------
  tableCard(
    "Employee & Ownership Register",
    "asset",
    ["employeeId", "employeeName", "department", "designation", "location", "email", "assetType", "manufacturer", "model", "serialNumber", "currentOwner", "previousOwner", "status"],
    { section: "Employee & Ownership", size: { x: 24, y: 10 } }
  ),

  // 6. Hardware Information --------------------------------------------------
  chartCard("Assets by Processor", "asset", "bar", "processor", { section: "Hardware", orderByCountDesc: true, limit: 15, filter: notBlank("asset", "processor") }),
  chartCard("Assets by Laptop Generation", "asset", "bar", "laptopGeneration", { section: "Hardware", filter: notBlank("asset", "laptopGeneration") }),
  chartCard("Assets by RAM", "asset", "bar", "ram", { section: "Hardware", filter: notBlank("asset", "ram") }),
  chartCard("Assets by Storage", "asset", "bar", "storage", { section: "Hardware", orderByCountDesc: true, limit: 15, filter: notBlank("asset", "storage") }),
  chartCard("Assets by Graphics Card", "asset", "bar", "graphicsCard", { section: "Hardware", orderByCountDesc: true, limit: 15, filter: notBlank("asset", "graphicsCard") }),
  chartCard("Assets by Device Type", "asset", "bar", "deviceType", { section: "Hardware", filter: notBlank("asset", "deviceType") }),
  tableCard(
    "Hardware Register (oldest first - candidates for refresh)",
    "asset",
    ["assetId", "name", "manufacturer", "model", "processor", "ram", "storage", "graphicsCard", "serialNumber", "macAddress", "adapterSerialNumber", "ageYears", "needsHardwareReview"],
    {
      section: "Hardware",
      orderBy: [["desc", fref("asset", "ageYears")]],
      size: { x: 24, y: 10 },
      description: 'needsHardwareReview flags devices purchased 4+ years ago as heuristic replacement candidates.',
    }
  ),

  // 7. Software & License Compliance (v_license_usage) ---------------------
  customCard(
    "License Utilization by Software",
    "license",
    [
      ["aggregation-options", ["count"], { "display-name": "Total Assets" }],
      ["aggregation-options", ["sum", licensedCase], { "display-name": "Licensed" }],
      ["aggregation-options", ["-", ["count"], ["sum", licensedCase]], { "display-name": "Unlicensed" }],
      ["aggregation-options", ["*", ["/", ["sum", licensedCase], ["count"]], 100], { "display-name": "Utilization %" }],
    ],
    "softwareName",
    { section: "Software & Licenses", size: { x: 24, y: 8 }, orderBy: [["asc", fref("license", "softwareName")]] }
  ),
  customCard(
    "Department-wise Software Usage",
    "license",
    [["aggregation-options", ["sum", licensedCase], { "display-name": "Licensed Users" }]],
    ["softwareName", "department"],
    { section: "Software & Licenses", size: { x: 24, y: 10 }, filter: notBlank("license", "department") }
  ),
  tableCard(
    "Unlicensed Software Flags",
    "license",
    ["assetId", "employeeId", "employeeName", "department", "softwareName", "hasLicense"],
    {
      section: "Software & Licenses",
      filter: isFalse("license", "hasLicense"),
      size: { x: 24, y: 10 },
      description: "Every asset+software pair not currently flagged as licensed.",
      vizSettings: {
        "table.column_formatting": [
          { columns: ["hasLicense"], type: "boolean", operator: "is-false", color: "#EF8C8C", highlight_row: true },
        ],
      },
    }
  ),

  // 8. Security & Compliance -------------------------------------------------
  chartCard("AD Member - Yes/No", "asset", "pie", "isAdMember", { section: "Security & Compliance", size: { x: 6, y: 8 } }),
  chartCard("Antivirus Installed - Yes/No", "asset", "pie", "hasAntivirus", { section: "Security & Compliance", size: { x: 6, y: 8 } }),
  chartCard("OS License Status", "asset", "pie", "isOsLicensed", { section: "Security & Compliance", size: { x: 6, y: 8 } }),
  chartCard("User Access - Admin vs Standard", "asset", "pie", "userAccessLevel", { section: "Security & Compliance", size: { x: 6, y: 8 }, filter: notBlank("asset", "userAccessLevel") }),
  chartCard("Remote Software in Use", "asset", "bar", "remoteSoftware", { section: "Security & Compliance", filter: notBlank("asset", "remoteSoftware"), orderByCountDesc: true, limit: 10 }),
  chartCard("Shared Folder Access - Yes/No", "asset", "pie", "sharedFolderAccess", { section: "Security & Compliance", size: { x: 6, y: 8 }, filter: notBlank("asset", "sharedFolderAccess") }),
  scalarCard("Overall IT Compliance Score", "asset", ["avg", fref("asset", "complianceScore")], {
    section: "Security & Compliance",
    size: { x: 6, y: 8 },
    description: "Average of 3 signals per asset (AD member / antivirus installed / OS license present), 0-100.",
    vizSettings: { "scalar.field": "complianceScore" },
  }),

  // 9. Warranty Dashboard -----------------------------------------------------
  chartCard("Assets by Warranty Status", "asset", "bar", "warrantyStatus", { section: "Warranty", orderByCountDesc: true }),
  tableCard(
    "Warranty Register (soonest expiry first)",
    "asset",
    ["employeeName", "name", "serialNumber", "purchaseDate", "warrantyEnd", "vendor", "warrantyStatus"],
    {
      section: "Warranty",
      filter: ["!=", fref("asset", "warrantyStatus"), "No Warranty Date"],
      orderBy: [["asc", fref("asset", "warrantyEnd")]],
      size: { x: 24, y: 10 },
      vizSettings: {
        "table.column_formatting": [
          { columns: ["warrantyStatus"], type: "string", operator: "=", value: "Expired", color: "#EF8C8C", highlight_row: true },
          { columns: ["warrantyStatus"], type: "string", operator: "=", value: "Expiring in 30 Days", color: "#F9D45C", highlight_row: true },
        ],
      },
    }
  ),

  // 10. Purchase & Vendor Analysis --------------------------------------------
  chartCard("Purchase Value by Year", "asset", "line", "purchaseYear", {
    section: "Purchase & Vendors",
    aggregation: ["sum", fref("asset", "purchaseCost")],
    filter: ["not", ["is-null", fref("asset", "purchaseYear")]],
  }),
  chartCard("Assets Purchased by Year", "asset", "bar", "purchaseYear", {
    section: "Purchase & Vendors",
    filter: ["not", ["is-null", fref("asset", "purchaseYear")]],
  }),
  chartCard("Purchase Value by Vendor", "asset", "bar", "vendor", {
    section: "Purchase & Vendors",
    aggregation: ["sum", fref("asset", "purchaseCost")],
    orderByCountDesc: true,
    limit: 15,
  }),
  chartCard("Purchase Value by Company", "asset", "bar", "companyName", {
    section: "Purchase & Vendors",
    aggregation: ["sum", fref("asset", "purchaseCost")],
    filter: notBlank("asset", "companyName"),
    orderByCountDesc: true,
    limit: 15,
  }),
  scalarCard("Average Asset Cost", "asset", ["avg", fref("asset", "purchaseCost")], { section: "Purchase & Vendors", size: { x: 6, y: 6 } }),
  chartCard("Vendor-wise Asset Count", "asset", "bar", "vendor", { section: "Purchase & Vendors", orderByCountDesc: true, limit: 15 }),
  tableCard(
    "Purchase & Invoice Register",
    "asset",
    ["assetId", "invoiceNumber", "purchaseDate", "vendor", "companyName", "purchaseCost", "quantity"],
    { section: "Purchase & Vendors", size: { x: 24, y: 10 } }
  ),

  // 11. Asset Condition & Repair -------------------------------------------------
  chartCard("Assets by Condition", "asset", "bar", "condition", { section: "Asset Condition & Repairs", filter: notBlank("asset", "condition") }),
  scalarCard("Assets With Repair History", "asset", ["count"], {
    section: "Asset Condition & Repairs",
    filter: isTrue("asset", "hasRepairHistory"),
    size: { x: 8, y: 6 },
    description: "Assets with a non-empty repair history note. The register stores repair history as free text, not a repeatable log, so a true repeat-repair frequency isn't derivable yet.",
  }),
  tableCard(
    "Repair History Register",
    "asset",
    ["assetId", "name", "condition", "conditionNotes", "repairHistory", "status"],
    { section: "Asset Condition & Repairs", filter: isTrue("asset", "hasRepairHistory"), size: { x: 24, y: 10 } }
  ),

  // 13. Detailed Asset Register ------------------------------------------------
  tableCard(
    "Detailed Asset Register",
    "asset",
    [
      "location", "subLocation", "status", "userAccessLevel", "employeeId", "employeeName", "department", "designation",
      "email", "emailLicense", "deviceType", "assetType", "manufacturer", "model", "serialNumber", "processor",
      "laptopGeneration", "graphicsCard", "ram", "storage", "macAddress", "adapterSerialNumber", "miscAccessories",
      "operatingSystem", "operatingSystemLicense", "hostname", "adMember", "antivirusInstalled", "remoteSoftware",
      "sharedFolderAccess", "purchaseDate", "warrantyEnd", "vendor", "companyName", "purchaseCost", "quantity",
      "invoiceNumber", "color", "condition", "currentOwner", "previousOwner", "conditionNotes", "approvalStatus",
      "repairHistory",
    ],
    { section: "Detailed Asset Register", size: { x: 24, y: 12 } }
  ),
];

// ---------------------------------------------------------------------------
// Dashboard filters (spec section 12)
// ---------------------------------------------------------------------------

const FILTERS = [
  { name: "Location", type: "string/=", map: { asset: "location", license: "location" } },
  { name: "Sub-Location", type: "string/=", map: { asset: "subLocation" } },
  { name: "Department", type: "string/=", map: { asset: "department", license: "department" } },
  { name: "Employee Name", type: "string/=", map: { asset: "employeeName", license: "employeeName" } },
  { name: "Employee ID", type: "string/=", map: { asset: "employeeId", license: "employeeId" } },
  { name: "Asset Type", type: "string/=", map: { asset: "assetType" } },
  { name: "Device Type", type: "string/=", map: { asset: "deviceType" } },
  { name: "Make", type: "string/=", map: { asset: "manufacturer" } },
  { name: "Model", type: "string/=", map: { asset: "model" } },
  { name: "Asset Status", type: "string/=", map: { asset: "status", license: "status" } },
  { name: "Current Owner", type: "string/=", map: { asset: "currentOwner" } },
  { name: "Operating System", type: "string/=", map: { asset: "operatingSystem" } },
  { name: "Software", type: "string/=", map: { license: "softwareName" } },
  { name: "Vendor", type: "string/=", map: { asset: "vendor" } },
  { name: "Warranty Status", type: "string/=", map: { asset: "warrantyStatus" } },
  { name: "Purchase Year", type: "number/=", map: { asset: "purchaseYear" } },
  { name: "Asset Condition", type: "string/=", map: { asset: "condition" } },
  { name: "Approval Status", type: "string/=", map: { asset: "approvalStatus" } },
];

// ---------------------------------------------------------------------------
// Provision: collection -> cards -> dashboard -> layout -> filters
// ---------------------------------------------------------------------------

async function findByName(kind, name) {
  const results = await get(`/api/${kind}/?archived=false`).catch(() => null);
  if (!Array.isArray(results)) return null;
  return results.find((r) => r.name === name) ?? null;
}

console.log("Setting up collection...");
const oldCollection = await findByName("collection", "IT Asset Management");
if (oldCollection) {
  await put(`/api/collection/${oldCollection.id}`, { archived: true });
  console.log("Archived previous collection", oldCollection.id, "(and its cards/dashboards)");
}
const collection = await post("/api/collection", { name: "IT Asset Management", color: "#1E3A8A" });
console.log("Created collection", collection.id);

console.log(`Creating ${CARDS.length} cards...`);
const createdCards = [];
for (const c of CARDS) {
  const card = await post("/api/card", {
    name: c.name,
    display: c.display,
    collection_id: collection.id,
    description: c.description ?? null,
    dataset_query: c.dataset_query,
    visualization_settings: c.visualization_settings,
  });
  createdCards.push({ ...c, id: card.id });
  console.log(` - [${c.section}] ${c.name} -> card ${card.id}`);
}

console.log("Creating dashboard...");
const dashboard = await post("/api/dashboard", {
  name: "IT Asset Management Dashboard",
  collection_id: collection.id,
  description: "Generated by metabase/provision.mjs - re-run that script to rebuild from scratch.",
});
console.log("Created dashboard", dashboard.id);

// --- Layout: pack cards left-to-right in a 24-col grid, grouped by section, with a heading per section
const GRID_W = 24;
let row = 0;
const dashcards = [];
let dashcardSeq = -1;

let lastSection = null;
for (const c of createdCards) {
  if (c.section !== lastSection) {
    dashcards.push({
      id: dashcardSeq--,
      card_id: null,
      row,
      col: 0,
      size_x: GRID_W,
      size_y: 1,
      series: [],
      parameter_mappings: [],
      visualization_settings: {
        virtual_card: { display: "heading", dataset_query: {}, visualization_settings: {}, archived: false },
        text: `## ${c.section}`,
      },
    });
    row += 1;
    lastSection = c.section;
    var col = 0;
    var rowMaxY = 0;
  }

  const sizeX = c.size.x;
  const sizeY = c.size.y;
  if (col + sizeX > GRID_W) {
    row += rowMaxY;
    col = 0;
    rowMaxY = 0;
  }

  dashcards.push({
    id: dashcardSeq--,
    card_id: c.id,
    row,
    col,
    size_x: sizeX,
    size_y: sizeY,
    series: [],
    parameter_mappings: [],
    visualization_settings: {},
    _table: c.table,
  });

  col += sizeX;
  rowMaxY = Math.max(rowMaxY, sizeY);
}

console.log(`Placing ${dashcards.length} dashcards (incl. section headings)...`);
let dashResult = await put(`/api/dashboard/${dashboard.id}`, {
  dashcards: dashcards.map(({ _table, ...dc }) => dc),
});

// --- Filters: create parameters, then map each to every dashcard whose table has a matching field
console.log(`Wiring ${FILTERS.length} dashboard filters...`);
const parameters = FILTERS.map((f, i) => ({
  id: `f${i}${Date.now().toString(36).slice(-4)}`,
  name: f.name,
  slug: f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  type: f.type,
  sectionId: f.type.startsWith("number") ? "number" : "string",
}));

const currentDashcards = dashResult.dashcards;
const cardTableById = new Map(dashcards.filter((d) => d.card_id != null).map((d) => [d.card_id, d._table]));

const mappedDashcards = currentDashcards.map((dc) => {
  if (dc.card_id == null) return dc;
  const tableKey = cardTableById.get(dc.card_id);
  const mappings = [];
  FILTERS.forEach((f, i) => {
    const fieldName = f.map[tableKey];
    if (!fieldName) return;
    mappings.push({ parameter_id: parameters[i].id, card_id: dc.card_id, target: ["dimension", fref(tableKey, fieldName)] });
  });
  return { ...dc, parameter_mappings: mappings };
});

dashResult = await put(`/api/dashboard/${dashboard.id}`, {
  parameters,
  dashcards: mappedDashcards,
});

console.log("\nDone.");
console.log(`Dashboard URL: ${BASE}/dashboard/${dashboard.id}`);

const summary = { collectionId: collection.id, dashboardId: dashboard.id, cardCount: createdCards.length, filterCount: parameters.length };
fs.writeFileSync(new URL("./provision_result.json", import.meta.url), JSON.stringify(summary, null, 2));
