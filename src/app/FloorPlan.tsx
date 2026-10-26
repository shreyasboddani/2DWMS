import { useEffect, useState } from "react";
import { feet, meters } from "../domain/units";
import { NumberInput } from "./NumberInput";
import { equipmentCatalog, moduleSize } from "../domain/design";
import { generateLayout, zones } from "../domain/warehouse";
import type {
  WarehouseConfig,
  OperationalRecord,
  Zone,
} from "../domain/warehouse";

/** A compact 2D navigation path from the warehouse plan to a rack position. */
export function Warehouse2D({
  config,
  records = [],
  selected = "",
  onSelect,
}: {
  config: WarehouseConfig;
  records?: OperationalRecord[];
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  const [aisle, setAisle] = useState<number | null>(null);
  const [bay, setBay] = useState<number | null>(null);
  const layout = generateLayout(config);
  const storage = layout.locations.filter((l) => l.zone === "storage" && l.aisle);
  useEffect(() => {
    const target = storage.find((l) => l.id === selected);
    if (target?.aisle) {
      setAisle(target.aisle);
      setBay(target.bay || null);
    }
  }, [selected, config]);
  const aisles = [...new Set(storage.map((l) => l.aisle!))].sort((a, b) => a - b);
  const aisleLocations = storage.filter((l) => l.aisle === aisle);
  const bays = [...new Set(aisleLocations.map((l) => l.bay!).filter(Boolean))].sort((a,b) => a-b);
  const bayLocations = aisleLocations.filter((l) => l.bay === bay);
  const occupied = new Set(records.filter((r) => r.quantity > 0 && r.kind !== "Truck" && !["Expected", "Dispatched"].includes(r.status)).map((r) => r.locationId));
  const chooseAisle = (n: number) => { setAisle(n); setBay(null); };
  const back = () => { if (bay !== null) setBay(null); else setAisle(null); };
  const title = bay !== null ? `Aisle ${String(aisle).padStart(2,"0")} · Bay ${String(bay).padStart(2,"0")}` : aisle !== null ? `Aisle ${String(aisle).padStart(2,"0")}` : "Warehouse layout";
  const positions = bayLocations.slice().sort((a,b) => (b.level || 0)-(a.level || 0) || (a.side || "").localeCompare(b.side || "") || (a.bin || 0)-(b.bin || 0));
  const sides = [...new Set(positions.map((p) => p.side || "Rack"))];
  const levels = [...new Set(positions.map((p) => p.level || 1))].sort((a,b)=>b-a);
  return <section className="warehouse-2d" aria-label="2D warehouse navigation">
    <div className="warehouse-2d-heading">
      <div><span className="eyebrow">2D WAREHOUSE VIEW</span><h2>{title}</h2></div>
      {aisle !== null && <button className="button secondary small" onClick={back}>← {bay !== null ? "Aisle" : "Layout"}</button>}
    </div>
    <nav className="warehouse-2d-crumbs" aria-label="Warehouse navigation">
      <button onClick={() => { setAisle(null); setBay(null); }} className={aisle === null ? "active" : ""}>Layout</button>
      {aisle !== null && <><span>›</span><button onClick={() => setBay(null)} className={bay === null ? "active" : ""}>Aisle {String(aisle).padStart(2,"0")}</button></>}
      {bay !== null && <><span>›</span><span>Bay {String(bay).padStart(2,"0")}</span></>}
    </nav>
    {aisle === null ? <>
      <p className="warehouse-2d-hint">Select an aisle to explore its bays and stored inventory.</p>
      <svg className="warehouse-2d-layout" role="img" aria-label="Top-down warehouse layout. Select an aisle." viewBox={`${-config.width/2-2} ${-config.depth/2-2} ${config.width+4} ${config.depth+4}`}>
        <rect x={-config.width/2} y={-config.depth/2} width={config.width} height={config.depth} rx=".6" fill="#f4f7fa" stroke="#cbd6e1" strokeWidth=".22" />
        {aisles.map((n) => {
          const locs = storage.filter((l) => l.aisle === n), x = locs.reduce((s,l)=>s+l.x,0)/Math.max(1,locs.length), minZ=Math.min(...locs.map(l=>l.z)), maxZ=Math.max(...locs.map(l=>l.z));
          const cx=x, y=minZ-.6, h=Math.max(2,maxZ-minZ+1.2), active=aisle===n;
          return <g key={n} role="button" tabIndex={0} aria-label={`Open aisle ${n}`} onClick={()=>chooseAisle(n)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();chooseAisle(n);}}} style={{cursor:"pointer"}}><rect x={cx-1.05} y={y} width="2.1" height={h} rx=".35" fill={active?"#347db5":"#d9e6f0"} stroke="#6c8ba5" strokeWidth=".12"/><text x={cx} y={0} textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90 ${cx} 0)`} fontSize="1.1" fill={active?"white":"#24445f"} fontFamily="sans-serif">Aisle {String(n).padStart(2,"0")}</text></g>;
        })}
      </svg>
    </> : bay === null ? <>
      <p className="warehouse-2d-hint">Select a bay to see the rack face and its positions.</p>
      <div className="warehouse-2d-bays" aria-label={`Aisle ${aisle} bays`}>
        {bays.map((n) => { const count=aisleLocations.filter(l=>l.bay===n && occupied.has(l.id)).length; return <button key={n} className="warehouse-2d-bay" onClick={()=>setBay(n)}><span>Bay {String(n).padStart(2,"0")}</span><small>{count} occupied position{count===1?"":"s"}</small><span className="warehouse-2d-mini-rack" /></button>; })}
      </div>
    </> : <>
      <p className="warehouse-2d-hint">Front view · Click a position to inspect its item and quantity.</p>
      <div className="warehouse-rack-face" role="table" aria-label={`Rack positions in aisle ${aisle}, bay ${bay}`}>
        <div className="rack-face-top"><span>LEVEL</span>{sides.map(s=><span key={s}>{s === "L" ? "LEFT" : s === "R" ? "RIGHT" : s.toUpperCase()}</span>)}</div>
        {levels.map(level=><div className="rack-face-row" role="row" key={level}><strong>{level}</strong>{sides.map(side=>{
          const cells=positions.filter(p=>(p.level||1)===level && (p.side||"Rack")===side);
          return <div className="rack-face-cells" key={side}>{cells.map(p=><button key={p.id} aria-label={`${p.code}${occupied.has(p.id)?", occupied":" , empty"}`} title={`${p.code}${occupied.has(p.id)?" · Occupied":" · Empty"}`} className={`rack-position ${occupied.has(p.id)?"occupied":""} ${selected===p.id?"selected":""}`} onClick={()=>onSelect?.(p.id)}><span>{p.bin}</span></button>)}</div>;
        })}</div>)}
      </div>
      {!positions.length && <p>No positions are defined for this bay.</p>}
      <div className="warehouse-2d-legend"><span><i className="empty"/> Empty</span><span><i className="occupied"/> Occupied</span></div>
    </>}
  </section>;
}
export function FloorPlan({
  config,
  records = [],
  onSelect,
}: {
  config: WarehouseConfig;
  records?: OperationalRecord[];
  onSelect?: (id: string) => void;
}) {
  const layout = generateLayout(config, onSelect ? "full" : "structure"),
    occupied = new Set(
      records
        .filter(
          (r) =>
            r.kind !== "Truck" &&
            r.quantity > 0 &&
            !["Expected", "Dispatched"].includes(r.status),
        )
        .map((r) => r.locationId),
    ),
    width = config.width,
    depth = config.depth;
  if (config.design) {
    const floor = config.design.floors[0];
    return (
      <svg
        className="warehouse-floor-plan"
        role="img"
        aria-label="Custom ground floor warehouse plan"
        viewBox={`${-width / 2 - 2} ${-depth / 2 - 2} ${width + 4} ${depth + 4}`}
      >
        <polygon
          points={floor.outline.map((p) => `${p.x},${p.z}`).join(" ")}
          fill="#edf2f6"
          stroke="#7a91ad"
          strokeWidth=".25"
        />
        {floor.modules.map((m) => {
          const size = moduleSize(m);
          return (
            <g key={m.id}>
              <rect
                x={m.x - size.width / 2}
                y={m.z - size.depth / 2}
                width={size.width}
                height={size.depth}
                fill={
                  equipmentCatalog.find((e) => e.id === m.kind)?.color ||
                  "#89a8c2"
                }
                fillOpacity={m.kind === "area" ? 0.1 : 0.5}
                stroke="#fff"
                strokeWidth=".08"
              />
              <title>{m.label}</title>
            </g>
          );
        })}
        {layout.locations
          .filter(
            (l) =>
              l.floorId === floor.id && (l.zone !== "storage" || (l.level === 1 && (!!onSelect || occupied.has(l.id)))),
          )
          .map((l) => (
            <rect
              key={l.id}
              x={l.x - 0.4}
              y={l.z - 0.3}
              width={0.8}
              height={0.6}
              fill={occupied.has(l.id) ? "#09a49b" : "#477ba7"}
              onClick={() => onSelect?.(l.id)}
            >
              <title>{l.label}</title>
            </rect>
          ))}
      </svg>
    );
  }
  return (
    <svg
      className="warehouse-floor-plan"
      role="img"
      aria-label="Warehouse floor plan with mapped rack and workstation locations"
      viewBox={`${-width / 2 - 2} ${-depth / 2 - 2} ${width + 4} ${depth + 4}`}
    >
      <rect
        x={-width / 2}
        y={-depth / 2}
        width={width}
        height={depth}
        fill="#edf2f6"
        stroke="#9cabbc"
        strokeWidth=".25"
      />
      {layout.racks.map((r, i) => (
        <rect
          key={i}
          x={r.x - 0.6}
          y={r.z - r.length / 2}
          width={1.2}
          height={r.length}
          fill="#477ba7"
          rx=".15"
        />
      ))}
      {layout.locations
        .filter((l) => l.zone !== "storage" || (l.level === 1 && (!!onSelect || occupied.has(l.id))))
        .map((l) => (
          <g
            key={l.id}
            aria-hidden={!onSelect}
            onClick={() => onSelect?.(l.id)}
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            <rect
              x={l.x - 0.5}
              y={l.z - 0.4}
              width={1}
              height={0.8}
              fill={
                occupied.has(l.id)
                  ? "#09a49b"
                  : l.zone === "storage"
                    ? "#b4ccdf"
                    : zones.find((z) => z.id === l.zone)!.color
              }
              stroke="#fff"
              strokeWidth=".08"
            />
            <title>
              {l.code} · {l.label}
            </title>
          </g>
        ))}
      {zones.map((z) => (
        <text
          key={z.id}
          x={layout.centers[z.id][0]}
          y={layout.centers[z.id][1] + 2}
          fontSize=".95"
          textAnchor="middle"
          fill="#27415c"
          fontFamily="sans-serif"
        >
          {z.name}
        </text>
      ))}
    </svg>
  );
}
export function LayoutPlacement({
  config,
  onChange,
}: {
  config: WarehouseConfig;
  onChange: (config: WarehouseConfig) => void;
}) {
  const set = (zone: Zone, axis: "x" | "z", value: number) =>
    onChange({
      ...config,
      layoutOffsets: {
        ...config.layoutOffsets,
        [zone]: {
          x: config.layoutOffsets?.[zone]?.x || 0,
          z: config.layoutOffsets?.[zone]?.z || 0,
          [axis]: value,
        },
      },
    });
  return (
    <details className="layout-placement">
      <summary>Customize area positions</summary>
      <p className="subtle">
        Offsets in feet from the selected template. Docks stay on their exterior
        wall. Overlaps and boundary violations prevent saving.
      </p>
      <FloorPlan config={config} />
      <div className="placement-grid">
        {zones.map((zone) => (
          <div key={zone.id}>
            <strong>{zone.name}</strong>
            {(["x", "z"] as const).map((axis) => (
              <label key={axis}>
                {axis === "x" ? "Across" : "Down"} offset (ft)
                <NumberInput
                  value={feet(config.layoutOffsets?.[zone.id]?.[axis] || 0)}
                  step={1}
                  disabled={
                    (zone.id === "inbound" && axis === "z") ||
                    (zone.id === "outbound" &&
                      axis === (config.template === "l-flow" ? "x" : "z"))
                  }
                  onChange={(n) => set(zone.id, axis, meters(n))}
                />
              </label>
            ))}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="text-button"
        onClick={() => onChange({ ...config, layoutOffsets: undefined })}
      >
        Reset positions to template
      </button>
    </details>
  );
}
