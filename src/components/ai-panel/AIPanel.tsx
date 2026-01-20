import { useState, useEffect } from 'react';
import { Activity, Sparkles, LayoutList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../contexts/ProjectContext';
import { Logger } from '../../utils/logger';
import { PointDetails } from './PointDetails';
import PointsTable from '../PointsTable';
import { safePointAPI } from '../../utils/safeElectronAPI';
import type { InstrumentConfig, MeasurementValue, Point, ComparisonPoint, MeasurementHistoryItem } from '../../types';

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
        saveProject,
        currentProject
    } = useProject();

    const { setPoints, selectedPoint } = board;
    const { t } = useTranslation();

    const [history, setHistory] = useState<MeasurementHistoryItem[]>([]);
    const [referenceWaveform, setReferenceWaveform] = useState<MeasurementValue | undefined>(undefined);
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
        setReferenceWaveform(undefined);
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
            let actionKey = '';
            switch (value) {
                case 'voltage': actionKey = 'CONFIGURE_VOLTAGE'; break;
                case 'resistance': actionKey = 'CONFIGURE_RESISTANCE'; break;
                case 'diode': actionKey = 'CONFIGURE_DIODE'; break;
                case 'ground': actionKey = ''; break;
                case 'continuity': actionKey = 'CONFIGURE_CONTINUITY'; break;
            }

            if (actionKey && window.electronAPI?.instrumentExecute) {
                try {
                    log.debug(`Auto-configuring multimeter: ${actionKey}`);
                    await window.electronAPI.instrumentExecute('multimeter', actionKey);
                } catch (err) {
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
            const savedMeasurement = await addMeasurement(selectedPoint, measurement);
            if (savedMeasurement) {
                const newHistoryItem: MeasurementHistoryItem = {
                    type: savedMeasurement.type || selectedPoint.type,
                    value: savedMeasurement.value ?? savedMeasurement,
                    created_at: savedMeasurement.capturedAt || new Date().toISOString()
                };
                setHistory([newHistoryItem, ...history]);
            }
        }
    };

    return (
        <div className="w-82 bg-gray-800 border-l border-gray-700 flex flex-col z-20 shadow-xl">
            {/* Tab Header */}
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

            {/* Content */}
            {(activeTab === 'table' || mode === 'view') ? (
                <div className="flex-1 overflow-hidden h-full">
                    <PointsTable mode={mode} />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!selectedPoint ? (
                        <div className="text-gray-500 text-center mt-10 text-sm">{t('ai_panel.select_point')}</div>
                    ) : (
                        <PointDetails
                            selectedPoint={selectedPoint}
                            categories={(appSettings.categories || []).filter(cat =>
                                !cat.boardType || cat.boardType === currentProject?.board_type
                            )}
                            history={history}
                            isCapturing={isCapturing}
                            referenceWaveform={referenceWaveform}
                            onUpdatePoint={handlePointUpdate}
                            onDeletePoint={deletePoint}
                            onAskAboutPoint={askAboutPoint}
                            onCapture={handleCapture}
                            onOpenComparison={onOpenComparison}
                            onSetReferenceWaveform={setReferenceWaveform}
                        />
                    )}
                </div>
            )}

            {/* AI Diagnostics Button */}
            {points.length > 0 && activeTab === 'detail' && (
                <div className="p-4 border-t border-gray-700">
                    <button
                        onClick={() => analyzeBoard(points)}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-2 rounded shadow-lg flex items-center justify-center space-x-2"
                    >
                        <Sparkles size={16} />
                        <span>{t('ai_panel.ai_diagnostics')}</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default AIPanel;
