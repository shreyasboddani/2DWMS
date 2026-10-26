import { useDeferredValue, useId, useMemo, useRef, useState } from 'react';
import { generateLayout, zones } from '../domain/warehouse';
import type { Location, OperationalRecord, WarehouseConfig, Zone } from '../domain/warehouse';
import { indexWarehouseMap, mapBounds } from '../domain/warehouseMap';
import { dockPose } from '../domain/facility';
import { formatFeet } from '../domain/units';
import { moduleSize, equipmentCatalog } from '../domain/design';
import type { AutomationState } from '../domain/automation';
import { availableOperations } from '../domain/operations';
import type { Operation } from '../domain/operations';
import { StationPopup } from './StationPopup';
import { ProductPhoto } from './InventoryExplorer';
import { Icon } from './ui';
import '../styles/warehouse-map.css';

type MapPath = { floorId: string; aisleKey: string | null; bay: number | null };
const samePath = (a: MapPath, b: MapPath) => a.floorId === b.floorId && a.aisleKey === b.aisleKey && a.bay === b.bay;
const number = (n: number) => String(n).padStart(2, '0');

type WarehouseMapProps = {
  config: WarehouseConfig; records?: OperationalRecord[]; selected?: string;
  onSelect?: (id: string) => void; focus?: Zone | 'all'; initialFloorId?: string;
  automation?: AutomationState;
  onOpenStudio?: () => void;
  onOperation?: (record: OperationalRecord, type: Operation["type"]) => void;
  onAddRecord?: (location: Location) => void;
  onEditRecord?: (location: Location, record: OperationalRecord) => void;
};
export function Warehouse2D(props: WarehouseMapProps) {
  const [localSelected, setLocalSelected] = useState('');
  const selected = props.selected ?? localSelected;
  return <WarehouseMap {...props} selected={selected} onSelect={props.onSelect ?? setLocalSelected} />;
}
function WarehouseMap({ config, records = [], selected = '', onSelect, focus = 'all', initialFloorId, automation, onOperation, onAddRecord, onEditRecord, onOpenStudio }: WarehouseMapProps) {
  const layout = useMemo(() => generateLayout(config), [config]);
  const index = useMemo(() => indexWarehouseMap(layout, records), [layout, records]);
  const floors = config.design?.floors;
  const selectedLocation = useMemo(() => layout.locations.find(l => l.id === selected), [layout, selected]);
  const initialSelection = selectedLocation && (focus === 'all' || focus === selectedLocation.zone) ? selectedLocation : undefined;
  const initialPath: MapPath = {
    floorId: initialSelection?.floorId ?? initialFloorId ?? floors?.[0]?.id ?? '',
    aisleKey: initialSelection?.aisle !== undefined ? `${initialSelection.floorId ?? ''}:${initialSelection.aisle}` : null,
    bay: initialSelection?.aisle !== undefined ? initialSelection.bay ?? 1 : null,
  };
  const [history, setHistory] = useState({ paths: [initialPath], cursor: 0, selection: selected, focus });
  const path = history.paths[history.cursor];
  if (history.selection !== selected || history.focus !== focus) {
    const next: MapPath = history.selection !== selected && selectedLocation
      ? { floorId: selectedLocation.floorId ?? '', aisleKey: selectedLocation.aisle !== undefined ? `${selectedLocation.floorId ?? ''}:${selectedLocation.aisle}` : null, bay: selectedLocation.aisle !== undefined ? selectedLocation.bay ?? 1 : null }
      : history.focus !== focus ? { floorId: path.floorId, aisleKey: null, bay: null } : path;
    const changed = !samePath(path, next);
    setHistory({ paths: changed ? [...history.paths.slice(0, history.cursor + 1), next] : history.paths, cursor: changed ? history.cursor + 1 : history.cursor, selection: selected, focus });
  }
  const { floorId, aisleKey, bay } = path;
  const navigate = (next: MapPath) => setHistory(h => samePath(h.paths[h.cursor], next) ? h : { ...h, paths: [...h.paths.slice(0, h.cursor + 1), next], cursor: h.cursor + 1 });
  const [equipmentId, setEquipmentId] = useState('');
  const [stationId, setStationId] = useState('');
  const popupLocation = layout.locations.find(l => l.id === stationId);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [layer, setLayer] = useState<'occupancy' | 'holds'>('occupancy');
  const [zoom, setZoom] = useState(1), [pan, setPan] = useState({ x: 0, z: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panZ: number } | null>(null);
  const gridId = useId().replaceAll(':', '');
  const floor = floors?.find(f => f.id === floorId) ?? floors?.[0];
  const visibleLocations = useMemo(() => layout.locations.filter(l => (l.floorId ?? '') === (floor?.id ?? '')), [layout, floor]);
  const aisles = index.aisles.filter(a => a.floorId === (floor?.id ?? ''));
  const aisle = index.aisles.find(a => a.key === aisleKey);
  const bayLocations = bay !== null ? aisle?.bays.get(bay) ?? [] : [];
  const sides = [...new Set(bayLocations.map(l => l.side ?? 'Rack'))];
  const levels = [...new Set(bayLocations.map(l => l.level ?? 1))].sort((a, b) => b - a);
  const visibleIds = new Set(visibleLocations.map(l => l.id));
  const equipment = floor?.modules.find(m => m.id === equipmentId);
  const robotState = automation?.robots.find(r => r.id === equipmentId);
  const visibleStock = visibleLocations.filter(l => l.zone === 'storage');
  const occupiedCount = visibleStock.filter(l => index.occupied.has(l.id)).length;
  const occupancy = visibleStock.length ? Math.round(occupiedCount / visibleStock.length * 100) : 0;
  const activeLocations = visibleLocations.filter(l => l.zone !== 'storage' && (focus === 'all' || l.zone === focus));
  const results = useMemo(() => {
    const words = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const found: Location[] = [];
    for (const l of layout.locations) {
      const text = [l.code, l.label, ...(index.byLocation.get(l.id) ?? []).flatMap(r => [r.label, r.sku, r.reference, r.id])].join(' ').toLowerCase();
      if (words.every(w => text.includes(w))) found.push(l);
      if (found.length === 15) break;
    }
    return found;
  }, [deferredQuery, layout, index]);
  const bounds = aisle ? mapBounds(aisle.locations) : { x: -config.width / 2, z: -config.depth / 2, width: config.width, depth: config.depth };
  const margin = aisle ? 2 : Math.max(7, Math.min(config.width, config.depth) * .12);
  const viewWidth = (bounds.width + margin * 2) / zoom, viewDepth = (bounds.depth + margin * 2) / zoom;
  const viewX = bounds.x + bounds.width / 2 - viewWidth / 2 + pan.x, viewZ = bounds.z + bounds.depth / 2 - viewDepth / 2 + pan.z;
  const labelSize = Math.max(.6, Math.min(config.width, config.depth) / 50);
  const resetCamera = () => { setZoom(1); setPan({ x: 0, z: 0 }); };
  const openAisle = (key: string) => { navigate({ floorId, aisleKey: key, bay: null }); resetCamera(); };
  const overview = () => { navigate({ floorId, aisleKey: null, bay: null }); resetCamera(); };
  const chooseLocation = (id: string) => {
    const location = layout.locations.find(l => l.id === id);
    if (location) navigate({ floorId: location.floorId ?? '', aisleKey: location.aisle !== undefined ? `${location.floorId ?? ''}:${location.aisle}` : null, bay: location.aisle !== undefined ? location.bay ?? 1 : null });
    if (location && location.zone !== 'storage') setStationId(id);
    onSelect?.(id); setQuery('');
  };
  const status = (l: Location) => index.held.has(l.id) ? 'held' : index.occupied.has(l.id) ? 'occupied' : 'empty';
  const openBay = (n: number) => { navigate({ floorId, aisleKey, bay: n }); resetCamera(); };
  const selectKey = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
  };
  const selectedOnView = selectedLocation && (selectedLocation.floorId ?? '') === (floor?.id ?? '') && (focus === 'all' || focus === selectedLocation.zone) && (!aisle || bayLocations.some(l => l.id === selected));
  const bayNumbers = aisle ? [...aisle.bays.keys()].sort((a,b) => a-b) : [];

  return <section className="map-workspace" aria-label="2D warehouse navigation">
    <div className="map-masthead">
      <div className="map-masthead-title"><span className="map-app-icon"><Icon name="grid" /></span><div><span className="map-kicker">SPATIAL OPERATIONS</span><h2>{bay !== null && aisle ? `Aisle ${number(aisle.number)} / Bay ${number(bay)}` : aisle ? `Aisle ${number(aisle.number)}` : 'Your warehouse, mapped.'}</h2></div></div>
      <div className="map-masthead-actions">{onOpenStudio && <button className="map-open-studio" onClick={onOpenStudio}><Icon name="grid" />Design studio<span>Group & arrange</span></button>}<span className="map-mode-badge"><span />2D workspace</span></div>
    </div>
    <div className="map-metrics">
      <div><span>STORAGE POSITIONS</span><strong>{visibleStock.length.toLocaleString()}</strong><small>{aisles.length} aisles on this floor</small></div>
      <div><span>OCCUPIED</span><strong>{occupancy}<em>%</em></strong><small>{occupiedCount.toLocaleString()} mapped positions</small></div>
      <div><span>DOCK ACTIVITY</span><strong>{[...index.dockedTrucks.keys()].filter(id => visibleIds.has(id)).length}</strong><small>Docked or held trucks</small></div>
      <div><span>REQUIRES ATTENTION</span><strong className={visibleLocations.some(l => index.held.has(l.id)) ? 'map-amber' : ''}>{visibleLocations.filter(l => index.held.has(l.id)).length}</strong><small>Locations with held records</small></div>
    </div>
    <div className="map-toolbar">
      <div className="map-history" aria-label="Map history"><button aria-label="Go back in warehouse navigation" disabled={history.cursor === 0} onClick={() => { setHistory(h => ({ ...h, cursor: Math.max(0, h.cursor - 1) })); resetCamera(); }}>&#8592;<span>Back</span></button><button aria-label="Go forward in warehouse navigation" disabled={history.cursor >= history.paths.length - 1} onClick={() => { setHistory(h => ({ ...h, cursor: Math.min(h.paths.length - 1, h.cursor + 1) })); resetCamera(); }}><span>Forward</span>&#8594;</button></div>
      <nav className="map-breadcrumb" aria-label="Warehouse navigation"><button onClick={overview}><Icon name="grid" />Layout</button>{aisle && <><span>/</span><button onClick={() => { navigate({ floorId, aisleKey, bay: null }); resetCamera(); }}>Aisle {number(aisle.number)}</button></>}{bay !== null && <><span>/</span><strong>Bay {number(bay)}</strong></>}</nav>
      <div className="map-search-wrap"><label className="map-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="m12 12 5 5" /></svg><input aria-label="Search warehouse addresses and inventory" placeholder="Find an address, SKU or item..." type="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setQuery(''); if (e.key === 'Enter' && results[0]) chooseLocation(results[0].id); }} /></label>
        {query.trim() && <div className="map-search-results">{results.length ? results.map(l => <button key={l.id} onClick={() => chooseLocation(l.id)}><code>{l.code}</code><span>{l.label}</span><small>{index.byLocation.get(l.id)?.length ?? 0} records</small></button>) : <p>No matching locations or items.</p>}<small>Up to 15 matches. Enter a complete address for an exact match.</small></div>}
      </div>
    </div>
    {floors && <div className="map-floor-tabs" aria-label="Warehouse floors">{floors.map((f, i) => <button key={f.id} className={f.id === floor?.id ? 'active' : ''} onClick={() => { navigate({ floorId: f.id, aisleKey: null, bay: null }); resetCamera(); }}>Floor {i + 1}<small>{f.name}</small></button>)}</div>}
    <div className="map-body">
      <aside className="map-directory">
        <div className="map-directory-heading"><span>{aisle ? 'BAY DIRECTORY' : 'AISLE DIRECTORY'}</span><small>{aisle ? aisle.bays.size : aisles.length}</small></div>
        <p>{aisle ? 'Choose a bay to inspect the rack.' : 'Choose an aisle to explore.'}</p>
        <div className="map-directory-list">{aisle ? [...aisle.bays].sort(([a], [b]) => a - b).map(([n, locations]) => {
          const used = locations.filter(l => index.occupied.has(l.id)).length;
          return <button key={n} className={bay === n ? 'active' : ''} onClick={() => openBay(n)}><span className="map-directory-number">{number(n)}</span><span><strong>Bay {number(n)}</strong><small>{used} / {locations.length} occupied</small></span><span className="map-chevron">›</span></button>;
        }) : aisles.map(a => {
          const used = a.locations.filter(l => index.occupied.has(l.id)).length;
          return <button key={a.key} onClick={() => openAisle(a.key)}><span className="map-directory-number">{number(a.number)}</span><span><strong>Aisle {number(a.number)}</strong><small>{a.bays.size} bays · {used} occupied</small><i className="map-mini-meter"><i style={{ width: `${used / a.locations.length * 100}%` }} /></i></span><span className="map-chevron">›</span></button>;
        })}{!aisles.length && <p>No storage aisles on this floor. Select a work area on the plan.</p>}</div>
        <div className="map-directory-note"><Icon name="link" /><span>Every position links to its inventory and available workflows.</span></div>
      </aside>
      <div className="map-main">
        <div className="map-canvas-heading"><div><span className="map-kicker">{bay !== null ? 'RACK ELEVATION' : aisle ? 'HORIZONTAL AISLE SCHEMATIC' : 'MEASURED FLOOR PLAN'}</span><strong>{bay !== null ? 'Every level. Every position.' : aisle ? 'Select a numbered bay' : focus === 'all' ? 'Facility overview' : zones.find(z => z.id === focus)?.name}</strong></div><div className="map-layer-switch" aria-label="Map color layer"><button className={layer === 'occupancy' ? 'active' : ''} onClick={() => setLayer('occupancy')}>Occupancy</button><button className={layer === 'holds' ? 'active' : ''} onClick={() => setLayer('holds')}>Holds</button></div></div>
        {bay === null && aisle ? <div className="map-aisle-explorer">
          <div className="map-aisle-intro"><span className="map-orientation-badge">BAYS LEFT TO RIGHT</span><p>Both rack faces are shown below. Choose any bay to inspect its levels and positions.</p></div>
          <div className="map-horizontal-scroll" tabIndex={0} aria-label="Horizontal aisle rack schematic">
            {['L', 'walkway', 'R'].map(side => side === 'walkway' ? <div className="map-walkway" key={side}><span>AISLE {number(aisle.number)} / TRAVEL LANE</span><small>Travel aisle / schematic view</small></div> : <section className="map-horizontal-face" key={side}><h3>{side === 'L' ? 'LEFT RACK FACE' : 'RIGHT RACK FACE'}</h3><div className="map-horizontal-bays" style={{ gridTemplateColumns: `repeat(${aisle.bays.size}, minmax(128px, 1fr))` }}>{[...aisle.bays].sort(([a], [b]) => a - b).map(([n, locations]) => {
              const cells = locations.filter(l => (l.side ?? 'L') === side), used = cells.filter(l => index.occupied.has(l.id)).length, holds = cells.some(l => index.held.has(l.id));
              const sampleLevels = [...new Set(cells.map(l => l.level ?? 1))].sort((a, b) => b - a).slice(0, 4);
              return <button className={`map-horizontal-bay ${holds ? 'has-hold' : ''}`} key={n} onClick={() => openBay(n)} aria-label={`Open bay ${n}, ${side === 'L' ? 'left' : 'right'} rack`}><span className="map-bay-label">BAY <strong>{number(n)}</strong><span aria-hidden="true">&#8599;</span></span><span className="map-bay-shelf-art">{sampleLevels.map(level => <span className="map-bay-shelf" key={level}>{cells.filter(l => (l.level ?? 1) === level).slice(0, 8).map(l => <i key={l.id} className={status(l)} />)}</span>)}</span><span className="map-bay-occupancy">{used} / {cells.length} occupied</span><span className="map-bay-meter"><i style={{ width: `${cells.length ? used / cells.length * 100 : 0}%` }} /></span></button>;
            })}</div></section>)}
          </div><p className="map-aisle-footnote">Schematic orientation for easy reading. The facility overview preserves the actual rack placement and dimensions.</p>
        </div> : bay === null ? <div className="map-canvas">
          <svg ref={svgRef} className="map-plan" role="group" aria-label={aisle ? `Aisle ${aisle.number} bay plan` : 'Top-down warehouse floor plan'} viewBox={`${viewX} ${viewZ} ${viewWidth} ${viewDepth}`} onPointerDown={e => {
            if ((e.target as Element).closest('[data-map-target]')) return;
            drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panZ: pan.z }; e.currentTarget.setPointerCapture(e.pointerId);
          }} onPointerMove={e => {
            if (!drag.current || !svgRef.current) return;
            const box = svgRef.current.getBoundingClientRect(), scale = Math.min(box.width / viewWidth, box.height / viewDepth);
            setPan({ x: drag.current.panX - (e.clientX - drag.current.x) / scale, z: drag.current.panZ - (e.clientY - drag.current.y) / scale });
          }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            <defs><pattern id={gridId} width="1.524" height="1.524" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".035" fill="#b9cbd9" /></pattern></defs>
            <rect x={viewX} y={viewZ} width={viewWidth} height={viewDepth} fill={`url(#${gridId})`} />
            {floor ? <polygon points={floor.outline.map(p => `${p.x},${p.z}`).join(' ')} className="map-building" /> : <rect x={-config.width / 2} y={-config.depth / 2} width={config.width} height={config.depth} rx=".35" className="map-building" />}
            {!aisle && <>
              <path d={`M${-config.width / 2} ${-config.depth / 2 - margin * .45}h${config.width}`} className="map-dimension-line" /><text x="0" y={-config.depth / 2 - margin * .6} textAnchor="middle" fontSize={labelSize} className="map-dimension">{formatFeet(config.width)} ft overall</text>
              <text x={config.width / 2 + margin * .4} y="0" textAnchor="middle" fontSize={labelSize} transform={`rotate(90 ${config.width / 2 + margin * .4} 0)`} className="map-dimension">{formatFeet(config.depth)} ft overall</text>
            </>}
            {floor?.modules.filter(m => m.route.length > 1).map(m => <polyline key={`route-${m.id}`} points={m.route.map(p => `${p.x},${p.z}`).join(' ')} fill="none" stroke="#6f9ec1" strokeDasharray=".35 .25" strokeWidth=".1"><title>{m.label}: planned route, not live telemetry</title></polyline>)}
            {floor?.modules.filter(m => m.kind !== 'aisle').map(m => {
              const size = moduleSize(m), color = equipmentCatalog.find(e => e.id === m.kind)?.color ?? '#6a8aab';
              const robot = automation?.robots.find(r => r.id === m.id);
              return <g key={m.id} data-map-target role="button" tabIndex={0} aria-label={`Inspect equipment ${m.label}`} className="map-equipment" onClick={() => { const location = visibleLocations.find(l => l.moduleId === m.id); if (location) chooseLocation(location.id); else setEquipmentId(m.id); }} onKeyDown={e => selectKey(e, () => { const location = visibleLocations.find(l => l.moduleId === m.id); if (location) chooseLocation(location.id); else setEquipmentId(m.id); })} transform={`translate(${robot?.x ?? m.x} ${robot?.z ?? m.z}) rotate(${robot ? robot.heading * 180 / Math.PI : m.rotation})`} opacity={focus === 'all' ? 1 : .6}>
                <rect x={-size.width / 2} y={-size.depth / 2} width={size.width} height={size.depth} rx=".15" fill={color} fillOpacity={m.kind === 'area' ? .06 : .22} stroke={equipmentId === m.id ? '#276dd0' : color} strokeWidth={equipmentId === m.id ? '.2' : '.07'} />
                {['belt', 'roller', 'sorter'].includes(m.kind) && <path d={`M0 ${-size.depth * .35}v${size.depth * .7}m-.2-.3.2.3.2-.3`} stroke={color} strokeWidth=".08" fill="none" />}
                {robot && <circle r=".16" fill={robot.status === 'Running' ? '#12a08b' : '#d5a74e'} />}
                <title>{m.label}{robot ? `: ${robot.status}, ${Math.round(robot.battery)}% battery (local simulation)` : ''}</title>
              </g>;
            })}
            {layout.racks.filter(r => (r.floorId ?? '') === (floor?.id ?? '') && (!aisle || r.aisle === aisle.number)).map((rack, i) => <g key={i} transform={`translate(${rack.x} ${rack.z}) rotate(${rack.rotation ?? 0})`}><rect x="-.6" y={-rack.length / 2} width="1.2" height={rack.length} rx=".08" fill="#d8e2ed" stroke="#8ca5c0" strokeWidth=".06" />{Array.from({ length: Math.min(rack.bays ?? config.bays, 100) }, (_, b) => <path key={b} d={`M-.6 ${-rack.length / 2 + b * rack.length / (rack.bays ?? config.bays)}h1.2`} stroke="#a9bacc" strokeWidth=".04" />)}</g>)}
            {(aisle ? [...aisle.bays].map(([n, locs]) => ({ key: String(n), number: n, locations: locs })) : aisles.map(a => ({ key: a.key, number: a.number, locations: a.locations }))).map(item => {
              const b = mapBounds(item.locations), used = item.locations.filter(l => index.occupied.has(l.id)).length, holds = item.locations.some(l => index.held.has(l.id));
              return <g key={item.key} data-map-target role="button" tabIndex={0} aria-label={aisle ? `Open bay ${item.number}` : `Open aisle ${item.number}`} className={`map-aisle-target ${holds && layer === 'holds' ? 'has-hold' : ''}`} opacity={focus !== 'all' && focus !== 'storage' ? .3 : 1} onClick={() => aisle ? openBay(item.number) : openAisle(item.key)} onKeyDown={e => selectKey(e, () => aisle ? openBay(item.number) : openAisle(item.key))}>
                <rect x={b.x} y={b.z} width={b.width} height={b.depth} rx=".25" fill={layer === 'holds' ? holds ? '#f2bc5b' : '#dae6ee' : used ? '#90d5cc' : '#b6cadf'} fillOpacity=".25" stroke={holds && layer === 'holds' ? '#c68622' : '#6d91b6'} strokeWidth=".06" />
                <rect x={b.x + b.width / 2 - .7} y={b.z + b.depth / 2 - .5} width="1.4" height="1" rx=".22" className="map-aisle-sign" /><text x={b.x + b.width / 2} y={b.z + b.depth / 2 + .16} textAnchor="middle" fontSize=".46" fontWeight="700" fill="#fff">{number(item.number)}</text><title>{aisle ? 'Bay' : 'Aisle'} {item.number}: {used} of {item.locations.length} positions occupied</title>
              </g>;
            })}
            {!aisle && activeLocations.map(l => {
              const truck = index.dockedTrucks.get(l.id);
              const dockModule = floor?.modules.find(m => m.id === l.moduleId);
              const pose = dockPose(l, config);
              const truckX = dockModule?.x ?? pose.x, truckZ = dockModule?.z ?? pose.z;
              const truckAngle = dockModule?.rotation ?? -pose.rotation * 180 / Math.PI;
              return <g key={l.id} data-map-target role="button" tabIndex={0} aria-label={`Inspect ${l.code}`} className={`map-workpoint ${selected === l.id ? 'selected' : ''}`} onClick={() => chooseLocation(l.id)} onKeyDown={e => selectKey(e, () => chooseLocation(l.id))}>
                <rect x={l.x - 1.5} y={l.z - 1.2} width="3" height="2.4" fill="transparent" />
                <rect x={l.x - .7} y={l.z - .55} width="1.4" height="1.1" rx=".15" fill={index.held.has(l.id) ? '#dba049' : zones.find(z => z.id === l.zone)?.color} /><text x={l.x} y={l.z + 1.25} textAnchor="middle" fontSize={labelSize * .65} fill="#3e5874">{l.code.match(/(?:IN|OUT|STG|PACK|QC|RET)-[0-9]+$/)?.[0] || l.code}</text>
                {truck && <g transform={`translate(${truckX} ${truckZ}) rotate(${truckAngle})`}><g transform={`translate(0 ${dockModule ? -dockModule.depth / 2 : 0})`}><rect x="-.65" y="-3.7" width="1.3" height="3.7" rx=".12" fill="#e4edf6" stroke="#6d89a7" strokeWidth=".08" /><path d="M-.48-3.4v3.1M.48-3.4v3.1M-.6-.15H.6" stroke="#bdcddf" strokeWidth=".06" /><rect x="-.65" y="-4.7" width="1.3" height=".85" rx=".18" fill="#264b78" /><path d="M-.43-4.45h.86" stroke="#a4d1e6" strokeWidth=".22" /><path d="M-.75-4.3v.45M.75-4.3v.45M-.75-.8v.45M.75-.8v.45" stroke="#53667c" strokeWidth=".2" /></g></g>}
                <title>{l.code}: {index.byLocation.get(l.id)?.map(r => `${r.label} (${r.status})`).join(', ') || 'No records assigned'}</title>
              </g>;
            })}
          </svg>
          <div className="map-compass" aria-label="Plan orientation"><span>TOP</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 6 17-6-4-6 4Z" fill="currentColor" /></svg></div>
          <div className="map-zoom"><button aria-label="Zoom out" disabled={zoom <= .5} onClick={() => setZoom(z => Math.max(.5, z / 1.3))}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" disabled={zoom >= 12} onClick={() => setZoom(z => Math.min(12, z * 1.3))}>+</button><button className="map-fit" onClick={resetCamera}>Fit</button></div>
          <span className="map-canvas-note">Drag empty space to pan · Grid: 5 ft</span>
        </div> : <div className="map-elevation" aria-label={`Rack positions in aisle ${aisle?.number}, bay ${bay}`}>
          <div className="map-bay-pager"><button disabled={!aisle || bay === bayNumbers[0]} onClick={() => { const list = [...aisle!.bays.keys()].sort((a,b) => a-b), i = list.indexOf(bay!); if (i > 0) openBay(list[i - 1]); }}>Previous bay</button><span>Bay {number(bay!)} of {aisle?.bays.size}</span><button disabled={!aisle || bay === bayNumbers[bayNumbers.length - 1]} onClick={() => { const list = [...aisle!.bays.keys()].sort((a,b) => a-b), i = list.indexOf(bay!); if (i < list.length - 1) openBay(list[i + 1]); }}>Next bay</button></div><div className="map-elevation-note"><span className="map-orientation-badge">FRONT ELEVATION</span><p>Select a position to open its inventory, photos and available actions.</p></div>
          <div className="map-rack-faces">{sides.map(side => <section className="map-rack" key={side}><div className="map-rack-title"><span>{side === 'L' ? 'Left rack' : side === 'R' ? 'Right rack' : side}</span><code>A{number(aisle?.number ?? 0)} · B{number(bay)}</code></div>
            {levels.map(level => <div className="map-rack-level" key={level}><span className="map-level-label">L{number(level)}</span><div className="map-rack-cells">{bayLocations.filter(l => (l.side ?? 'Rack') === side && (l.level ?? 1) === level).sort((a, b) => (a.bin ?? 0) - (b.bin ?? 0)).map(l => {
              const stock = index.byLocation.get(l.id) ?? [], first = stock.find(r => r.quantity > 0), state = status(l);
              return <button className={`map-bin ${state} ${selected === l.id ? 'selected' : ''} ${layer === 'holds' ? 'holds-layer' : ''}`} key={l.id} onClick={() => chooseLocation(l.id)} aria-label={`${l.code}, ${state}`} aria-pressed={selected === l.id} title={l.code}><span className="map-bin-number">POSITION {number(l.bin ?? 1)}</span><span className="map-bin-art">{state !== 'empty' ? <svg viewBox="0 0 72 48" aria-hidden="true"><rect x="10" y="6" width="52" height="35" rx="3" /><path d="M30 6v12h12V6M19 31h13M19 35h9" /><rect x="45" y="27" width="10" height="8" rx="1" /></svg> : <span className="map-empty-slot">+</span>}</span><strong>{first?.sku || first?.label || 'Available'}</strong><small>{state === 'held' ? 'On hold' : first ? `${first.quantity.toLocaleString()} ${first.unit || 'units'}${stock.length > 1 ? ` · +${stock.length - 1} records` : ''}` : 'Empty position'}</small></button>;
            })}</div></div>)}<div className="map-rack-feet"><i /><span>{levels.length} levels · {bayLocations.filter(l => (l.side ?? 'Rack') === side).length} positions</span><i /></div></section>)}</div>

        </div>}
        {equipment && <section className="map-equipment-card"><div><span className="map-kicker">{robotState ? 'LOCAL SIMULATION / EQUIPMENT' : 'PLANNED EQUIPMENT'}</span><h3>{equipment.label}</h3><p>{equipmentCatalog.find(e => e.id === equipment.kind)?.name} ? {equipment.task} ? {equipment.route.length} route waypoints</p><small>{robotState ? `${robotState.status} ? ${Math.round(robotState.battery)}% battery ? ${robotState.reason || 'Saved simulation state'}` : `${equipment.sourceId || 'No source configured'} ? ${equipment.targetId || 'No destination configured'}`}</small></div><button aria-label="Close equipment details" onClick={() => setEquipmentId('')}>?</button></section>}
        <div className="map-legend"><span><i className="occupied" />Occupied</span><span><i className="empty" />Available</span><span><i className="held" />On hold</span><span className="map-legend-note">Saved warehouse data · Lengths in feet</span></div>
        {selectedOnView && !stationId && <LocationDetail location={selectedLocation} records={index.byLocation.get(selected) ?? []} capacity={config.locationRules?.find(r => r.locationId === selected)} onOperation={onOperation} onAdd={onAddRecord} onEdit={onEditRecord} />}
        {!aisle && <div className="map-area-cards">{zones.filter(z => z.id !== 'storage' && (focus === 'all' || z.id === focus)).map(z => {
          const locations = activeLocations.filter(l => l.zone === z.id);
          return <section className="map-area-card" key={z.id}><div><i style={{ background: z.color }} /><strong>{z.name}</strong><small>{locations.length} locations</small></div>{locations.length ? locations.map(l => {
            const group = index.byLocation.get(l.id) ?? [];
            return <button key={l.id} className={selected === l.id ? 'selected' : ''} onClick={() => chooseLocation(l.id)}><code>{l.code}</code><span>{group[0]?.label || 'No records assigned'}<small>{group[0]?.status || 'Available'}{group.length > 1 ? ` · +${group.length - 1} records` : ''}</small></span><span className="map-chevron">›</span></button>;
          }) : <p>No {z.name.toLowerCase()} locations on this floor.</p>}</section>;
        })}</div>}
      </div>
    </div>
    {popupLocation && <StationPopup location={popupLocation} records={index.byLocation.get(popupLocation.id) ?? []} onClose={() => setStationId('')}>
      <LocationDetail location={popupLocation} records={index.byLocation.get(popupLocation.id) ?? []} capacity={config.locationRules?.find(r => r.locationId === popupLocation.id)}
        onOperation={onOperation ? (record, type) => { setStationId(''); onOperation(record, type); } : undefined}
        onAdd={onAddRecord ? location => { setStationId(''); onAddRecord(location); } : undefined}
        onEdit={onEditRecord ? (location, record) => { setStationId(''); onEditRecord(location, record); } : undefined} />
    </StationPopup>}
  </section>;
}

function LocationDetail({ location, records, capacity, onOperation, onAdd, onEdit }: {
  location: Location; records: OperationalRecord[]; capacity?: { capacity: number; unit: string };
  onOperation?: WarehouseMapProps['onOperation']; onAdd?: WarehouseMapProps['onAddRecord']; onEdit?: WarehouseMapProps['onEditRecord'];
}) {
  return <section className="map-position-detail map-location-detail" aria-label={`Details for ${location.code}`}>
    <div className="map-position-detail-heading"><span className="map-app-icon"><Icon name={['inbound','outbound'].includes(location.zone) ? 'arrow' : 'box'} /></span><div><span className="map-kicker">{zones.find(z => z.id === location.zone)?.name.toUpperCase()} / SELECTED LOCATION</span><h3>{location.code}</h3><p>{location.label}{capacity ? ` ? Capacity: ${capacity.capacity.toLocaleString()} ${capacity.unit}` : ''}</p></div>{onAdd && <button className="map-inline-action" onClick={() => onAdd(location)}>+ Add record</button>}</div>
    {records.length ? records.map(record => <article className="map-location-record" key={record.id}>
      <div className="map-stock-row">{record.imageUrl && <ProductPhoto url={record.imageUrl} label={record.label} />}<div><strong>{record.label}</strong><small>{record.sku || record.id} ? {record.status} ? {record.source}</small></div><strong>{record.quantity.toLocaleString()}<small>{record.unit || 'units'}</small></strong></div>
      {(record.reference || record.destination || record.scheduledAt || record.batch) && <dl className="map-record-meta">{record.reference && <div><dt>Reference</dt><dd>{record.reference}</dd></div>}{record.destination && <div><dt>Destination</dt><dd>{record.destination}</dd></div>}{record.scheduledAt && <div><dt>Scheduled</dt><dd>{new Date(record.scheduledAt).toLocaleString()}</dd></div>}{record.batch && <div><dt>Batch</dt><dd>{record.batch}</dd></div>}</dl>}
      {!!record.cargo?.length && <div className="map-cargo"><span className="map-kicker">CARGO MANIFEST / {record.cargo.length} LINES</span>{record.cargo.map(c => <div key={c.id}><code>{c.id}</code><span>{c.sku}</span><strong>{c.quantity.toLocaleString()} units</strong></div>)}</div>}
      {record.notes && <p className="map-record-notes">{record.notes}</p>}
      {(onOperation || onEdit) && <div className="map-record-actions">{onOperation && availableOperations(record).map(type => <button key={type} onClick={() => onOperation(record, type)}>{type.charAt(0).toUpperCase() + type.slice(1)}</button>)}{onEdit && <button onClick={() => onEdit(location, record)}>Edit details</button>}</div>}
    </article>) : <div className="map-location-empty"><Icon /><div><strong>This location is ready.</strong><p>{onAdd ? 'Add a truck, task or inventory record appropriate to this area.' : 'No operational records are assigned here yet.'}</p></div></div>}
    <small className="map-detail-note">Actions use the same guarded warehouse workflows as the inventory inspector. Invalid moves are rejected before stock changes.</small>
  </section>;
}
