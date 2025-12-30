import React, { useState } from 'react';

const Waveform = ({ pointData, referenceData }) => {
    const oscilloscopeMeasurement = pointData?.measurements?.oscilloscope;

    if (!oscilloscopeMeasurement?.waveform) return null;

    const { waveform, timeScale, voltageScale, voltageOffset, vpp, freq } = oscilloscopeMeasurement;

    const svgWidth = 450, svgHeight = 360;
    const initialViewBox = { x: 0, y: 0, width: svgWidth, height: svgHeight };
    const [viewBox, setViewBox] = useState(initialViewBox);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const numDivX = 10, numDivY = 8;
    const stepX = svgWidth / numDivX, stepY = svgHeight / numDivY;

    // --- Grid Lines ---
    const gridLines = [];
    for (let i = 1; i < numDivX; i++) gridLines.push(<line key={`v${i}`} x1={i * stepX} y1="0" x2={i * stepX} y2={svgHeight} stroke="#4a5568" strokeWidth="0.5" strokeDasharray="2,2" />);
    for (let i = 1; i < numDivY; i++) gridLines.push(<line key={`h${i}`} x1="0" y1={i * stepY} x2={svgWidth} y2={i * stepY} stroke="#4a5568" strokeWidth="0.5" strokeDasharray="2,2" />);
    gridLines.push(<line key="ax" x1="0" y1={svgHeight / 2} x2={svgWidth} y2={svgHeight / 2} stroke="#718096" strokeWidth="0.5" />);
    gridLines.push(<line key="ay" x1={svgWidth / 2} y1="0" x2={svgWidth / 2} y2={svgHeight} stroke="#718096" strokeWidth="0.5" />);

    const vRange = numDivY * voltageScale;
    const vBottom = voltageOffset - (vRange / 2);

    // --- Live Waveform Path ---
    const pointsStr = waveform
        .map((val, i) => {
            const x = (i / (waveform.length - 1)) * svgWidth;
            const yPercent = vRange === 0 ? 0.5 : (val - vBottom) / vRange;
            const y = Math.max(0, Math.min(svgHeight, svgHeight - (yPercent * svgHeight)));
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');
        
    // --- Reference Waveform Path ---
    let referencePointsStr = '';
    if (referenceData && referenceData.waveform) {
        // We use the LIVE waveform's scaling to draw the reference waveform for accurate comparison
        referencePointsStr = referenceData.waveform
            .map((val, i) => {
                const x = (i / (referenceData.waveform.length - 1)) * svgWidth;
                const yPercent = vRange === 0 ? 0.5 : (val - vBottom) / vRange;
                const y = Math.max(0, Math.min(svgHeight, svgHeight - (yPercent * svgHeight)));
                return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(' ');
    }


    const handleWheel = (e) => {
        e.preventDefault();
        const svgElement = e.currentTarget;
        const { left, top, width, height } = svgElement.getBoundingClientRect();
        
        const mouseX = (e.clientX - left) / width * viewBox.width + viewBox.x;
        const mouseY = (e.clientY - top) / height * viewBox.height + viewBox.y;

        const scaleAmount = 0.1;
        const newScale = e.deltaY > 0 ? 1 + scaleAmount : 1 - scaleAmount;

        const newWidth = viewBox.width * newScale;
        const newHeight = viewBox.height * newScale;
        
        const clampedWidth = Math.max(svgWidth / 4, Math.min(newWidth, svgWidth * 4));
        const clampedHeight = Math.max(svgHeight / 4, Math.min(newHeight, svgHeight * 4));

        setViewBox({
            x: mouseX - (mouseX - viewBox.x) * newScale,
            y: mouseY - (mouseY - viewBox.y) * newScale,
            width: clampedWidth,
            height: clampedHeight,
        });
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const scaleX = viewBox.width / svgWidth;
        const scaleY = viewBox.height / svgHeight;
        setViewBox(prev => ({ ...prev, x: prev.x - dx * scaleX, y: prev.y - dy * scaleY }));
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => setIsDragging(false);

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
            <svg
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                className="bg-gray-900 border border-gray-700 rounded-lg w-full"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                {gridLines}
                {referencePointsStr && (
                    <polyline points={referencePointsStr} fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeDasharray="3,3" />
                )}
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
