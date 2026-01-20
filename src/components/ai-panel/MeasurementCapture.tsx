import { Wifi, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Waveform from '../Waveform';
import type { Point, MeasurementValue } from '../../types';

interface MeasurementCaptureProps {
    selectedPoint: Point;
    isCapturing: boolean;
    onCapture: () => void;
    statusColor: string;
    referenceWaveform?: MeasurementValue;
}

export const MeasurementCapture: React.FC<MeasurementCaptureProps> = ({
    selectedPoint,
    isCapturing,
    onCapture,
    statusColor,
    referenceWaveform
}) => {
    const { t } = useTranslation();

    const displayValue = selectedPoint.type === 'oscilloscope'
        ? `Vpp: ${selectedPoint.measurements?.oscilloscope?.vpp?.toFixed(2) ?? '...'} V / Freq: ${selectedPoint.measurements?.oscilloscope?.freq?.toFixed(2) ?? '...'} Hz`
        : (selectedPoint.measurements && selectedPoint.measurements[selectedPoint.type] ? selectedPoint.measurements[selectedPoint.type]?.value : "---");

    return (
        <div className="bg-black/40 rounded-lg p-4 border border-gray-700">
            <div className={`text-2xl font-mono font-bold mb-1 ${statusColor}`}>
                {displayValue}
            </div>
            {selectedPoint.type === 'oscilloscope' && (
                <Waveform
                    pointData={selectedPoint}
                    referenceData={referenceWaveform}
                />
            )}
            <button
                onClick={onCapture}
                disabled={isCapturing}
                className={`w-full py-2 rounded font-bold flex items-center justify-center space-x-2 transition ${!isCapturing ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'}`}
            >
                {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                <span>{isCapturing ? t('ai_panel.measuring') : t('ai_panel.capture')}</span>
            </button>
        </div>
    );
};

export default MeasurementCapture;
