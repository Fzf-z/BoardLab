import React, { useState, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { Point } from '../types';
import Minimap from './Minimap';
import { PointTooltip, PointMarker, BoardContextMenu } from './board';

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
    const [labelOffsets, setLabelOffsets] = useState<Record<string | number, { x: number, y: number }>>({});
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, pointId: number | string } | null>(null);

    const getEffectivePoint = (point: Point): Point => {
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

    // Close context menu on click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Optimized Collision Resolution for Labels using Spatial Hashing
    useEffect(() => {
        if (points.length === 0) {
            setLabelOffsets({});
            return;
        }

        const runLayout = () => {
            const pointSize = appSettings.pointSize || 24;
            const CELL_SIZE = 100;
            const ITERATIONS = Math.min(15, 5 + Math.floor(points.length / 20));

            const nodes = points.map(p => ({
                id: p.id,
                x: p.x,
                y: p.y,
                lx: p.x + (pointSize / 2) + 5 + (p.label.length * 3),
                ly: p.y,
                width: Math.max(20, p.label.length * 7),
                height: 14
            }));

            // Skip heavy computation for very large point sets
            if (nodes.length > 500) {
                const newOffsets: Record<string | number, { x: number, y: number }> = {};
                nodes.forEach(n => {
                    newOffsets[n.id] = { x: n.lx - n.x, y: n.ly - n.y };
                });
                setLabelOffsets(newOffsets);
                return;
            }

            const getCellKey = (x: number, y: number) =>
                `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;

            const getNearbyCellKeys = (x: number, y: number): string[] => {
                const cx = Math.floor(x / CELL_SIZE);
                const cy = Math.floor(y / CELL_SIZE);
                const keys: string[] = [];
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        keys.push(`${cx + dx},${cy + dy}`);
                    }
                }
                return keys;
            };

            for (let iter = 0; iter < ITERATIONS; iter++) {
                const spatialHash = new Map<string, number[]>();
                nodes.forEach((node, idx) => {
                    const key = getCellKey(node.lx, node.ly);
                    if (!spatialHash.has(key)) spatialHash.set(key, []);
                    spatialHash.get(key)!.push(idx);
                });

                for (let a = 0; a < nodes.length; a++) {
                    const nodeA = nodes[a];
                    const nearbyKeys = getNearbyCellKeys(nodeA.lx, nodeA.ly);
                    const checkedIndices = new Set<number>();

                    for (const key of nearbyKeys) {
                        const cellNodes = spatialHash.get(key);
                        if (!cellNodes) continue;

                        for (const b of cellNodes) {
                            if (b <= a || checkedIndices.has(b)) continue;
                            checkedIndices.add(b);

                            const nodeB = nodes[b];
                            const dx = nodeA.lx - nodeB.lx;
                            const dy = nodeA.ly - nodeB.ly;
                            const distX = Math.abs(dx);
                            const distY = Math.abs(dy);

                            const minSpacingX = (nodeA.width + nodeB.width) / 2 + 2;
                            const minSpacingY = (nodeA.height + nodeB.height) / 2 + 2;

                            if (distX < minSpacingX && distY < minSpacingY) {
                                let fx = dx || 0.1;
                                let fy = dy || 0.1;

                                if (Math.abs(fx) < 0.1 && Math.abs(fy) < 0.1) {
                                    const angle = Math.random() * Math.PI * 2;
                                    fx = Math.cos(angle);
                                    fy = Math.sin(angle);
                                }

                                const len = Math.hypot(fx, fy);
                                if (len > 0) {
                                    const nx = fx / len;
                                    const ny = fy / len;
                                    nodeA.lx += nx;
                                    nodeA.ly += ny;
                                    nodeB.lx -= nx;
                                    nodeB.ly -= ny;
                                }
                            }
                        }
                    }

                    // Repel from own point marker
                    const pRadius = (pointSize / 2) + 4;
                    const dx = nodeA.lx - nodeA.x;
                    const dy = nodeA.ly - nodeA.y;
                    let dist = Math.hypot(dx, dy);

                    if (dist < 0.1) dist = 0.1;
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const w2 = nodeA.width / 2;
                    const h2 = nodeA.height / 2;
                    const absNx = Math.abs(nx);
                    const absNy = Math.abs(ny);
                    const distToEdgeX = absNx > 0.001 ? w2 / absNx : Infinity;
                    const distToEdgeY = absNy > 0.001 ? h2 / absNy : Infinity;
                    const distToBoxEdge = Math.min(distToEdgeX, distToEdgeY);
                    const requiredDist = distToBoxEdge + pRadius;

                    if (dist < requiredDist) {
                        const push = (requiredDist - dist) * 0.8;
                        nodeA.lx += nx * push;
                        nodeA.ly += ny * push;
                    }

                    // Spring force to anchor
                    const currentDist = Math.hypot(nodeA.lx - nodeA.x, nodeA.ly - nodeA.y);
                    const targetDist = (pointSize / 2) + (nodeA.width / 2) + 10;

                    if (currentDist > targetDist) {
                        const pullFactor = 0.02;
                        nodeA.lx -= (nodeA.lx - nodeA.x) * pullFactor;
                        nodeA.ly -= (nodeA.ly - nodeA.y) * pullFactor;
                    }
                }
            }

            const newOffsets: Record<string | number, { x: number, y: number }> = {};
            nodes.forEach(n => {
                newOffsets[n.id] = { x: n.lx - n.x, y: n.ly - n.y };
            });
            setLabelOffsets(newOffsets);
        };

        const timer = setTimeout(runLayout, 50);
        return () => clearTimeout(timer);
    }, [points, appSettings.pointSize]);

    // Container size tracking
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

    // Render tooltip for hovered point
    const renderTooltip = () => {
        if (!hoveredPointId) return null;
        const point = points.find(p => p.id === hoveredPointId);
        if (!point) return null;

        const effectivePoint = getEffectivePoint(point);
        const screenX = position.x + (point.x * scale);
        const screenY = position.y + (point.y * scale);

        return (
            <PointTooltip
                point={point}
                effectivePoint={effectivePoint}
                screenX={screenX}
                screenY={screenY}
            />
        );
    };

    return (
        <div className="flex-1 bg-gray-950 overflow-hidden relative" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            {/* Background Grid */}
            <div
                className="absolute inset-0 opacity-10 pointer-events-none"
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
                            backfaceVisibility: 'hidden',
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
                                    decoding="async"
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
                                        decoding="async"
                                        loading="eager"
                                    />
                                    <div className="absolute top-2 left-14 bg-purple-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">Side B</div>
                                </div>
                            )}
                        </div>

                        {/* Points Overlay */}
                        {points.map(point => {
                            const effectivePoint = getEffectivePoint(point);
                            const isSelected = selectedPointId === point.id;
                            const isHovered = hoveredPointId === point.id;
                            const pointSize = appSettings.pointSize || 24;
                            const offset = labelOffsets[point.id] || { x: pointSize / 2 + 5 + 10, y: 0 };

                            return (
                                <PointMarker
                                    key={point.id}
                                    point={point}
                                    effectivePoint={effectivePoint}
                                    isSelected={isSelected}
                                    isHovered={isHovered}
                                    labelOffset={offset}
                                    appSettings={appSettings}
                                    mode={mode}
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
                                />
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
                <BoardContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onDuplicate={() => handleDuplicatePoint(contextMenu.pointId)}
                />
            )}
        </div>
    );
};

export default BoardView;
