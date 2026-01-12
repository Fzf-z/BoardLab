import React, { useState, MouseEvent, WheelEvent } from 'react';
import { Point, MeasurementValue } from '../types';

interface WaveformProps {
    pointData: Point;
    referenceData?: MeasurementValue;
}

interface ViewBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

const Waveform: React.FC<WaveformProps> = ({ pointData, referenceData }) => {
    const oscilloscopeMeasurement = pointData?.measurements?.oscilloscope;

    if (!oscilloscopeMeasurement?.waveform) return null;

    const { waveform, timeScale, voltageScale, voltageOffset, vpp, freq } = oscilloscopeMeasurement;

    const svgWidth = 450, svgHeight = 360;
    const initialViewBox: ViewBox = { x: 0, y: 0, width: svgWidth, height: svgHeight };
    const [viewBox, setViewBox] = useState<ViewBox>(initialViewBox);
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

    const vRange = numDivY * (voltageScale || 1);
    const vBottom = (voltageOffset || 0) - (vRange / 2);

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
                const x = (i / (referenceData.waveform!.length - 1)) * svgWidth;
                const yPercent = vRange === 0 ? 0.5 : (val - vBottom) / vRange;
                const y = Math.max(0, Math.min(svgHeight, svgHeight - (yPercent * svgHeight)));
                return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(' ');
    }


    const handleWheel = (e: WheelEvent<SVGSVGElement>) => {
        // @ts-ignore: React types issue with preventDefault on some events
        if (e.cancelable) e.preventDefault();
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

    const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const scaleX = viewBox.width / svgWidth;
        const scaleY = viewBox.height / svgHeight;
        setViewBox(prev => ({ ...prev, x: prev.x - dx * scaleX, y: prev.y - dy * scaleY }));
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => setIsDragging(false);

    const formatUnits = (value: number | undefined, unit: string) => {
        if (value === null || typeof value === 'undefined' || Math.abs(value) > 1e12) return `--- ${unit}`;
        if (value === 0) return `0.00 ${unit}`;
        const absValue = Math.abs(value);
        const prefixes = [{ p: 'G', v: 1e9 }, { p: 'M', v: 1e6 }, { p: 'k', v: 1e3 }, { p: '', v: 1 }, { p: 'm', v: 1e-3 }, { p: 'µ', v: 1e-6 }, { p: 'n', v: 1e-9 }];
        
        const prefix = prefixes.find(p => absValue >= p.v) || prefixes[prefixes.length - 1];
        return `${(value / prefix.v).toFixed(2)} ${prefix.p}${unit}`;
    };

    return (
        <div className="relative mt-2 border border-gray-700 bg-gray-900 rounded overflow-hidden select-none">
            <svg 
                width="100%" 
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                className="block cursor-move"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#1a202c" />
                {gridLines}
                <polyline points={pointsStr} fill="none" stroke="#63b3ed" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                {referencePointsStr && (
                    <polyline points={referencePointsStr} fill="none" stroke="#f6ad55" strokeWidth="2" strokeDasharray="4,4" vectorEffect="non-scaling-stroke" opacity="0.7" />
                )}
            </svg>
            
            <div className="absolute top-2 left-2 bg-black/70 p-2 rounded text-[10px] text-gray-300 font-mono space-y-1 pointer-events-none">
                <div className="text-cyan-400 font-bold">CH1 (Live)</div>
                <div>Scale: {formatUnits(voltageScale, 'V')}/div</div>
                <div>Time: {formatUnits(timeScale, 's')}/div</div>
                <div>Offset: {formatUnits(voltageOffset, 'V')}</div>
                <div className="border-t border-gray-600 pt-1 mt-1">
                    <div>Vpp: {formatUnits(vpp, 'V')}</div>
                    <div>Freq: {formatUnits(freq, 'Hz')}</div>
                </div>
            </div>

            {referenceData && (
                <div className="absolute top-2 right-2 bg-black/70 p-2 rounded text-[10px] text-gray-300 font-mono space-y-1 pointer-events-none border border-orange-500/30">
                    <div className="text-orange-400 font-bold">REF (Saved)</div>
                    <div>Scale: {formatUnits(voltageScale, 'V')}/div</div> {/* Using live scale as ref is drawn on live scale */}
                    <div className="border-t border-gray-600 pt-1 mt-1">
                        <div>Vpp: {formatUnits(referenceData.vpp, 'V')}</div>
                        <div>Freq: {formatUnits(referenceData.freq, 'Hz')}</div>
                    </div>
                </div>
            )}
            
            <div className="absolute bottom-1 right-2 text-[9px] text-gray-500 pointer-events-none">
                Scroll to Zoom • Drag to Pan
            </div>
        </div>
    );
};

export default Waveform;
