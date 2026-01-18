import React from 'react';
import { MeasurementValue } from '../../types';

interface MiniWaveformProps {
    data: MeasurementValue;
}

const MiniWaveform: React.FC<MiniWaveformProps> = ({ data }) => {
    if (!data || !data.waveform || data.waveform.length === 0) return null;

    const points = data.waveform;
    const width = 120;
    const height = 30;

    let min = Infinity, max = -Infinity;
    for (const v of points) {
        if (v < min) min = v;
        if (v > max) max = v;
    }

    const range = max - min || 1;
    const pathPoints = points.map((val, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="bg-black/50 rounded border border-gray-600 mt-1 block">
            <polyline points={pathPoints} fill="none" stroke="#a78bfa" strokeWidth="1" />
        </svg>
    );
};

export default MiniWaveform;
