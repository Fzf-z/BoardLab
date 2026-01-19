import React, { useState, useEffect } from 'react';
import { Activity, Zap, Cpu, Sparkles, Trash2, Wifi, Loader2, Clock, GitCommit, CheckCircle2, LayoutList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../contexts/ProjectContext';
import { Logger } from '../utils/logger';
import { InstrumentConfig, MeasurementValue, Point, ComparisonPoint, MeasurementHistoryItem, OscilloscopeData, MeasurementType } from '../types';
import Waveform from './Waveform';
import PointsTable from './PointsTable';
import { safeJsonParse } from '../utils/safeJson';
import { safePointAPI } from '../utils/safeElectronAPI';

const log = Logger.Measurements;

interface AIPanelProps {
    askAboutPoint: (point: Point) => void;
    captureValue: (point: Point) => Promise<MeasurementValue | null>;
    isCapturing: boolean;
    analyzeBoard: (points: Point[]) => void;
    instrumentConfig: InstrumentConfig;
    onOpenComparison?: () => void;
    comparisonPoint?: ComparisonPoint | null;
    mode: 'view' | 'measure';
}

const AIPanel: React.FC<AIPanelProps> = ({
    askAboutPoint,
    captureValue,
    isCapturing,
    analyzeBoard,
    // instrumentConfig,
    onOpenComparison,
    comparisonPoint,
    mode
}) => {
    const {
        points,
        board,
        deletePoint,
        addMeasurement,
        appSettings,
        saveProject
    } = useProject();

    const { setPoints, selectedPoint } = board;
    const { t } = useTranslation();

    const [history, setHistory] = useState<MeasurementHistoryItem[]>([]);
    const [referenceWaveform, setReferenceWaveform] = useState<OscilloscopeData | null>(null);
    const [activeTab, setActiveTab] = useState<'detail' | 'table'>('detail');

    useEffect(() => {
        if (comparisonPoint && comparisonPoint.type === 'oscilloscope' && comparisonPoint.measurements?.oscilloscope) {
            setReferenceWaveform(comparisonPoint.measurements.oscilloscope);
        }
    }, [comparisonPoint]);

    useEffect(() => {
        if (mode === 'view') {
            setActiveTab('table');
        }
    }, [mode]);

    useEffect(() => {
        setHistory([]);
        setReferenceWaveform(null);
        if (selectedPoint && selectedPoint.id && typeof selectedPoint.id === 'number') {
            safePointAPI.getMeasurementHistory(selectedPoint.id)
                .then((measurements) => setHistory(measurements));
        }
    }, [selectedPoint?.id]);

    const handlePointUpdate = async (field: keyof Point, value: Point[keyof Point]) => {
        if (!selectedPoint) return;
        const newPoints = points.map(p => (p.id === selectedPoint.id ? { ...p, [field]: value } : p));
        setPoints(newPoints);

        if (appSettings.autoSave) {
            saveProject(newPoints);
        }

        if (field === 'type' && value !== 'oscilloscope') {
            // Map point type to instrument action
            let actionKey = '';
            switch (value) {
                case 'voltage': actionKey = 'CONFIGURE_VOLTAGE'; break;
                case 'resistance': actionKey = 'CONFIGURE_RESISTANCE'; break;
                case 'diode': actionKey = 'CONFIGURE_DIODE'; break;
                case 'ground':
                    // Ground is a reference, no active configuration needed on the multimeter
                    // unless we wanted to switch to Continuity, but user suggested Ground = Reference.
                    actionKey = '';
                    break;
                case 'continuity': // Future proofing
                    actionKey = 'CONFIGURE_CONTINUITY';
                    break;
            }

            if (actionKey && window.electronAPI?.instrumentExecute) {
                try {
                    log.debug(`Auto-configuring multimeter: ${actionKey}`);
                    await window.electronAPI.instrumentExecute('multimeter', actionKey);
                } catch (err) {
                    // It's possible the instrument doesn't have this command mapped, just warn
                    log.warn('Failed to auto-configure multimeter', err);
                }
            }
        }
    };

    const handleCapture = async () => {
        if (!selectedPoint || !selectedPoint.id) {
            log.warn('Attempted to capture measurement with no point selected');
            return;
        }

        const measurement = await captureValue(selectedPoint);
        if (measurement) {
            // New centralized logic handles everything (temp points, saving, state update)
            const savedMeasurement = await addMeasurement(selectedPoint, measurement);
            // addMeasurement returns the saved measurement object if successful
            if (savedMeasurement) {
                // It might return object with id, or null. 
                // We add to history manually for instant feedback in the list, though addMeasurement updates context state
                // We just need to ensure the ID is there if we want to use it
                const newHistoryItem = { ...savedMeasurement };
                setHistory([newHistoryItem, ...history]);
            }
        }
    };

    const measurementTypes = [
        { id: 'voltage', icon: Zap, lbl: 'Volt' },
        { id: 'resistance', icon: Cpu, lbl: 'Ohms' },
        { id: 'diode', icon: Zap, lbl: 'Diode' },
        { id: 'oscilloscope', icon: Activity, lbl: 'Scope' }
    ];

    const getMeasurementStatusColor = () => {
        if (!selectedPoint || !selectedPoint.expected_value || !selectedPoint.tolerance) return "text-cyan-400";

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
        <div className="w-82 bg-gray-800 border-l border-gray-700 flex flex-col z-20 shadow-xl">
            {mode === 'measure' ? (
                <div className="flex border-b border-gray-700">
                    <button
                        onClick={() => setActiveTab('detail')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center transition-colors ${activeTab === 'detail' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                    >
                        <Activity size={16} className="mr-2" />
                        {t('ai_panel.data')}
                    </button>
                    <button
                        onClick={() => setActiveTab('table')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center transition-colors ${activeTab === 'table' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                    >
                        <LayoutList size={16} className="mr-2" />
                        {t('ai_panel.table')}
                    </button>
                </div>
            ) : (
                <div className="flex border-b border-gray-700">
                    <div className="flex-1 py-3 text-sm font-bold flex items-center justify-center bg-gray-800 text-blue-400 border-b-2 border-blue-400">
                        <LayoutList size={16} className="mr-2" />
                        {t('ai_panel.points_table')}
                    </div>
                </div>
            )}

            {(activeTab === 'table' || mode === 'view') ? (
                <div className="flex-1 overflow-hidden h-full">
                    <PointsTable mode={mode} />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!selectedPoint ? (
                        <div className="text-gray-500 text-center mt-10 text-sm">{t('ai_panel.select_point')}</div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                            {/* --- Point Details --- */}
                            <div className="flex justify-between items-center">
                                <div className="flex-1 mr-2 flex space-x-2">
                                    <input
                                        value={selectedPoint.label}
                                        onChange={(e) => handlePointUpdate('label', e.target.value)}
                                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full font-bold"
                                    />
                                    <button onClick={() => askAboutPoint(selectedPoint)} className="p-2 bg-purple-600/20 text-purple-300 rounded hover:bg-purple-600/40" title="Ask AI">
                                        <Sparkles size={16} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => deletePoint(selectedPoint.id)}
                                    className="text-red-400 p-2 hover:bg-red-900/30 rounded"
                                    title="Delete Point"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {/* --- Measurement Type --- */}
                            <div className="grid grid-cols-4 gap-2">
                                {measurementTypes.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handlePointUpdate('type', t.id)}
                                        className={`flex flex-col items-center p-2 rounded border ${selectedPoint.type === t.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                    >
                                        <t.icon size={16} />
                                        <span className="text-[10px] mt-1">{t.lbl}</span>
                                    </button>
                                ))}
                            </div>

                            {/* --- Category --- */}
                            <div className="flex flex-wrap gap-1">
                                {appSettings.categories && appSettings.categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handlePointUpdate('category', selectedPoint.category === cat.id ? undefined : cat.id)}
                                        className={`px-2 py-1 rounded text-[10px] border font-bold flex items-center transition-all ${selectedPoint.category === cat.id ? 'ring-1 ring-white' : 'opacity-60 hover:opacity-100'}`}
                                        style={{ backgroundColor: cat.color, borderColor: cat.color, color: 'white' }}
                                        title={cat.label}
                                    >
                                        {selectedPoint.category === cat.id && <CheckCircle2 size={10} className="mr-1" />}
                                        {cat.label}
                                    </button>
                                ))}
                            </div>

                            {/* --- Tolerance & Expected Value --- */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-gray-400 text-xs font-semibold">{t('ai_panel.expected_value')}</label>
                                    <input
                                        type="text"
                                        value={selectedPoint.expected_value || ''}
                                        onChange={(e) => handlePointUpdate('expected_value', e.target.value)}
                                        className="w-full bg-gray-900 rounded p-1 text-sm text-yellow-500 font-mono text-center border border-gray-700"
                                        placeholder="e.g. 1.8V"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-gray-400 text-xs font-semibold">{t('ai_panel.tolerance')} (%)</label>
                                    <input
                                        type="number"
                                        value={selectedPoint.tolerance || ''}
                                        onChange={(e) => handlePointUpdate('tolerance', parseFloat(e.target.value))}
                                        placeholder="Ej: 10"
                                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white font-mono"
                                    />
                                </div>
                            </div>

                            {onOpenComparison && (
                                <button
                                    onClick={onOpenComparison}
                                    className="w-full bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 text-xs py-1.5 rounded border border-purple-800/50 flex items-center justify-center transition"
                                >
                                    <GitCommit size={12} className="mr-2" />
                                    {t('ai_panel.compare_gold')}
                                </button>
                            )}

                            {/* --- Live Measurement --- */}
                            <div className="bg-black/40 rounded-lg p-4 border border-gray-700">
                                <div className={`text-2xl font-mono font-bold mb-1 ${getMeasurementStatusColor()}`}>
                                    {selectedPoint.type === 'oscilloscope'
                                        ? `Vpp: ${selectedPoint.measurements?.oscilloscope?.vpp?.toFixed(2) ?? '...'} V / Freq: ${selectedPoint.measurements?.oscilloscope?.freq?.toFixed(2) ?? '...'} Hz`
                                        : (selectedPoint.measurements && selectedPoint.measurements[selectedPoint.type] ? selectedPoint.measurements[selectedPoint.type]?.value : "---")
                                    }
                                </div>
                                {selectedPoint.type === 'oscilloscope' && (
                                    <Waveform
                                        pointData={selectedPoint}
                                        referenceData={referenceWaveform}
                                    />
                                )}
                                <button onClick={handleCapture} disabled={isCapturing} className={`w-full py-2 rounded font-bold flex items-center justify-center space-x-2 transition ${!isCapturing ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'}`}>
                                    {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                                    <span>{isCapturing ? t('ai_panel.measuring') : t('ai_panel.capture')}</span>
                                </button>
                            </div>

                            {/* --- Notes --- */}
                            <textarea
                                value={selectedPoint.notes || ''}
                                onChange={(e) => handlePointUpdate('notes', e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-gray-300 h-24 resize-none"
                                placeholder={t('ai_panel.tech_notes')}
                            />

                            {/* --- History --- */}
                            <div className="mt-4">
                                <h3 className="text-sm font-bold text-gray-400 flex items-center">
                                    <Clock size={14} className="mr-2" />
                                    {t('ai_panel.measurement_history')}
                                </h3>
                                <div className="bg-gray-900/70 rounded-lg p-2 space-y-2 max-h-48 overflow-y-auto">
                                    {history.length > 0 ? (
                                        history.map((m: MeasurementHistoryItem) => {
                                            // Handle various formats using safe JSON parsing
                                            const val = typeof m.value === 'string'
                                                ? safeJsonParse<string | MeasurementValue>(m.value, m.value)
                                                : m.value;
                                            const displayValue = typeof val === 'object' && val !== null
                                                ? ((val as MeasurementValue).value || 'Scope Data')
                                                : val;

                                            return (
                                                <div key={m.id || Math.random()} className="text-xs text-gray-300 bg-gray-800/50 p-2 rounded flex justify-between items-center">
                                                    <div>
                                                        <span className="font-mono">{String(displayValue)}</span>
                                                        <span className="text-gray-500 ml-2">
                                                            {m.created_at ? new Date(m.created_at).toLocaleString() : 'Just now'}
                                                        </span>
                                                    </div>
                                                    {m.type === 'oscilloscope' && m.value && (
                                                        <button
                                                            onClick={() => {
                                                                const parsedVal = typeof m.value === 'string'
                                                                    ? safeJsonParse<OscilloscopeData | null>(m.value, null)
                                                                    : m.value as OscilloscopeData;
                                                                if (parsedVal && 'waveform' in parsedVal) setReferenceWaveform(parsedVal);
                                                            }}
                                                            className="p-1 text-blue-400 hover:bg-blue-900/30 rounded"
                                                            title="Set as reference waveform"
                                                        >
                                                            <GitCommit size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center text-gray-500 text-xs py-4">{t('ai_panel.no_measurements')}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {points.length > 0 && activeTab === 'detail' && (
                <div className="p-4 border-t border-gray-700">
                    <button onClick={() => analyzeBoard(points)} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-2 rounded shadow-lg flex items-center justify-center space-x-2">
                        <Sparkles size={16} />
                        <span>{t('ai_panel.ai_diagnostics')}</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default AIPanel;
