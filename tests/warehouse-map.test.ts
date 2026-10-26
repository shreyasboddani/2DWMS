import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeTemplate, defaultConfig, generateLayout } from '../src/domain/warehouse.ts';
import type { OperationalRecord } from '../src/domain/warehouse.ts';
import { indexWarehouseMap, mapBounds } from '../src/domain/warehouseMap.ts';

test('map groups identical aisle numbers by floor and preserves exact addresses', () => {
  const source = generateLayout({ ...defaultConfig, name: 'Map index' });
  const ground = source.locations.find(l => l.zone === 'storage')!;
  const upper = { ...ground, id: 'F2-' + ground.id, floorId: 'F2' };
  const layout = { ...source, locations: [...source.locations, upper] };
  const index = indexWarehouseMap(layout, []);
  assert.equal(index.aisles.length, defaultConfig.aisles + 1);
  assert.deepEqual(index.aisles.find(a => a.floorId === 'F2')!.locations, [upper]);
  assert.equal(index.aisles.flatMap(a => a.locations).length, source.capacity + 1);
  assert.equal(index.aisles.find(a => a.floorId === 'F2')!.bays.get(upper.bay!)![0].id, upper.id);
});

test('occupancy excludes trucks, expected and dispatched records while holds remain visible', () => {
  const layout = generateLayout({ ...defaultConfig, name: 'Status index' });
  const location = layout.locations.find(l => l.zone === 'storage')!;
  const make = (id: string, status: OperationalRecord['status'], kind: OperationalRecord['kind'] = 'Inventory', quantity = 5): OperationalRecord => ({ id, kind, status, quantity, locationId: id, label: id, source: 'Manual', sku: '', reference: '', destination: '', scheduledAt: '', notes: '' });
  const records = [make(location.id, 'On hold'), make('expected', 'Expected', 'Handling unit'), make('dispatched', 'Dispatched', 'Handling unit'), make('truck', 'At dock', 'Truck'), make('zero', 'In storage', 'Inventory', 0)];
  const index = indexWarehouseMap(layout, records);
  assert.deepEqual([...index.occupied], [location.id]);
  assert.equal(index.held.has(location.id), true);
  assert.equal(index.byLocation.get('truck')![0].kind, 'Truck');
  assert.deepEqual([...index.dockedTrucks.keys()], ['truck']);
  assert.equal(index.byLocation.get('expected')!.length, 1);
  assert.equal(records[0].quantity, 5);
});

test('hundreds of aisles retain every bay and map bounds enclose rotated coordinates', () => {
  const config = arrangeTemplate({ ...defaultConfig, name: 'Large map', aisles: 250, bays: 12, autoFitAisles: false });
  const layout = generateLayout(config), index = indexWarehouseMap(layout, []);
  assert.equal(index.aisles.length, 250);
  assert.equal(index.aisles.flatMap(a => a.locations).length, layout.capacity);
  for (const aisle of index.aisles) {
    assert.equal(aisle.bays.size, 12);
    const bounds = mapBounds(aisle.locations);
    assert.ok(aisle.locations.every(l => l.x >= bounds.x && l.x <= bounds.x + bounds.width && l.z >= bounds.z && l.z <= bounds.z + bounds.depth));
  }
  const bounds = mapBounds([{ ...layout.locations[0], x: -20, z: 10 }, { ...layout.locations[0], x: 30, z: 11 }]);
  assert.ok(bounds.width > bounds.depth);
});
