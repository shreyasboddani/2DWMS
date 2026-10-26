import { useId } from 'react';
import type { ReactNode } from 'react';
import type { Location, OperationalRecord } from '../domain/warehouse';
import { Modal } from './WarehouseWorkflows';

/** A flat explanatory diagram; record state below remains the operational source. */
export function StationPopup({ location, records, onClose, children }: {
  location: Location; records: OperationalRecord[]; onClose: () => void; children: ReactNode;
}) {
  const id = useId().replaceAll(':', '');
  const dock = location.zone === 'inbound' || location.zone === 'outbound';
  const packing = location.zone === 'packing';
  const title = dock ? (location.zone === 'inbound' ? 'Receiving dock' : 'Dispatch dock') : packing ? 'Packing station' : location.code.includes('QC-') ? 'Quality station' : location.code.includes('RET-') ? 'Returns station' : 'Staging lane';
  const truck = records.find(r => r.kind === 'Truck' && ['At dock', 'On hold'].includes(r.status));
  return <Modal title={`${title} / ${location.code}`} onClose={onClose}>
    <div className="station-popup">
      <div className="station-visual-heading"><div><span className="map-kicker">STATION EXPLORER</span><h3>{title}</h3><p>{dock ? 'Inspect the truck, cargo and the next warehouse movement.' : packing ? 'Follow the task from picked stock to packed shipment.' : 'Inspect assigned handling units and their next destination.'}</p></div><code>{location.code}</code></div>
      <div className="station-graphic">
        <svg viewBox="0 0 680 270" role="img" aria-label={`Illustrative top-down ${title.toLowerCase()} diagram`}>
          <defs><pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#cad9e7" /></pattern></defs>
          <rect width="680" height="270" fill="#f5f9fd" /><rect width="680" height="270" fill={`url(#${id})`} />
          {dock ? <>
            <rect x="15" y="30" width="290" height="215" rx="12" fill="#e8eff6" /><rect x="320" y="30" width="345" height="215" rx="12" fill="#fdfefe" stroke="#dce7ef" />
            <text x="38" y="56" className="station-svg-label">EXTERIOR YARD</text><text x="345" y="56" className="station-svg-label">WAREHOUSE FLOOR</text>
            <path d="M307 32v59m0 89v62" stroke="#819ab3" strokeWidth="9" /><path d="M50 82h224M50 190h224" stroke="#d1b76d" strokeWidth="2" strokeDasharray="8 5" />
            <rect x="275" y="101" width="55" height="67" rx="3" fill="#b7c9d9" /><path d="M289 110h28m-28 9h28m-28 9h28m-28 9h28m-28 9h28m-28 9h28" stroke="#91a9bf" />
            <g opacity={truck ? 1 : .3}><rect x="87" y="100" width="190" height="69" rx="5" fill="#fbfdff" stroke="#91a8bf" strokeWidth="2" /><path d="M104 110h157m-157 49h157M256 107v55" stroke="#d2deea" strokeWidth="2" /><rect x="32" y="110" width="46" height="49" rx="8" fill="#2f5f95" /><rect x="40" y="116" width="8" height="35" rx="3" fill="#93bdce" /><path d="M47 105h15m-15 59h15M227 94h22m-22 81h22" stroke="#52687e" strokeWidth="5" /><text x="183" y="139" textAnchor="middle" className="station-svg-truck">{truck ? 'ASSIGNED TRAILER' : 'DOCK AVAILABLE'}</text></g>
            <path d={location.zone === 'inbound' ? 'M356 136h102m-13-10 13 10-13 10' : 'M458 136H356m13-10-13 10 13 10'} fill="none" stroke="#45a99e" strokeWidth="3" strokeDasharray="6 4" />
            {[0, 1, 2].map(i => <g key={i} transform={`translate(${495 + i * 47} 109)`}><rect width="37" height="52" rx="4" fill="#edf5f4" stroke="#b7d4d0" /><path d="M6 12h25M6 25h25M6 38h25" stroke="#c3dcd7" /></g>)}
            <text x="321" y="214" textAnchor="middle" className="station-svg-label">DOCK THRESHOLD</text><text x="560" y="190" textAnchor="middle" className="station-svg-label">HANDLING AREA</text>
          </> : packing ? <>
            <text x="38" y="45" className="station-svg-label">PICKED STOCK</text><text x="325" y="45" textAnchor="middle" className="station-svg-label">PACKING BENCH</text><text x="577" y="45" textAnchor="middle" className="station-svg-label">READY FOR LOADING</text>
            <rect x="35" y="87" width="135" height="105" rx="10" fill="#e5eeef" stroke="#b9d0d2" /><path d="M48 102h108m-108 21h108m-108 21h108m-108 21h108m-108 16h108" stroke="#c5d7d8" strokeWidth="3" />
            <path d="M186 135h37m-9-7 9 7-9 7" stroke="#88a8c8" strokeWidth="2" fill="none" />
            <rect x="244" y="88" width="195" height="100" rx="7" fill="#dce7f3" stroke="#7c9dbd" strokeWidth="2" /><rect x="254" y="99" width="175" height="78" rx="4" fill="#f9fbfe" />
            <rect x="270" y="111" width="53" height="48" rx="3" fill="#d7b48b" stroke="#b89469" /><path d="M291 111v48" stroke="#efe2c9" strokeWidth="7" /><rect x="365" y="105" width="44" height="26" rx="3" fill="#355c84" /><path d="M372 112h30m-30 7h20" stroke="#a7c7da" strokeWidth="2" /><path d="m381 146 12 9m-8-15 12 9" stroke="#446f98" strokeWidth="5" />
            <rect x="454" y="111" width="180" height="51" rx="8" fill="#d9e7e9" stroke="#a1bdc2" />{Array.from({length: 10}, (_, i) => <path key={i} d={`M${465 + i * 17} 117v38`} stroke="#b5cbcf" strokeWidth="2" />)}
            {records.length > 0 && <><rect x="510" y="115" width="43" height="42" rx="3" fill="#d7b48b" stroke="#b89469" /><path d="M529 115v42" stroke="#efe2c9" strokeWidth="6" /></>}
            <circle cx="342" cy="222" r="12" fill="#a0b6cc" /><path d="M322 246q20-24 40 0" fill="#c3d2e3" /><text x="101" y="220" textAnchor="middle" className="station-svg-label">STAGING BUFFER</text>
          </> : <>
            <text x="40" y="40" className="station-svg-label">{title.toUpperCase()} / HANDLING POSITIONS</text>
            {[0, 1, 2, 3].map(i => <g key={i} transform={`translate(${45 + i * 154} 76)`}><rect width="128" height="125" rx="8" fill="#eef7f5" stroke="#9cc5bd" strokeDasharray="5 4" /><rect x="24" y="24" width="80" height="73" rx="4" fill="#dcece7" /><path d="M30 39h68m-68 19h68m-68 19h68" stroke="#bdd4cb" strokeWidth="5" /><text x="64" y="114" textAnchor="middle" className="station-svg-label">HANDLING SPACE</text></g>)}
            <path d="M48 231h577m-12-8 12 8-12 8" fill="none" stroke="#8eb2bd" strokeWidth="2" strokeDasharray="7 5" />
          </>}
        </svg>
        <span>Illustrative station diagram. Operational records appear below.</span>
      </div>
      <div className="station-summary"><div><span>ASSIGNED RECORDS</span><strong>{records.length}</strong></div><div><span>{dock ? 'CARGO LINES' : 'CURRENT STATUS'}</span><strong>{dock ? records.reduce((n, r) => n + (r.cargo?.length ?? 0), 0) : records[0]?.status ?? 'Unassigned'}</strong></div><div><span>{dock ? 'TRUCK STATUS' : 'LOCATION TYPE'}</span><strong>{dock ? truck?.status ?? records.find(r => r.kind === 'Truck')?.status ?? 'No truck assigned' : title}</strong></div></div>
      {children}
      <button className="station-close-button" onClick={onClose}>Back to warehouse layout</button>
    </div>
  </Modal>;
}
