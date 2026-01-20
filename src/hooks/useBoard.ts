import { useRef, useMemo, useCallback, MouseEvent } from 'react';
import { Logger } from '../utils/logger';
import { useUndoRedo, useZoomPan, usePointsDrag, useImageLoader } from './board';
import type { Point } from '../types';

const log = Logger.Board;

export const useBoard = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Undo/Redo for points
    const {
        present: points,
        setPresent: setPoints,
        setPresentOnly: setPointsPresentOnly,
        addToHistory,
        undo,
        redo,
        canUndo,
        canRedo,
        reset: resetHistory
    } = useUndoRedo([]);

    // Zoom and pan
    const {
        scale,
        setScale,
        position,
        setPosition,
        isDragging,
        dragStart,
        handleWheel,
        handleMouseDown: handleZoomPanMouseDown,
        handleMouseMove: handleZoomPanMouseMove,
        handleMouseUp: handleZoomPanMouseUp,
        centerOnPoint,
        fitToContainer,
        reset: resetZoomPan
    } = useZoomPan({ containerRef });

    // Image loading
    const {
        imageSrc,
        imageSrcB,
        imageAWidth,
        imageDimensions,
        setImage: setImageInternal,
        handleImageUpload
    } = useImageLoader({
        containerRef,
        onFitToContainer: fitToContainer,
        onReset: resetHistory
    });

    // Point selection
    const [selectedPointId, setSelectedPointIdState] = useMemo(() => {
        let id: number | string | null = null;
        const setId = (newId: number | string | null) => { id = newId; };
        return [id, setId] as const;
    }, []);

    // Use a ref to track selected point id for real-time updates
    const selectedPointIdRef = useRef<number | string | null>(null);
    const setSelectedPointId = useCallback((id: number | string | null) => {
        selectedPointIdRef.current = id;
    }, []);

    // Point dragging
    const {
        isDraggingPoint,
        handlePointMouseDown,
        handleMouseMove: handlePointDragMouseMove,
        handleMouseUp: handlePointDragMouseUp
    } = usePointsDrag({
        points,
        position,
        scale,
        containerRef,
        onSetPoints: setPointsPresentOnly,
        onAddToHistory: addToHistory,
        onSelectPoint: setSelectedPointId
    });

    const selectedPoint = useMemo(
        () => points.find(p => p.id === selectedPointIdRef.current),
        [points]
    );

    // Combined mouse handlers
    const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>, mode: string) => {
        handleZoomPanMouseDown(e, mode);
    }, [handleZoomPanMouseDown]);

    const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
        const handled = handlePointDragMouseMove(e);
        if (!handled) {
            handleZoomPanMouseMove(e);
        }
    }, [handlePointDragMouseMove, handleZoomPanMouseMove]);

    const handleMouseUp = useCallback(() => {
        handlePointDragMouseUp();
        handleZoomPanMouseUp();
    }, [handlePointDragMouseUp, handleZoomPanMouseUp]);

    // Image management
    const setImage = useCallback((src: string | null, srcB: string | null = null) => {
        setImageInternal(src, srcB);
        setSelectedPointId(null);
    }, [setImageInternal, setSelectedPointId]);

    // Point operations
    const addPoint = useCallback((point: Point) => {
        setPoints([...points, point]);
    }, [points, setPoints]);

    const updatePoint = useCallback((pointId: number | string, updates: Partial<Point>) => {
        setPoints(currentPoints =>
            currentPoints.map(p => p.id === pointId ? { ...p, ...updates } : p)
        );
    }, [setPoints]);

    const handleImageClick = useCallback((e: MouseEvent<HTMLDivElement>, mode: string, projectId: number | null) => {
        if (mode === 'measure' && !isDragging && e.button === 0) {
            if (!projectId) {
                log.warn('Cannot add point: No project is active');
                return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            const x = (clickX - position.x) / scale;
            const y = (clickY - position.y) / scale;

            let side: 'A' | 'B' = 'A';
            if (imageSrcB && imageAWidth > 0 && x > imageAWidth) {
                side = 'B';
            }

            const newName = `TP${(points.length + 1).toString().padStart(2, '0')}`;
            const newPoint: Point = {
                id: `temp-${Date.now()}`,
                project_id: projectId,
                x,
                y,
                label: newName,
                type: 'voltage',
                side: side,
                notes: '',
                measurements: {}
            };
            setPoints(prevPoints => [...prevPoints, newPoint]);
            setSelectedPointId(newPoint.id);
        }
    }, [isDragging, position, scale, imageSrcB, imageAWidth, points.length, setPoints, setSelectedPointId]);

    const selectPoint = useCallback((id: number | string | null) => {
        setSelectedPointId(id);
        if (id) {
            const point = points.find(p => p.id === id);
            if (point) {
                centerOnPoint(point.x, point.y);
            }
        }
    }, [points, setSelectedPointId, centerOnPoint]);

    const resetBoard = useCallback(() => {
        setImage(null);
        resetZoomPan();
        setSelectedPointId(null);
    }, [setImage, resetZoomPan, setSelectedPointId]);

    return {
        imageSrc,
        imageSrcB,
        setImage,
        imageDimensions,
        points,
        setPoints,
        selectedPointId: selectedPointIdRef.current,
        setSelectedPointId,
        selectPoint,
        scale,
        setScale,
        position,
        setPosition,
        isDragging,
        dragStart,
        containerRef,
        fileInputRef,
        selectedPoint,
        handleImageUpload,
        handleWheel,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handlePointMouseDown,
        handleImageClick,
        addPoint,
        updatePoint,
        resetBoard,
        undo,
        redo,
        canUndo,
        canRedo
    };
};
