import type { DesignFloor } from './design.js';

/** A group is scoped to one floor. Selecting any member selects its complete group. */
export function groupedSelection(floor: DesignFloor, ids: string[]): string[] {
  const selected = new Set(ids);
  const groups = new Set(floor.modules.filter(m => selected.has(m.id) && m.groupId).map(m => m.groupId));
  return floor.modules.filter(m => selected.has(m.id) || (!!m.groupId && groups.has(m.groupId))).map(m => m.id);
}

export function groupModules(floor: DesignFloor, ids: string[], groupId: string): DesignFloor {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(groupId)) throw new Error('Invalid group identifier.');
  const selection = new Set(groupedSelection(floor, ids));
  if (selection.size < 2) throw new Error('Select at least two aisles or pieces of equipment to group.');
  return { ...floor, modules: floor.modules.map(m => selection.has(m.id) ? { ...m, groupId } : m) };
}

export function ungroupModules(floor: DesignFloor, ids: string[]): DesignFloor {
  const selection = new Set(groupedSelection(floor, ids));
  return { ...floor, modules: floor.modules.map(m => selection.has(m.id) ? { ...m, groupId: undefined } : m) };
}

export function moveModules(floor: DesignFloor, ids: string[], dx: number, dz: number): DesignFloor {
  if (![dx, dz].every(Number.isFinite)) throw new Error('Movement must be a finite distance.');
  const selection = new Set(groupedSelection(floor, ids));
  return { ...floor, modules: floor.modules.map(m => selection.has(m.id) ? {
    ...m, x: m.x + dx, z: m.z + dz,
    route: m.route.map(p => ({ x: p.x + dx, z: p.z + dz })),
  } : m) };
}

export function rotateModules(floor: DesignFloor, ids: string[]): DesignFloor {
  const selection = new Set(groupedSelection(floor, ids));
  const modules = floor.modules.filter(m => selection.has(m.id));
  if (!modules.length) return floor;
  const x = modules.reduce((sum, m) => sum + m.x, 0) / modules.length;
  const z = modules.reduce((sum, m) => sum + m.z, 0) / modules.length;
  const rotate = (p: { x: number; z: number }) => ({ x: x - (p.z - z), z: z + (p.x - x) });
  return { ...floor, modules: floor.modules.map(m => selection.has(m.id) ? {
    ...m, ...rotate(m), rotation: ((m.rotation + 90) % 360) as 0 | 90 | 180 | 270,
    route: m.route.map(rotate),
  } : m) };
}
