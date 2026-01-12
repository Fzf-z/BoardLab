import React, { useState } from 'react';
import { Upload, Activity, Zap, Cpu } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { MeasurementValue } from '../types';

interface MiniWaveformProps {
    data: MeasurementValue;
}

const MiniWaveform: React.FC<MiniWaveformProps> = ({ data }) => {
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

interface BoardViewProps {
    mode: 'view' | 'measure';
    currentProjectId?: number;
}

const BoardView: React.FC<BoardViewProps> = ({ mode, currentProjectId }) => {
    const { board } = useProject();
    const { 
        imageSrc, 
        points, 
        scale, 
        position, 
        handleWheel, 
        handleMouseDown, 
        handleMouseMove, 
        handleMouseUp, 
        handlePointMouseDown,
        handleImageClick, 
        selectedPointId, 
        setSelectedPointId, 
        containerRef 
    } = board;
    
    const [hoveredPointId, setHoveredPointId] = useState<number | string | null>(null);

    const renderTooltip = () => {
        if (!hoveredPointId) return null;
        const point = points.find(p => p.id === hoveredPointId);
        if (!point) return null;
        
        const hasMeasurements = point.measurements && Object.keys(point.measurements).length > 0;
        const screenX = position.x + (point.x * scale);
        const screenY = position.y + (point.y * scale);
        
        return (
            <div 
                className="absolute z-50 bg-gray-900/95 backdrop-blur-xs border border-gray-700 text-white p-3 rounded-lg shadow-2xl w-48 pointer-events-none"
                style={{ left: screenX + 20, top: screenY, transform: 'translateY(-50%)' }}
            >
                <div className="font-bold text-sm border-b border-gray-700 pb-1 mb-2 flex justify-between items-center text-blue-400">
                    {point.label || `Point ${point.id}`}
                </div>
                {!hasMeasurements ? <div className="text-xs text-gray-500 italic">No measurements yet</div> : (
                    <div className="space-y-2">
                        {['voltage', 'resistance', 'diode', 'oscilloscope'].map(type => {
                            if (!point.measurements) return null;
                            const data = point.measurements[type];
                            if (!data) return null;
                            
                            let icon = <Activity size={12} />;
                            let label = type;
                            let valueDisplay: React.ReactNode = typeof data.value === 'object' ? 'Waveform Saved' : data.value;
                            
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
        <div className="flex-1 bg-gray-950 overflow-hidden relative" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            {/* ... Grids ... */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ 
                    backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)', 
                    backgroundSize: `${20 * scale}px ${20 * scale}px`,
                    backgroundPosition: `${position.x}px ${position.y}px`
                }} 
            />

            {!imageSrc ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Upload size={48} className="mb-4 text-gray-600" />
                    <p className="text-lg">No board image loaded.</p>
                    <p className="text-sm mt-2">Create a new project or load one to begin.</p>
                </div>
            ) : (
                <div 
                    ref={containerRef}
                    className="w-full h-full relative overflow-hidden cursor-crosshair"
                    onWheel={handleWheel}
                    onMouseDown={(e) => handleMouseDown(e, mode)}
                    onClick={(e) => handleImageClick(e, mode, currentProjectId || null)}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <div 
                        style={{ 
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, 
                            transformOrigin: '0 0',
                            willChange: 'transform' // Optimization
                        }}
                        className="absolute top-0 left-0"
                    >
                        <img 
                            src={imageSrc} 
                            alt="Board" 
                            className="block max-w-none select-none shadow-2xl"
                            draggable={false}
                        />
                        
                        {/* Points Overlay */}
                        {points.map(point => {
                            const isSelected = selectedPointId === point.id;
                            const isHovered = hoveredPointId === point.id;
                            
                            // Determine color based on status (e.g., has measurements)
                            const hasMeas = point.measurements && Object.keys(point.measurements).length > 0;
                            let bgColor = hasMeas ? 'bg-blue-600/80' : 'bg-gray-600/80';
                            let borderColor = hasMeas ? 'border-blue-400' : 'border-gray-400';
                            
                            if (isSelected) {
                                bgColor = 'bg-yellow-500';
                                borderColor = 'border-white';
                            } else if (isHovered) {
                                bgColor = hasMeas ? 'bg-blue-500' : 'bg-gray-500';
                                borderColor = 'border-white';
                            }

                            return (
                                <div
                                    key={point.id}
                                    className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 flex items-center justify-center shadow-lg transition-transform ${bgColor} ${borderColor} ${isSelected ? 'scale-125 z-20' : 'z-10'}`}
                                    style={{ left: point.x, top: point.y, cursor: mode === 'measure' ? 'grab' : 'pointer' }}
                                    onMouseDown={(e) => mode === 'measure' && handlePointMouseDown(e, point.id)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPointId(point.id);
                                    }}
                                    onMouseEnter={() => setHoveredPointId(point.id)}
                                    onMouseLeave={() => setHoveredPointId(null)}
                                >
                                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                    
                                    {/* Label Tag */}
                                    <div className={`absolute left-full ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${isSelected ? 'bg-yellow-500 text-black' : 'bg-black/50 text-white'}`}>
                                        {point.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {renderTooltip()}

            {/* Scale Indicator */}
            <div className="absolute bottom-4 right-4 bg-black/60 px-2 py-1 rounded text-xs text-gray-400 pointer-events-none">
                Zoom: {Math.round(scale * 100)}%
            </div>
            
             {/* Mode Indicator Overlay */}
             {mode === 'measure' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg pointer-events-none border border-red-400 animate-pulse">
                    MEASUREMENT MODE
                </div>
            )}
        </div>
    );
};

export default BoardView;
