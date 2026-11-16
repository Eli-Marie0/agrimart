# AgriMart — System Design Artifacts

Diagrams and wireframes required by `FINAL PROJECT REQUIREMENTS (2).docx`
(System Design and Required Documentation sections). Everything here is generated
from source scripts, so the figures can be corrected and rebuilt at any time.

## What is here

| File | Content | Required by |
| --- | --- | --- |
| `use-case-diagram.svg` / `png/use-case-diagram.png` | Actors, system boundary, use cases, external services | Use Case Diagram |
| `er-diagram.svg` / `png/er-diagram.png` | 12 tables, keys, 1:M relationships | ER Diagram |
| `context-diagram.svg` / `png/context-diagram.png` | System as one process + external entities | Context Diagram |
| `architecture-diagram.svg` / `png/architecture-diagram.png` | Three-tier architecture with CMS and integrations | Architecture Diagram |
| `wireframes/01-home.svg` …`09-admin-dashboard.svg` | Nine page wireframes | Wireframes |
| `png/wireframes-*.png` | 2× PNG export of each wireframe | Word embedding |
| `preview.html` | All figures on one page, print to PDF | Submission pack |
| `INTEGRATIONS.md` | Setup and verification for Google Maps, PayMongo and SMTP email | Integration appendix |

Wireframes cover: home, products, product detail, cart & checkout, sign up / log in,
my account, announcements, contact / store locator, admin dashboard.

## Regenerating

The generators are plain Node ESM scripts with no build step.

```powershell
cd C:\laragon\www\agrimart
node docs/generate-uml.mjs        # 4 diagrams  -> docs/*.svg
node docs/generate-wireframes.mjs # 9 wireframes -> docs/wireframes/*.svg
node docs/export-png.mjs          # all SVG -> docs/png/*.png (2x)
```

`export-png.mjs` uses the `sharp` copy already installed in
`agrimart-api/node_modules`, so nothing extra needs to be installed.

- `docs/lib.mjs` holds the shared SVG helpers and the AgriMart palette
  (ivory `#F3F7EC`, ink `#10281A`, forest `#16402A`, lime `#9BD84A`, hairlines).
- Diagram scripts are `docs/generate-uml.mjs` and `docs/generate-wireframes.mjs`.
- `preview.html` simply embeds the SVGs; open it in a browser and print to PDF.

## Inserting into the project documentation

1. Open `AgriMart – Agricultural Supply Store Web Application Project Documentation.docx`.
2. Replace the "Textual Specification" placeholders in the System Design section:
   - Use Case Diagram → `docs/png/use-case-diagram.png`
   - ER Diagram → `docs/png/er-diagram.png`
   - Context Diagram → `docs/png/context-diagram.png`
   - Architecture Diagram → `docs/png/architecture-diagram.png`
   - Wireframes → `docs/png/wireframes-*.png`
3. Use *Insert → Pictures → This Device*, set the width to the page text width
   (about 6.5 in / 16.5 cm) and add the figure caption below each image.
4. Keep the SVG files as the editable masters; PNGs are only for embedding.

## Notes on content

- The ER diagram matches the Strapi content types in `agrimart-api/src/api/*/content-types`
  plus the `users-permissions` user and role tables.
- The architecture diagram reflects the actual stack: Next.js 16 / React 19 front end,
  Strapi 5 REST API with JWT and role checks, MySQL (`agrimart_db`), PayMongo,
  SMTP email and Google Maps.
- Wireframes follow the design system: 0 radius, hairlines, one lime primary action
  per screen, 44 px controls and stock text/number/meter blocks instead of icons.
