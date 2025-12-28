import React from 'react';

const Waveform = ({ pointData }) => {
    if (!pointData?.waveform) return null;

    const { waveform, timeScale, voltageScale, voltageOffset, vpp, freq } = pointData;

    const svgWidth = 250, svgHeight = 160;
    const numDivX = 10, numDivY = 8;
    const stepX = svgWidth / numDivX, stepY = svgHeight / numDivY;

    const gridLines = [];
    for (let i = 1; i < numDivX; i++) gridLines.push(<line key={`v${i}`} x1={i * stepX} y1="0" x2={i * stepX} y2={svgHeight} stroke="#4a5568" strokeWidth="0.5" strokeDasharray="2,2" />);
    for (let i = 1; i < numDivY; i++) gridLines.push(<line key={`h${i}`} x1="0" y1={i * stepY} x2={svgWidth} y2={i * stepY} stroke="#4a5568" strokeWidth="0.5" strokeDasharray="2,2" />);
    gridLines.push(<line key="ax" x1="0" y1={svgHeight / 2} x2={svgWidth} y2={svgHeight / 2} stroke="#718096" strokeWidth="0.5" />);
    gridLines.push(<line key="ay" x1={svgWidth / 2} y1="0" x2={svgWidth / 2} y2={svgHeight} stroke="#718096" strokeWidth="0.5" />);

    const vRange = numDivY * voltageScale;
    const vBottom = voltageOffset - (vRange / 2);
    const pointsStr = waveform
        .map((val, i) => {
            const x = (i / (waveform.length - 1)) * svgWidth;
            const yPercent = vRange === 0 ? 0.5 : (val - vBottom) / vRange;
            const y = Math.max(0, Math.min(svgHeight, svgHeight - (yPercent * svgHeight)));
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');

    const formatUnits = (value, unit) => {
        if (value === null || typeof value === 'undefined' || value > 1e12) return `--- ${unit}`;
        if (value === 0) return `0.00 ${unit}`;
        const absValue = Math.abs(value);
        const prefixes = [{ p: 'G', v: 1e9 }, { p: 'M', v: 1e6 }, { p: 'k', v: 1e3 }, { p: '', v: 1 }, { p: 'm', v: 1e-3 }, { p: 'µ', v: 1e-6 }, { p: 'n', v: 1e-9 }];
        const prefix = prefixes.find(pr => absValue >= pr.v) || { p: '', v: 1 };
        return `${(value / prefix.v).toFixed(2)} ${prefix.p}${unit}`;
    }

    return (
        <div className="mt-2 space-y-2">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="bg-gray-900 border border-gray-700 rounded-lg w-full">
                {gridLines}
                <polyline points={pointsStr} fill="none" stroke="#10b981" strokeWidth="1.5" />
            </svg>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-gray-900 p-2 rounded-lg border border-gray-700 text-[10px] font-mono">
                <div className="text-gray-400">Time/div: <span className="font-bold text-white">{formatUnits(timeScale, 's')}</span></div>
                <div className="text-gray-400">V/div: <span className="font-bold text-white">{formatUnits(voltageScale, 'V')}</span></div>
                <div className="text-gray-400">Vpp: <span className="font-bold text-cyan-400">{formatUnits(vpp, 'V')}</span></div>
                <div className="text-gray-400">Freq: <span className="font-bold text-cyan-400">{formatUnits(freq, 'Hz')}</span></div>
            </div>
        </div>
    );
};

export default Waveform;
