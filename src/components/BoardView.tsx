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

    // Elastic Label Positioning System (right-priority)
    useEffect(() => {
        if (points.length === 0) {
            setLabelOffsets({});
            return;
        }

        const runLayout = () => {
            const pointSize = appSettings.pointSize || 24;
            const CELL_SIZE = 120;
            const ITERATIONS = Math.min(80, 30 + Math.floor(points.length / 10));
            const LABEL_PADDING = 4;
            const MIN_DIST_FROM_POINT = (pointSize / 2) + 2;

            // All labels start to the RIGHT of their point (angle = 0)
            const nodes = points.map((p) => {
                const labelWidth = Math.max(24, p.label.length * 7);
                const initialDist = MIN_DIST_FROM_POINT + labelWidth / 2;

                return {
                    id: p.id,
                    x: p.x, // Anchor point (fixed)
                    y: p.y,
                    lx: p.x + initialDist, // Label starts to the RIGHT
                    ly: p.y,               // Same Y as point
                    vx: 0,
                    vy: 0,
                    width: labelWidth,
                    height: 16,
                    preferredAngle: 0 // Preferred direction: RIGHT
                };
            });

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

            // Physics simulation
            for (let iter = 0; iter < ITERATIONS; iter++) {
                const progress = iter / ITERATIONS;
                const damping = 0.85 - progress * 0.15; // Decrease damping over time for stability
                const springStrength = 0.15 + progress * 0.1; // Increase spring strength over time
                const repulsionStrength = 3.0 - progress * 1.5; // Decrease repulsion over time

                // Build spatial hash for current iteration
                const spatialHash = new Map<string, number[]>();
                nodes.forEach((node, idx) => {
                    const key = getCellKey(node.lx, node.ly);
                    if (!spatialHash.has(key)) spatialHash.set(key, []);
                    spatialHash.get(key)!.push(idx);
                });

                // Reset forces
                nodes.forEach(node => {
                    node.vx = 0;
                    node.vy = 0;
                });

                // Label-to-label repulsion
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

                            const minSpacingX = (nodeA.width + nodeB.width) / 2 + LABEL_PADDING;
                            const minSpacingY = (nodeA.height + nodeB.height) / 2 + LABEL_PADDING;

                            const overlapX = minSpacingX - Math.abs(dx);
                            const overlapY = minSpacingY - Math.abs(dy);

                            if (overlapX > 0 && overlapY > 0) {
                                // Calculate repulsion force proportional to overlap
                                let fx = dx;
                                let fy = dy;

                                // Handle near-zero distance
                                if (Math.abs(fx) < 0.01 && Math.abs(fy) < 0.01) {
                                    const angle = Math.random() * Math.PI * 2;
                                    fx = Math.cos(angle);
                                    fy = Math.sin(angle);
                                }

                                const len = Math.hypot(fx, fy);
                                const nx = fx / len;
                                const ny = fy / len;

                                // Force magnitude based on overlap amount
                                const overlapMagnitude = Math.min(overlapX, overlapY);
                                const force = overlapMagnitude * repulsionStrength;

                                nodeA.vx += nx * force;
                                nodeA.vy += ny * force;
                                nodeB.vx -= nx * force;
                                nodeB.vy -= ny * force;
                            }
                        }
                    }
                }

                // Label-to-ALL-point-markers repulsion (avoid labels overlapping any point)
                const markerRadius = (pointSize / 2) + 6; // Point marker collision radius
                for (let a = 0; a < nodes.length; a++) {
                    const nodeA = nodes[a];

                    for (let b = 0; b < nodes.length; b++) {
                        // Skip own point (handled separately with stronger force)
                        if (a === b) continue;

                        const pointB = nodes[b];
                        const dx = nodeA.lx - pointB.x; // Label position vs other point's marker
                        const dy = nodeA.ly - pointB.y;
                        const dist = Math.hypot(dx, dy);

                        // Check if label box overlaps with point marker circle
                        const w2 = nodeA.width / 2;
                        const h2 = nodeA.height / 2;

                        // Find closest point on label rectangle to the marker center
                        const closestX = Math.max(nodeA.lx - w2, Math.min(pointB.x, nodeA.lx + w2));
                        const closestY = Math.max(nodeA.ly - h2, Math.min(pointB.y, nodeA.ly + h2));
                        const closestDist = Math.hypot(closestX - pointB.x, closestY - pointB.y);

                        if (closestDist < markerRadius) {
                            // Label overlaps with another point's marker - push it away
                            let nx = dx;
                            let ny = dy;

                            if (dist < 0.1) {
                                const angle = Math.random() * Math.PI * 2;
                                nx = Math.cos(angle);
                                ny = Math.sin(angle);
                            } else {
                                nx = dx / dist;
                                ny = dy / dist;
                            }

                            const overlap = markerRadius - closestDist;
                            const pushForce = overlap * repulsionStrength * 1.5; // Stronger than label-label
                            nodeA.vx += nx * pushForce;
                            nodeA.vy += ny * pushForce;
                        }
                    }
                }

                // Apply forces and constraints for each node
                for (let a = 0; a < nodes.length; a++) {
                    const node = nodes[a];

                    // Repulsion from own point marker (stronger than others)
                    const dxFromPoint = node.lx - node.x;
                    const dyFromPoint = node.ly - node.y;
                    let distFromPoint = Math.hypot(dxFromPoint, dyFromPoint);

                    if (distFromPoint < 0.1) {
                        // Label is on top of point - push it in a random direction
                        const angle = Math.random() * Math.PI * 2;
                        node.lx = node.x + Math.cos(angle) * MIN_DIST_FROM_POINT;
                        node.ly = node.y + Math.sin(angle) * MIN_DIST_FROM_POINT;
                        distFromPoint = MIN_DIST_FROM_POINT;
                    }

                    const nxFromPoint = dxFromPoint / distFromPoint;
                    const nyFromPoint = dyFromPoint / distFromPoint;

                    // Calculate minimum required distance from point center to label edge
                    const w2 = node.width / 2;
                    const h2 = node.height / 2;
                    const absNx = Math.abs(nxFromPoint);
                    const absNy = Math.abs(nyFromPoint);
                    const distToBoxEdge = Math.min(
                        absNx > 0.001 ? w2 / absNx : Infinity,
                        absNy > 0.001 ? h2 / absNy : Infinity
                    );
                    const minRequiredDist = distToBoxEdge + (pointSize / 2) + 4;

                    if (distFromPoint < minRequiredDist) {
                        // Push label away from point
                        const pushForce = (minRequiredDist - distFromPoint) * 0.5;
                        node.vx += nxFromPoint * pushForce;
                        node.vy += nyFromPoint * pushForce;
                    }

                    // Elastic spring force toward PREFERRED POSITION (right side)
                    const optimalDist = MIN_DIST_FROM_POINT + node.width / 2;

                    // Preferred position: to the RIGHT of the point
                    const preferredX = node.x + optimalDist;
                    const preferredY = node.y;

                    // Calculate displacement from preferred position
                    const dispX = node.lx - preferredX;
                    const dispY = node.ly - preferredY;

                    // Apply spring force toward preferred position (Hooke's Law)
                    node.vx -= dispX * springStrength;
                    node.vy -= dispY * springStrength;

                    // Apply velocity with damping
                    node.lx += node.vx * damping;
                    node.ly += node.vy * damping;
                }
            }

            // Calculate final offsets
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
                    mode={mode}
                />
            )}
        </div>
    );
};

export default BoardView;
