import React, { useState } from 'react';
import { Upload, Activity, Zap, Cpu } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

const MiniWaveform = ({ data }) => {
    // ... (MiniWaveform component remains the same)
    if (!data || !data.waveform || data.waveform.length === 0) return null;
    const points = data.waveform;
    const width = 120;
    const height = 30;
    let min = Infinity, max = -Infinity;
    for (let v of points) {
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

const BoardView = ({ mode }) => {
    const { board, currentProject } = useProject();
    const { 
        imageSrc, 
        points, 
        scale, 
        position, 
        handleWheel, 
        handleMouseDown, 
        handleMouseMove, 
        handleMouseUp, 
        handleImageClick, 
        selectedPointId, 
        isDragging, 
        setSelectedPointId, 
        containerRef 
    } = board;
    
    const [hoveredPointId, setHoveredPointId] = useState(null);

    const renderTooltip = () => {
        if (!hoveredPointId) return null;
        const point = points.find(p => p.id === hoveredPointId);
        if (!point) return null;
        // ... (renderTooltip logic remains the same)
        const hasMeasurements = point.measurements && Object.keys(point.measurements).length > 0;
        const screenX = position.x + (point.x * scale);
        const screenY = position.y + (point.y * scale);
        return (
            <div 
                className="absolute z-50 bg-gray-900/95 backdrop-blur-sm border border-gray-700 text-white p-3 rounded-lg shadow-2xl w-48 pointer-events-none"
                style={{ left: screenX + 20, top: screenY, transform: 'translateY(-50%)' }}
            >
                <div className="font-bold text-sm border-b border-gray-700 pb-1 mb-2 flex justify-between items-center text-blue-400">{point.label || `Point ${point.id}`}</div>
                {!hasMeasurements ? <div className="text-xs text-gray-500 italic">No measurements yet</div> : (
                    <div className="space-y-2">
                        {['voltage', 'resistance', 'diode', 'oscilloscope'].map(type => {
                            const data = point.measurements[type];
                            if (!data) return null;
                            let icon = <Activity size={12} />;
                            let label = type;
                            let valueDisplay = typeof data.value === 'object' ? 'Waveform Saved' : data.value;
                            if (type === 'voltage') { icon = <Zap size={12} className="text-yellow-400" />; label = 'Volt'; }
                            if (type === 'resistance') { icon = <Cpu size={12} className="text-green-400" />; label = 'Res'; }
                            if (type === 'diode') { icon = <Zap size={12} className="text-blue-400" />; label = 'Diode'; }
                            if (type === 'oscilloscope') { 
                                icon = <Activity size={12} className="text-purple-400" />; 
                                label = 'Scope'; 
                                if (data.vpp) valueDisplay = `${data.vpp.toFixed(2)}Vpp`;
                            }
                            return (
                                <div key={type} className="flex flex-col mb-1 last:mb-0">
                                    <div className="flex justify-between items-center text-xs">
                                        <div className="flex items-center text-gray-400">
                                            <span className="mr-1">{icon}</span>
                                            <span className="capitalize">{label}</span>
                                        </div>
                                        <div className="font-mono font-bold">{valueDisplay}</div>
                                    </div>
                                    {type === 'oscilloscope' && <MiniWaveform data={data} />}
                                </div>
                            );
                        })}
                        {point.notes && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                                <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Notes</div>
                                <div className="text-xs text-gray-300 italic line-clamp-3">{point.notes}</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 relative bg-gray-950 overflow-hidden select-none">
            <div
                ref={containerRef}
                className="w-full h-full"
                onWheel={handleWheel}
                onMouseDown={(e) => handleMouseDown(e, mode)}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onContextMenu={(e) => { if (e.cancelable) e.preventDefault(); }}
                style={{ cursor: isDragging ? 'grabbing' : mode === 'measure' ? 'crosshair' : 'grab' }}
            >
                <div
                    className="absolute origin-top-left"
                    style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
                >
                    {imageSrc ? (
                        <img src={imageSrc} className="max-w-none shadow-2xl pointer-events-none" alt="Board" />
                    ) : (
                        <div className="w-[800px] h-[600px] bg-gray-900 flex items-center justify-center border-2 border-dashed border-gray-700 rounded-xl">
                            <div className="text-gray-500 text-center">
                                <Upload size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Sube una imagen de la placa para comenzar</p>
                            </div>
                        </div>
                    )}

                    <div
                        className="absolute inset-0 z-10"
                        onClick={(e) => handleImageClick(e, mode, currentProject?.id)}
                    />

                    {points.map(p => (
                        <div
                            key={p.id}
                            onMouseEnter={() => setHoveredPointId(p.id)}
                            onMouseLeave={() => setHoveredPointId(null)}
                            onClick={(e) => { e.stopPropagation(); if (!isDragging) setSelectedPointId(p.id); }}
                            className={`absolute px-2 py-0.5 rounded shadow-lg flex items-center justify-center cursor-pointer transition z-20 transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 whitespace-nowrap ${selectedPointId === p.id ? 'bg-yellow-400 border-2 border-black text-black' : p.measurements && Object.keys(p.measurements).length > 0 ? 'bg-green-500 border border-white text-white' : 'bg-red-500 border border-white text-white'}`}
                            style={{ left: p.x, top: p.y }}
                        >
                            <span className="text-xs font-bold">{p.label || (typeof p.id === 'number' ? p.id : 'N')}</span>
                        </div>
                    ))}
                </div>
                {renderTooltip()}
            </div>
        </div>
    );
};

export default BoardView;