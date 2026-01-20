import { useState, useRef, useCallback, MouseEvent, RefObject } from 'react';
import type { Point } from '../../types';

interface Position {
    x: number;
    y: number;
}

interface UsePointsDragOptions {
    points: Point[];
    position: Position;
    scale: number;
    containerRef: RefObject<HTMLDivElement>;
    onSetPoints: (points: Point[] | ((prev: Point[]) => Point[])) => void;
    onAddToHistory: (previousState: Point[]) => void;
    onSelectPoint: (id: number | string | null) => void;
}

export function usePointsDrag({
    points,
    position,
    scale,
    containerRef,
    onSetPoints,
    onAddToHistory,
    onSelectPoint
}: UsePointsDragOptions) {
    const [isDraggingPoint, setIsDraggingPoint] = useState<boolean>(false);
    const [draggedPointId, setDraggedPointId] = useState<number | string | null>(null);
    const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
    const initialPointsRef = useRef<Point[]>([]);

    const handlePointMouseDown = useCallback((e: MouseEvent, pointId: number | string) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        const point = points.find(p => p.id === pointId);
        if (!point) return;

        initialPointsRef.current = [...points];

        setIsDraggingPoint(true);
        setDraggedPointId(pointId);
        onSelectPoint(pointId);

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const imgX = (mouseX - position.x) / scale;
        const imgY = (mouseY - position.y) / scale;

        setDragStart({ x: imgX - point.x, y: imgY - point.y });
    }, [points, position, scale, containerRef, onSelectPoint]);

    const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
        if (!isDraggingPoint || !draggedPointId) return false;

        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newX = (mouseX - position.x) / scale - dragStart.x;
        const newY = (mouseY - position.y) / scale - dragStart.y;

        onSetPoints(prevPoints => prevPoints.map(p =>
            p.id === draggedPointId ? { ...p, x: newX, y: newY } : p
        ));

        return true;
    }, [isDraggingPoint, draggedPointId, position, scale, dragStart, onSetPoints]);

    const handleMouseUp = useCallback(() => {
        if (isDraggingPoint) {
            if (JSON.stringify(initialPointsRef.current) !== JSON.stringify(points)) {
                onAddToHistory(initialPointsRef.current);
            }
        }
        setIsDraggingPoint(false);
        setDraggedPointId(null);
    }, [isDraggingPoint, points, onAddToHistory]);

    return {
        isDraggingPoint,
        draggedPointId,
        handlePointMouseDown,
        handleMouseMove,
        handleMouseUp
    };
}
