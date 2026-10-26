# 2D WMS coverage review

Reviewed 2026-10-26. This records implemented interactions and outstanding enterprise WMS work; it does not claim universal feature completeness.

| Area | Available in this app |
| --- | --- |
| Facility | Saved floor polygons, additional floors, measured SVG overview in feet, grid, pan/zoom/fit, occupancy and hold layers. |
| Storage | Aisle directory, horizontal left/right rack schematics, ordered bays, front elevations and exact level/bin selection. Back/Forward history and adjacent-bay controls. |
| Receiving | Select inbound docks; inspect trucks, schedules, references and cargo. Existing arrival and whole-manifest receipt workflows are accessible from the location panel. |
| Staging | Select lanes and handling records; inspect quantity/status and invoke available putaway/hold/release actions. Quality and returns addresses are selectable within staging. |
| Packing | Select stations; inspect task, SKU, quantity, reference and destination; invoke existing guarded pack/load workflows. |
| Shipping | Select outbound doors; inspect manifests and linked units. Existing load/unload/dispatch guards remain authoritative. Truck symbols show only at-dock/held trucks. |
| Inventory | Address/SKU/item search, photos, editing, transfers, picking, held stock, capacity rules, cycle counts, CSV import/export, external mappings and activity history. |
| Design | Templates, polygon editing, module placement, measured sizes, multiple floors, undo/redo and drafts. Design walkthrough previews use 2D. |
| Automation | Equipment/conveyor footprints, equipment selection, planned routes and saved local-simulation robot positions/status/battery. Existing automation controls remain in the automation panel. This does not control hardware. |

The public example has read-only records. Write buttons appear only in the authenticated workspace. The map uses existing domain/server workflows; it never changes stock independently. Quantities retain their exact units, and manifests are not added to physical stock totals.

## Remaining advanced WMS capabilities

These need additional domain models, APIs and verification, rather than decorative map controls:

- Purchase order/ASN reconciliation, partial receipts, damages/overages/shortages and supplier returns.
- Dock appointment calendars with conflict rules, yard check-in/trailer moves and carrier integrations. Current schedules are manual record fields.
- Directed putaway, replenishment/min-max policies, slotting optimization and cross-dock allocation.
- Sales order allocation/reservation, waves, batch/cluster picking and worker task assignment.
- Physical containers, nested license plates, weight/dimension validation, cartonization, shipping labels and parcel-carrier APIs.
- Dedicated quality disposition and return merchandise workflows. QC/returns locations currently support handling records, not a complete disposition engine.
- Expiry/FEFO, serialized traceability, regulated goods, unit conversion and temperature monitoring. Existing batch/unit fields do not implement these policies.
- Live fleet/conveyor telemetry and control, vendor adapters, labor management, SLA reports, workspace roles and approvals.
- Live SCOTI synchronization, pending supported API documentation and approved authentication/field mappings.

## Primary research

- [Microsoft warehouse management overview](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/warehouse-management-overview): reviewed location, inventory-control and execution categories.
- [Microsoft warehouse configuration](https://learn.microsoft.com/en-gb/dynamics365/supply-chain/warehousing/warehouse-configuration): reviewed warehouse/aisle/rack/shelf/bin navigation.
- [Microsoft packing containers](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/packing-containers): distinguished station tasks from complete containerization.
- [Microsoft cycle counting](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/cycle-counting): reviewed location-specific count coverage.
- [Oracle Warehouse Management Cloud data sheet](https://www.oracle.com/ae-ar/a/ocom/docs/applications/scm/warehouse-management-cloud-ds.pdf): compared receiving, putaway, picking/packing, shipping, yard/appointments and inventory-control categories.

## Verification limits

Automated workflow tests cover tenant isolation, quantities, manifests and capacity. New map tests cover exact addresses, same-number aisles on different floors, hold/occupancy classification and complete indexing for 250 aisles. These do not establish visual quality or client-device performance. Chrome computer-use inspection was blocked by the tool's current-URL verification on this pass; browser/device review remains necessary. The PostgreSQL integration test requires a configured test database.
