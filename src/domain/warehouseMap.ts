import type { Layout, Location, OperationalRecord } from './warehouse.js';

/** Read-only spatial index. All quantities and statuses remain on canonical records. */
export function indexWarehouseMap(layout: Layout, records: OperationalRecord[]) {
  const byLocation = new Map<string, OperationalRecord[]>();
  const occupied = new Set<string>(), held = new Set<string>();
  const dockedTrucks = new Map<string, OperationalRecord>();
  for (const record of records) {
    const group = byLocation.get(record.locationId) ?? [];
    group.push(record); byLocation.set(record.locationId, group);
    if (record.kind !== 'Truck' && record.quantity > 0 && !['Expected', 'Dispatched'].includes(record.status)) occupied.add(record.locationId);
    if (record.status === 'On hold') held.add(record.locationId);
    if (record.kind === 'Truck' && ['At dock', 'On hold'].includes(record.status)) dockedTrucks.set(record.locationId, record);
  }
  const aisles = new Map<string, { key: string; floorId: string; number: number; locations: Location[]; bays: Map<number, Location[]> }>();
  for (const location of layout.locations) {
    if (location.zone !== 'storage' || location.aisle === undefined) continue;
    const floorId = location.floorId ?? '', key = `${floorId}:${location.aisle}`;
    let aisle = aisles.get(key);
    if (!aisle) { aisle = { key, floorId, number: location.aisle, locations: [], bays: new Map() }; aisles.set(key, aisle); }
    aisle.locations.push(location);
    const bay = location.bay ?? 1, cells = aisle.bays.get(bay) ?? [];
    cells.push(location); aisle.bays.set(bay, cells);
  }
  return { byLocation, occupied, held, dockedTrucks, aisles: [...aisles.values()].sort((a, b) => a.number - b.number) };
}

export function mapBounds(locations: Location[]) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of locations) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  return locations.length ? { x: minX - .7, z: minZ - .7, width: Math.max(1.4, maxX - minX + 1.4), depth: Math.max(1.4, maxZ - minZ + 1.4) } : { x: 0, z: 0, width: 1, depth: 1 };
}
