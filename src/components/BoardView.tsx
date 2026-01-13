import React, { useState, useEffect } from 'react';
import { Upload, Activity, Zap, Cpu } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { MeasurementValue } from '../types';
import Minimap from './Minimap';

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
    const { board, appSettings } = useProject();
    const { 
        imageSrc,
        imageSrcB, 
        imageDimensions,
        points, 
        scale, 
        position, 
        setPosition,
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
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        
        const updateSize = () => {
            if (containerRef.current) {
                setContainerSize({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(containerRef.current);
        updateSize();

        return () => resizeObserver.disconnect();
    }, [containerRef, imageSrc]);

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
                        <div className="relative flex">
                            {/* Side A */}
                            <div className="relative">
                                <img 
                                    src={imageSrc} 
                                    alt="Board Side A" 
                                    className="block max-w-none select-none shadow-2xl"
                                    draggable={false}
                                />
                                <div className="absolute top-2 left-2 bg-blue-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">Side A</div>
                            </div>

                            {/* Side B (if exists) */}
                            {imageSrcB && (
                                <div className="relative ml-12 border-l-2 border-dashed border-gray-700 pl-12">
                                    <img 
                                        src={imageSrcB} 
                                        alt="Board Side B" 
                                        className="block max-w-none select-none shadow-2xl"
                                        draggable={false}
                                    />
                                    <div className="absolute top-2 left-14 bg-purple-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">Side B</div>
                                </div>
                            )}
                        </div>
                        
                        {/* Points Overlay */}
                        {points.map(point => {
                            const isSelected = selectedPointId === point.id;
                            const isHovered = hoveredPointId === point.id;
                            
                            const hasMeas = point.measurements && Object.keys(point.measurements).length > 0;
                            
                            const size = appSettings.pointSize || 24;
                            let defaultColor = appSettings.pointColor || '#4b5563';
                            
                            // Use category color if defined
                            if (point.category && appSettings.categories) {
                                const cat = appSettings.categories.find(c => c.id === point.category);
                                if (cat) defaultColor = cat.color;
                            }
                            
                            // Dynamic Styles
                            // Priority: Selected > Measured (Blue) > Category Color
                            // Actually, maybe we want Category color to persist even if measured?
                            // Let's make measured state an indicator (border or inner dot) instead of full color override
                            // Or: keep full override for 'measured' if that's preferred.
                            // User request: "ver con el color de su categoria si corresponde".
                            // So let's prioritize category color over "measured blue".
                            
                            const finalColor = isSelected ? '#eab308' : defaultColor;

                            const pointStyle: React.CSSProperties = {
                                left: point.x, 
                                top: point.y, 
                                width: `${size}px`,
                                height: `${size}px`,
                                marginLeft: `-${size/2}px`,
                                marginTop: `-${size/2}px`,
                                cursor: mode === 'measure' ? 'grab' : 'pointer',
                                backgroundColor: finalColor,
                                borderColor: isSelected || isHovered ? 'white' : (hasMeas ? '#60a5fa' : '#9ca3af'),
                                borderWidth: hasMeas ? '3px' : '2px', // Make border thicker if measured
                                transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                                zIndex: isSelected ? 20 : 10
                            };

                            return (
                                <div
                                    key={point.id}
                                    className={`absolute rounded-full border-2 flex items-center justify-center shadow-lg transition-transform`}
                                    style={pointStyle}
                                    onMouseDown={(e) => mode === 'measure' && handlePointMouseDown(e, point.id)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPointId(point.id);
                                    }}
                                    onMouseEnter={() => setHoveredPointId(point.id)}
                                    onMouseLeave={() => setHoveredPointId(null)}
                                >
                                    <div className="bg-white rounded-full" style={{ width: size/4, height: size/4 }} />
                                    
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

            {imageSrc && (
                <Minimap 
                    imageSrc={imageSrc}
                    imageDimensions={imageDimensions}
                    scale={scale}
                    position={position}
                    setPosition={setPosition}
                    containerDimensions={containerSize}
                />
            )}

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
