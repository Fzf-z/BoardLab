import React, { useState, useEffect } from 'react';
import { Upload, Activity, Zap, Cpu, Link as LinkIcon, Copy } from 'lucide-react';
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
    const { board, appSettings, addPoint } = useProject();
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
    const [labelOffsets, setLabelOffsets] = useState<Record<string | number, {x: number, y: number}>>({});
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, pointId: number | string } | null>(null);

    const getEffectivePoint = (point: any) => {
        if (point.parentPointId) {
            return points.find(p => p.id === point.parentPointId) || point;
        }
        return point;
    };

    const handleDuplicatePoint = (originalPointId: number | string) => {
        const originalPoint = points.find(p => p.id === originalPointId);
        if (!originalPoint) return;

        const parentId = originalPoint.parentPointId || originalPoint.id;

        const newPoint = {
            id: `temp-${Date.now()}`,
            x: originalPoint.x + 20,
            y: originalPoint.y + 20,
            label: originalPoint.label,
            parentPointId: parentId,
            measurements: {}, 
            side: originalPoint.side || 'A',
            type: originalPoint.type,
            category: originalPoint.category
        };

        addPoint(newPoint);
        setContextMenu(null);
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Collision Resolution for Labels
    useEffect(() => {
        if (points.length === 0) {
            setLabelOffsets({});
            return;
        }

        const runLayout = () => {
            const pointSize = appSettings.pointSize || 24;
            const nodes = points.map(p => ({
                id: p.id,
                x: p.x,
                y: p.y,
                // Initial Label Position (Right side)
                lx: p.x + (pointSize / 2) + 5 + (p.label.length * 3), // Center of label approx
                ly: p.y,
                width: Math.max(20, p.label.length * 7), // Est width
                height: 14
            }));

            // Iterations
            for (let i = 0; i < 20; i++) {
                // 1. Repel from other labels
                for (let a = 0; a < nodes.length; a++) {
                    const nodeA = nodes[a];
                    for (let b = a + 1; b < nodes.length; b++) {
                        const nodeB = nodes[b];
                        
                        const dx = nodeA.lx - nodeB.lx;
                        const dy = nodeA.ly - nodeB.ly;
                        const distX = Math.abs(dx);
                        const distY = Math.abs(dy);
                        
                        const minSpacingX = (nodeA.width + nodeB.width) / 2 + 2; // + padding
                        const minSpacingY = (nodeA.height + nodeB.height) / 2 + 2;

                        if (distX < minSpacingX && distY < minSpacingY) {
                            // Overlap Detected
                            
                            // Vector repulsion (360 degrees) instead of Axis-Aligned
                            let fx = dx;
                            let fy = dy;

                            // Add jitter if perfect overlap to break symmetry
                            if (Math.abs(fx) < 0.1 && Math.abs(fy) < 0.1) {
                                const angle = Math.random() * Math.PI * 2;
                                fx = Math.cos(angle);
                                fy = Math.sin(angle);
                            }

                            // Normalize vector
                            const len = Math.hypot(fx, fy);
                            if (len > 0) {
                                const nx = fx / len;
                                const ny = fy / len;

                                // Repulsion strength based on depth of overlap
                                // We want a soft push that resolves over iterations
                                const pushFactor = 1.0; 

                                nodeA.lx += nx * pushFactor;
                                nodeA.ly += ny * pushFactor;
                                nodeB.lx -= nx * pushFactor;
                                nodeB.ly -= ny * pushFactor;
                            }
                        }
                    }

                    // 2. Repel from Points (Markers) - Omni-directional & Clearance Guaranteed
                    for (let pIdx = 0; pIdx < nodes.length; pIdx++) {
                        const point = nodes[pIdx];
                        
                        const dx = nodeA.lx - point.x;
                        const dy = nodeA.ly - point.y;
                        let dist = Math.hypot(dx, dy);
                        
                        // Handle extremely close center overlap with random push
                        let nx = dx;
                        let ny = dy;
                        if (dist < 0.1) {
                            const angle = Math.random() * Math.PI * 2;
                            nx = Math.cos(angle);
                            ny = Math.sin(angle);
                            dist = 0.1;
                        } else {
                            nx /= dist;
                            ny /= dist;
                        }

                        // Calculate effective "radius" of the label box at this specific angle.
                        // We treat the label as a rectangle (w, h) and the point as a circle (r).
                        // We want to push the label center along (nx, ny) until the circle doesn't touch the rectangle.
                        
                        const w2 = nodeA.width / 2;
                        const h2 = nodeA.height / 2;
                        const pRadius = (pointSize / 2) + 4; // Margin

                        // Ray-Box Intersection logic to find distance from center to edge of box along vector
                        // distX = distance to vertical edge (x = w2)
                        // distY = distance to horizontal edge (y = h2)
                        const absNx = Math.abs(nx);
                        const absNy = Math.abs(ny);
                        
                        const distToEdgeX = absNx > 0.001 ? w2 / absNx : Infinity;
                        const distToEdgeY = absNy > 0.001 ? h2 / absNy : Infinity;
                        
                        // Distance from label center to its own edge along the vector (nx, ny) pointing INWARDS to point
                        // Wait, vector (nx, ny) is from Point -> Label.
                        // So we look at the Label's boundary relative to its center in direction -(nx, ny).
                        // Since box is symmetric, it's the same distance.
                        
                        const distToBoxEdge = Math.min(distToEdgeX, distToEdgeY);
                        
                        // Required center-to-center distance = (Distance from LabelCenter to LabelEdge) + PointRadius
                        const requiredDist = distToBoxEdge + pRadius;

                        if (dist < requiredDist) {
                            // Push radially outwards to meet requirement
                            const push = requiredDist - dist;
                            nodeA.lx += nx * push * 0.8; // Apply most of the push immediately
                            nodeA.ly += ny * push * 0.8;
                        }
                    }
                    
                    // 3. Spring force to anchor (Pull back to optimal radius)
                    const tx = nodeA.x; 
                    const ty = nodeA.y;
                    const dx = nodeA.lx - tx;
                    const dy = nodeA.ly - ty;
                    const currentDist = Math.hypot(dx, dy);
                    const targetDist = (pointSize / 2) + (nodeA.width / 2) + 10;
                    
                    // Pull towards optimal radius, but maintain angle (orbit)
                    if (currentDist > targetDist) {
                        const pullFactor = 0.02; // Gentle pull
                        nodeA.lx -= dx * pullFactor;
                        nodeA.ly -= dy * pullFactor;
                    } else if (currentDist < targetDist * 0.5) {
                         // Too close? Push out (handled by point repulsion above, but this helps)
                         // nodeA.lx += dx * 0.05;
                         // nodeA.ly += dy * 0.05;
                    }
                }
            }

            // Convert back to offsets relative to point center
            const newOffsets: Record<string | number, {x: number, y: number}> = {};
            nodes.forEach(n => {
                newOffsets[n.id] = {
                    x: n.lx - n.x,
                    y: n.ly - n.y
                };
            });
            setLabelOffsets(newOffsets);
        };

        // Debounce to avoid heavy calc on every minor change, though points change rarely
        const timer = setTimeout(runLayout, 10);
        return () => clearTimeout(timer);

    }, [points, appSettings.pointSize]);

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
        
        const effectivePoint = getEffectivePoint(point);
        const isReplica = !!point.parentPointId;
        const hasMeasurements = effectivePoint.measurements && Object.keys(effectivePoint.measurements).length > 0;
        
        const screenX = position.x + (point.x * scale);
        const screenY = position.y + (point.y * scale);
        
        return (
            <div 
                className="absolute z-50 bg-gray-900/95 backdrop-blur-xs border border-gray-700 text-white p-3 rounded-lg shadow-2xl w-48 pointer-events-none"
                style={{ left: screenX + 20, top: screenY, transform: 'translateY(-50%)' }}
            >
                <div className="font-bold text-sm border-b border-gray-700 pb-1 mb-2 flex justify-between items-center text-blue-400">
                     <span className="flex items-center gap-2">
                        {isReplica && <LinkIcon size={12} className="text-gray-400" />}
                        {effectivePoint.label || `Point ${effectivePoint.id}`}
                    </span>
                    {isReplica && <span className="text-[10px] bg-gray-700 px-1 rounded text-gray-300">LINKED</span>}
                </div>
                {!hasMeasurements ? <div className="text-xs text-gray-500 italic">No measurements yet</div> : (
                    <div className="space-y-2">
                        {['voltage', 'resistance', 'diode', 'oscilloscope'].map(type => {
                            if (!effectivePoint.measurements) return null;
                            const data = effectivePoint.measurements[type];
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
                            willChange: 'transform',
                            backfaceVisibility: 'hidden', // Optimization: GPU Layer
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
                                    decoding="async" // Optimization: Async Decode
                                    loading="eager"
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
                                        decoding="async" // Optimization: Async Decode
                                        loading="eager"
                                    />
                                    <div className="absolute top-2 left-14 bg-purple-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">Side B</div>
                                </div>
                            )}
                        </div>
                        
                        {/* Points Overlay */}
                        {points.map(point => {
                            const effectivePoint = getEffectivePoint(point);
                            const isReplica = !!point.parentPointId;
                            const isSelected = selectedPointId === point.id;
                            const isHovered = hoveredPointId === point.id;
                            
                            const hasMeas = effectivePoint.measurements && Object.keys(effectivePoint.measurements).length > 0;
                            
                            const size = appSettings.pointSize || 24;
                            let defaultColor = appSettings.pointColor || '#4b5563';
                            
                            // Use category color if defined
                            if (effectivePoint.category && appSettings.categories) {
                                const cat = appSettings.categories.find(c => c.id === effectivePoint.category);
                                if (cat) defaultColor = cat.color;
                            }
                            
                            const finalColor = isSelected ? '#eab308' : defaultColor;

                            // Label Layout
                            const offset = labelOffsets[point.id] || { x: size/2 + 5 + 10, y: 0 }; // Default right
                            const labelX = offset.x;
                            const labelY = offset.y;
                            
                            // Determine if we need a leader line (if label is far from center)
                            const dist = Math.hypot(labelX, labelY);
                            const showLeader = dist > (size/2 + 15);

                            const pointStyle: React.CSSProperties = {
                                left: point.x, 
                                top: point.y, 
                                width: `${size}px`,
                                height: `${size}px`,
                                marginLeft: `-${size/2}px`,
                                marginTop: `-${size/2}px`,
                                cursor: mode === 'measure' ? 'grab' : 'pointer',
                                backgroundColor: finalColor,
                                borderStyle: isReplica ? 'dashed' : 'solid',
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
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setContextMenu({ x: e.clientX, y: e.clientY, pointId: point.id });
                                    }}
                                    onMouseEnter={() => setHoveredPointId(point.id)}
                                    onMouseLeave={() => setHoveredPointId(null)}
                                >
                                    <div className="bg-white rounded-full" style={{ width: size/4, height: size/4 }} />
                                    
                                    {isReplica && (
                                        <div className="absolute -top-1 -right-1 bg-gray-800 rounded-full p-[1px] border border-gray-600">
                                            <LinkIcon size={8} className="text-white" />
                                        </div>
                                    )}

                                    {/* Leader Line */}
                                    {showLeader && (
                                        <svg className="absolute overflow-visible pointer-events-none" style={{ left: '50%', top: '50%' }}>
                                            <line 
                                                x1={0} y1={0} 
                                                x2={labelX} y2={labelY} 
                                                stroke="rgba(255,255,255,0.5)" 
                                                strokeWidth="1.5" 
                                            />
                                        </svg>
                                    )}

                                    {/* Label Tag */}
                                    <div 
                                        className={`absolute px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap pointer-events-none ${isSelected ? 'bg-yellow-500 text-black' : 'bg-black/50 text-white'}`}
                                        style={{
                                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                                            // left/top 50% relative to parent (point center)
                                            left: '50%',
                                            top: '50%'
                                        }}
                                    >
                                        {effectivePoint.label}
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
                    imageSrcB={imageSrcB}
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

            {/* Context Menu */}
            {contextMenu && (
                <div 
                    className="fixed z-[100] bg-gray-800 border border-gray-600 rounded shadow-xl py-1 w-48 backdrop-blur-sm text-gray-200"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button 
                        className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2 text-sm"
                        onClick={() => handleDuplicatePoint(contextMenu.pointId)}
                    >
                        <Copy size={14} />
                        <span>Duplicate / Link Point</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default BoardView;
