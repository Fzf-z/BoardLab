import React from 'react';
import { MeasurementValue } from '../types';

interface WaveformThumbnailProps {
    measurement?: MeasurementValue;
    width?: number;
    height?: number;
}

const WaveformThumbnail: React.FC<WaveformThumbnailProps> = ({ measurement, width = 120, height = 60 }) => {
    if (!measurement || !measurement.waveform || measurement.waveform.length === 0) {
        return <div style={{ width, height }} className="bg-gray-800 flex items-center justify-center text-xs text-gray-500 border border-gray-700 rounded">No Data</div>;
    }

    const { waveform, voltageScale = 1, voltageOffset = 0 } = measurement;
    
    // We assume waveform is an array of voltage values
    // We need to map these to SVG coordinates [0, width] x [0, height]
    
    // Rigol driver returns actual voltage values.
    // The scope screen usually has 8 vertical divisions.
    // Range is 8 * voltageScale.
    // Center is voltageOffset.
    
    const numDivY = 8;
    const vRange = numDivY * voltageScale;
    const vBottom = voltageOffset - (vRange / 2);
    // const vTop = voltageOffset + (vRange / 2);
    
    const pointsStr = waveform.map((val, i) => {
        const x = (i / (waveform.length - 1)) * width;
        
        // Normalize val to 0-1 range within the view
        // val = vBottom -> y = height
        // val = vTop -> y = 0
        const yPercent = (val - vBottom) / vRange;
        // Invert Y because SVG 0 is top
        const y = Math.max(0, Math.min(height, height - (yPercent * height)));
        
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return (
        <div className="relative group" style={{ width, height }}>
             <svg width={width} height={height} className="bg-gray-900 border border-gray-600 rounded">
                {/* Simple Grid */}
                <line x1={0} y1={height/2} x2={width} y2={height/2} stroke="#374151" strokeWidth="1" strokeDasharray="2,2" />
                <line x1={width/2} y1={0} x2={width/2} y2={height} stroke="#374151" strokeWidth="1" strokeDasharray="2,2" />
                
                <polyline 
                    points={pointsStr} 
                    fill="none" 
                    stroke="#3b82f6" 
                    strokeWidth="1.5" 
                />
            </svg>
            {/* Hover Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs p-2 rounded z-50 whitespace-nowrap border border-gray-600 shadow-xl">
                Vpp: {measurement.vpp?.toFixed(2)}V | Freq: {measurement.freq?.toFixed(0)}Hz
            </div>
        </div>
    );
};

export default WaveformThumbnail;
