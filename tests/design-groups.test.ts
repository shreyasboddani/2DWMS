import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, generateLayout, configSchema } from '../src/domain/warehouse.ts';
import type { DesignFloor } from '../src/domain/design.ts';
import { designFromLayout } from '../src/domain/design.ts';
import { groupedSelection, groupModules, ungroupModules, moveModules, rotateModules } from '../src/domain/designGroups.ts';

function fixture() {
  const config = { ...defaultConfig, name: 'Grouping verification' };
  return { config, design: designFromLayout(config, generateLayout(config)) };
}
test('groups survive schema validation and move together without changing logical addresses', () => {
  const { config, design } = fixture(), floor = design.floors[0];
  const aisles = floor.modules.filter(m => m.kind === 'aisle').slice(0, 2).map(m => m.id);
  const grouped = groupModules(floor, aisles, 'test-group');
  assert.deepEqual(groupedSelection(grouped, [aisles[0]]), aisles);
  const moved = moveModules(grouped, [aisles[0]], 1.5, 2);
  for (const id of aisles) {
    assert.equal(moved.modules.find(m => m.id === id)!.x, floor.modules.find(m => m.id === id)!.x + 1.5);
    assert.equal(moved.modules.find(m => m.id === id)!.z, floor.modules.find(m => m.id === id)!.z + 2);
  }
  const saved = configSchema.parse({ ...config, design: { ...design, floors: [moved] } });
  assert.equal(saved.design!.floors[0].modules.find(m => m.id === aisles[0])!.groupId, 'test-group');
  const before = generateLayout({ ...config, design }).locations.map(l => l.id).sort();
  assert.deepEqual(generateLayout(saved).locations.map(l => l.id).sort(), before);
  assert.throws(() => moveModules(grouped, aisles, Infinity, 0), /finite/);
});
test('groups merge completely, ungroup completely, and leave other modules untouched', () => {
  const { design } = fixture(), floor = design.floors[0], ids = floor.modules.slice(0, 3).map(m => m.id);
  const grouped = groupModules(floor, ids.slice(0, 2), 'original');
  const merged = groupModules(grouped, [ids[1], ids[2]], 'merged');
  assert.equal(groupedSelection(merged, [ids[2]]).length, 3);
  const cleared = ungroupModules(merged, [ids[0]]);
  assert.ok(cleared.modules.every(m => !m.groupId));
  assert.deepEqual(cleared.modules.slice(3), floor.modules.slice(3));
  assert.throws(() => groupModules(floor, [ids[0]], 'invalid-single'), /at least two/);
});
test('rotation preserves group spacing and robot routes follow group transforms', () => {
  const { design } = fixture();
  const floor: DesignFloor = { ...design.floors[0], modules: design.floors[0].modules.slice(0, 2).map((m, i) => ({ ...m, groupId: 'robot-group', route: [{ x: m.x + i, z: m.z + 1 }] })) };
  const rotated = rotateModules(floor, [floor.modules[0].id]);
  const distance = (f: DesignFloor) => Math.hypot(f.modules[0].x - f.modules[1].x, f.modules[0].z - f.modules[1].z);
  assert.ok(Math.abs(distance(rotated) - distance(floor)) < 1e-8);
  const moved = moveModules(rotated, [rotated.modules[0].id], 3, 4);
  assert.equal(moved.modules[1].route[0].x, rotated.modules[1].route[0].x + 3);
  assert.equal(moved.modules[1].route[0].z, rotated.modules[1].route[0].z + 4);
  let fullTurn = floor;
  for (let i = 0; i < 4; i++) fullTurn = rotateModules(fullTurn, [floor.modules[0].id]);
  assert.ok(fullTurn.modules.every((m,i) => Math.abs(m.x-floor.modules[i].x) < 1e-8 && Math.abs(m.z-floor.modules[i].z) < 1e-8));
});
