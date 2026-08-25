# Metabase IT Asset Management Dashboard

Metabase runs as a plain Java process on this machine (no Docker - this machine has
neither WSL2 nor Hyper-V enabled, which Docker Desktop's engine requires). It reads
from the same MongoDB the app uses (`it_asset_management`), through two read-only
reporting views defined in `backend/src/scripts/setupReportingViews.ts`.

## Running instance

- URL: http://localhost:3000
- Dashboard: **IT Asset Management Dashboard** (in the "IT Asset Management" collection)
- Admin login: see `credentials.json` (gitignored - not committed)
- Jar + data files live outside this repo, at `C:\Users\maneesh.gond\metabase-it-assets\`
  (Metabase's plugin loader crashes on paths containing spaces, which this project's path
  has, so it can't run from inside the repo itself)

### Start / stop

```powershell
# Start (from C:\Users\maneesh.gond\metabase-it-assets)
& "C:\Program Files\Eclipse Adoptium\jre-21.0.12.101-hotspot\bin\java.exe" -jar metabase.jar
# Health check: http://localhost:3000/api/health

# Stop: kill the java process (Metabase has no separate stop command)
```

It was started this session as a background process; restart it the same way after a
machine reboot (it does not currently run as a Windows service).

## Reporting layer

Two MongoDB **views** (not materialized - they recompute on every query, so they're
always fresh with no refresh job to run):

- **`v_asset_report`** - one row per asset, all ~60 Asset Register fields, joined to
  Category/Location/Department/Vendor/User names, plus computed fields: `warrantyStatus`
  (Active/Expired/Expiring in 30·60·90 Days/No Warranty Date), `purchaseYear`, `ageYears`,
  `hasRepairHistory`, `isAdMember`, `hasAntivirus`, `isOsLicensed`, `complianceScore`
  (0-100, average of those 3 signals), `needsHardwareReview` (purchased 4+ years ago).
- **`v_license_usage`** - one row per (asset, software) pair, unpivoting the 14 tracked
  applications (Microsoft Office, AutoCAD, Photoshop, etc.) into `softwareName` /
  `hasLicense`, for utilization and department-usage breakdowns.

Rebuild them after changing the Asset schema:

```
cd backend
npm run setup:reporting-views
```

Views are dropped and recreated every run - safe to re-run any time. If you add or
rename a field that's genuinely absent from every stored document right now (as
happened with `quantity` during this build), wrap it in `$ifNull` in the pipeline -
otherwise MongoDB's schema sync won't discover the column at all.

## Rebuilding the dashboard

`provision.mjs` is fully data-driven and safe to re-run: it archives the previous
"IT Asset Management" collection (and everything in it - cards, dashboard) and
rebuilds all 55 cards, the dashboard, its 10 section headings, and its 18 filters
from scratch.

```
cd metabase
node provision.mjs
```

Edit the `CARDS` and `FILTERS` arrays in that file to add/change charts or filters -
each card is one small declarative object (see the helper functions `scalarCard`,
`chartCard`, `tableCard`, `customCard` at the top of the file).

`setup_admin.mjs` only needs to run once ever (creates the Metabase admin account and
the MongoDB connection) - it's a no-op if setup has already completed.

## Known data gaps (not bugs - the underlying data isn't populated yet)

The 494 pre-existing real assets don't yet have values for the fields added in the
57-field expansion (Processor, RAM, Storage, all 14 software-license columns, Employee
ID/Name, AD Member, Antivirus, etc.) - only re-imported/edited rows will. Until a
CSV re-import fills those in, expect:

- Software & Licenses section: 0% utilization everywhere.
- Security & Compliance section: mostly "No results" (AD Member/User Access/etc. are
  blank on every row) and a Compliance Score of 0.
- "Total Employees" KPI: shows "No results" (no asset has a non-blank Employee ID yet).

Everything else (Location/Department/Make/Model/OS/Status/Warranty/Purchase/Vendor/
Condition) is built from fields that already existed before this session and reflects
real data today.
