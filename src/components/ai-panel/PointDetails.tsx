import { Activity, Zap, Cpu, Sparkles, Trash2, GitCommit, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MeasurementCapture } from './MeasurementCapture';
import { MeasurementHistory } from './MeasurementHistory';
import type { Point, MeasurementValue, MeasurementHistoryItem, PointCategory } from '../../types';

const MEASUREMENT_TYPES = [
    { id: 'voltage', icon: Zap, lbl: 'Volt' },
    { id: 'resistance', icon: Cpu, lbl: 'Ohms' },
    { id: 'diode', icon: Zap, lbl: 'Diode' },
    { id: 'oscilloscope', icon: Activity, lbl: 'Scope' }
];

interface PointDetailsProps {
    selectedPoint: Point;
    categories: PointCategory[];
    history: MeasurementHistoryItem[];
    isCapturing: boolean;
    referenceWaveform?: MeasurementValue;
    onUpdatePoint: (field: keyof Point, value: Point[keyof Point]) => void;
    onDeletePoint: (id: number | string) => void;
    onAskAboutPoint: (point: Point) => void;
    onCapture: () => void;
    onOpenComparison?: () => void;
    onSetReferenceWaveform: (waveform: MeasurementValue) => void;
}

export const PointDetails: React.FC<PointDetailsProps> = ({
    selectedPoint,
    categories,
    history,
    isCapturing,
    referenceWaveform,
    onUpdatePoint,
    onDeletePoint,
    onAskAboutPoint,
    onCapture,
    onOpenComparison,
    onSetReferenceWaveform
}) => {
    const { t } = useTranslation();

    const getMeasurementStatusColor = () => {
        if (!selectedPoint.expected_value || !selectedPoint.tolerance) return "text-cyan-400";

        const currentMeas = selectedPoint.measurements?.[selectedPoint.type];
        if (!currentMeas) return "text-cyan-400";

        let val: number | undefined;
        if (selectedPoint.type === 'oscilloscope') {
            val = currentMeas.vpp;
        } else {
            const v = currentMeas.value;
            if (typeof v === 'number') val = v;
            else if (typeof v === 'string') val = parseFloat(v);
        }

        if (val === undefined || isNaN(val)) return "text-cyan-400";

        const expected = parseFloat(selectedPoint.expected_value);
        if (isNaN(expected)) return "text-cyan-400";

        const tol = selectedPoint.tolerance;
        const margin = Math.abs(expected * (tol / 100));

        if (val >= expected - margin && val <= expected + margin) return "text-green-400";
        return "text-red-500";
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            {/* Point Header */}
            <div className="flex justify-between items-center">
                <div className="flex-1 mr-2 flex space-x-2">
                    <input
                        value={selectedPoint.label}
                        onChange={(e) => onUpdatePoint('label', e.target.value)}
                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full font-bold"
                    />
                    <button
                        onClick={() => onAskAboutPoint(selectedPoint)}
                        className="p-2 bg-purple-600/20 text-purple-300 rounded hover:bg-purple-600/40"
                        title={t('ai_panel.ask_ai')}
                    >
                        <Sparkles size={16} />
                    </button>
                </div>
                <button
                    onClick={() => onDeletePoint(selectedPoint.id)}
                    className="text-red-400 p-2 hover:bg-red-900/30 rounded"
                    title={t('ai_panel.delete_point')}
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Measurement Type */}
            <div className="grid grid-cols-4 gap-2">
                {MEASUREMENT_TYPES.map(type => (
                    <button
                        key={type.id}
                        onClick={() => onUpdatePoint('type', type.id)}
                        className={`flex flex-col items-center p-2 rounded border ${selectedPoint.type === type.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                    >
                        <type.icon size={16} />
                        <span className="text-[10px] mt-1">{type.lbl}</span>
                    </button>
                ))}
            </div>

            {/* Category */}
            <div className="flex flex-wrap gap-1">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => onUpdatePoint('category', selectedPoint.category === cat.id ? undefined : cat.id)}
                        className={`px-2 py-1 rounded text-[10px] border font-bold flex items-center transition-all ${selectedPoint.category === cat.id ? 'ring-1 ring-white' : 'opacity-60 hover:opacity-100'}`}
                        style={{ backgroundColor: cat.color, borderColor: cat.color, color: 'white' }}
                        title={cat.label}
                    >
                        {selectedPoint.category === cat.id && <CheckCircle2 size={10} className="mr-1" />}
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Tolerance & Expected Value */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-gray-400 text-xs font-semibold">{t('ai_panel.expected_value')}</label>
                    <input
                        type="text"
                        value={selectedPoint.expected_value || ''}
                        onChange={(e) => onUpdatePoint('expected_value', e.target.value)}
                        className="w-full bg-gray-900 rounded p-1 text-sm text-yellow-500 font-mono text-center border border-gray-700"
                        placeholder="e.g. 1.8V"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-gray-400 text-xs font-semibold">{t('ai_panel.tolerance')} (%)</label>
                    <input
                        type="number"
                        value={selectedPoint.tolerance || ''}
                        onChange={(e) => onUpdatePoint('tolerance', parseFloat(e.target.value))}
                        placeholder="Ej: 10"
                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white font-mono"
                    />
                </div>
            </div>

            {/* Comparison Button */}
            {onOpenComparison && (
                <button
                    onClick={onOpenComparison}
                    className="w-full bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 text-xs py-1.5 rounded border border-purple-800/50 flex items-center justify-center transition"
                >
                    <GitCommit size={12} className="mr-2" />
                    {t('ai_panel.compare_gold')}
                </button>
            )}

            {/* Live Measurement */}
            <MeasurementCapture
                selectedPoint={selectedPoint}
                isCapturing={isCapturing}
                onCapture={onCapture}
                statusColor={getMeasurementStatusColor()}
                referenceWaveform={referenceWaveform}
            />

            {/* Notes */}
            <textarea
                value={selectedPoint.notes || ''}
                onChange={(e) => onUpdatePoint('notes', e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-gray-300 h-24 resize-none"
                placeholder={t('ai_panel.tech_notes')}
            />

            {/* History */}
            <MeasurementHistory
                history={history}
                onSetReferenceWaveform={onSetReferenceWaveform}
            />
        </div>
    );
};

export default PointDetails;
