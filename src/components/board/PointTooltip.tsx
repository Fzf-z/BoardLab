import React from 'react';
import { Activity, Zap, Cpu, Link as LinkIcon } from 'lucide-react';
import { Point, MeasurementValue } from '../../types';
import MiniWaveform from './MiniWaveform';

interface PointTooltipProps {
    point: Point;
    effectivePoint: Point;
    screenX: number;
    screenY: number;
}

const PointTooltip: React.FC<PointTooltipProps> = ({ point, effectivePoint, screenX, screenY }) => {
    const isReplica = !!point.parentPointId;
    const hasMeasurements = effectivePoint.measurements && Object.keys(effectivePoint.measurements).length > 0;

    const renderMeasurementRow = (type: string, data: MeasurementValue) => {
        let icon = <Activity size={12} />;
        let label = type;
        let valueDisplay: React.ReactNode = typeof data.value === 'object' ? 'Waveform Saved' : data.value;

        if (type === 'voltage') { icon = <Zap size={12} className="text-yellow-400" />; label = 'Volt'; }
        if (type === 'resistance') { icon = <Cpu size={12} className="text-green-400" />; label = 'Res'; }
        if (type === 'diode') { icon = <Zap size={12} className="text-blue-400" />; label = 'Diode'; }
        if (type === 'oscilloscope') {
            icon = <Activity size={12} className="text-purple-400" />;
            label = 'Scope';
            if (data.vpp) valueDisplay = `${data.vpp.toFixed(2)}Vpp`;
        }

        return (
            <div key={type} className="flex flex-col mb-1 last:mb-0">
                <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center text-gray-400">
                        <span className="mr-1">{icon}</span>
                        <span className="capitalize">{label}</span>
                    </div>
                    <div className="font-mono font-bold">{valueDisplay}</div>
                </div>
                {type === 'oscilloscope' && <MiniWaveform data={data} />}
            </div>
        );
    };

    return (
        <div
            className="absolute z-50 bg-gray-900/95 backdrop-blur-xs border border-gray-700 text-white p-3 rounded-lg shadow-2xl w-48 pointer-events-none"
            style={{ left: screenX + 20, top: screenY, transform: 'translateY(-50%)' }}
        >
            <div className="font-bold text-sm border-b border-gray-700 pb-1 mb-2 flex justify-between items-center text-blue-400">
                <span className="flex items-center gap-2">
                    {isReplica && <LinkIcon size={12} className="text-gray-400" />}
                    {effectivePoint.label || `Point ${effectivePoint.id}`}
                </span>
                {isReplica && <span className="text-[10px] bg-gray-700 px-1 rounded text-gray-300">LINKED</span>}
            </div>

            {!hasMeasurements ? (
                <div className="text-xs text-gray-500 italic">No measurements yet</div>
            ) : (
                <div className="space-y-2">
                    {['voltage', 'resistance', 'diode', 'oscilloscope'].map(type => {
                        if (!effectivePoint.measurements) return null;
                        const data = effectivePoint.measurements[type];
                        if (!data) return null;
                        return renderMeasurementRow(type, data);
                    })}
                    {point.notes && (
                        <div className="mt-2 pt-2 border-t border-gray-700">
                            <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Notes</div>
                            <div className="text-xs text-gray-300 italic line-clamp-3">{point.notes}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PointTooltip;
