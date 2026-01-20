import { Clock, GitCommit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { safeJsonParse } from '../../utils/safeJson';
import type { MeasurementValue, MeasurementHistoryItem } from '../../types';

interface MeasurementHistoryProps {
    history: MeasurementHistoryItem[];
    onSetReferenceWaveform: (waveform: MeasurementValue) => void;
}

export const MeasurementHistory: React.FC<MeasurementHistoryProps> = ({
    history,
    onSetReferenceWaveform
}) => {
    const { t } = useTranslation();

    return (
        <div className="mt-4">
            <h3 className="text-sm font-bold text-gray-400 flex items-center">
                <Clock size={14} className="mr-2" />
                {t('ai_panel.measurement_history')}
            </h3>
            <div className="bg-gray-900/70 rounded-lg p-2 space-y-2 max-h-48 overflow-y-auto">
                {history.length > 0 ? (
                    history.map((m: MeasurementHistoryItem) => {
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
                                                ? safeJsonParse<MeasurementValue | undefined>(m.value, undefined)
                                                : m.value as MeasurementValue;
                                            if (parsedVal && typeof parsedVal === 'object' && 'waveform' in parsedVal) {
                                                onSetReferenceWaveform(parsedVal);
                                            }
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
    );
};

export default MeasurementHistory;
