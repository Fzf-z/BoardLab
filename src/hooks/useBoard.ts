import { useState, useRef, useEffect, useMemo, useCallback, ChangeEvent, MouseEvent, WheelEvent } from 'react';
import { Point } from '../types';

interface Position {
    x: number;
    y: number;
}

// State with undo/redo capabilities
interface UndoableState<T> {
    past: T[];
    present: T;
    future: T[];
}

export const useBoard = () => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [imageSrcB, setImageSrcB] = useState<string | null>(null);
    const [pointsState, setPointsState] = useState<UndoableState<Point[]>>({
        past: [],
        present: [],
        future: [],
    });

    const points = pointsState.present;
    const canUndo = pointsState.past.length > 0;
    const canRedo = pointsState.future.length > 0;

    const setPoints = useCallback((newPoints: Point[] | ((prevState: Point[]) => Point[])) => {
        setPointsState(currentState => {
            const newPresent = newPoints instanceof Function ? newPoints(currentState.present) : newPoints;

            if (JSON.stringify(currentState.present) === JSON.stringify(newPresent)) {
                return currentState;
            }

            return {
                past: [...currentState.past, currentState.present],
                present: newPresent,
                future: [], // Clear future on new action
            };
        });
    }, []);

    const setPointsPresentOnly = useCallback((newPoints: Point[] | ((prevState: Point[]) => Point[])) => {
        setPointsState(currentState => ({
            ...currentState,
            present: newPoints instanceof Function ? newPoints(currentState.present) : newPoints,
        }));
    }, []);

    const undo = useCallback(() => {
        setPointsState(currentState => {
            const { past, present, future } = currentState;
            if (past.length === 0) return currentState;

            const previous = past[past.length - 1];
            const newPast = past.slice(0, past.length - 1);

            return {
                past: newPast,
                present: previous,
                future: [present, ...future],
            };
        });
    }, []);

    const redo = useCallback(() => {
        setPointsState(currentState => {
            const { past, present, future } = currentState;
            if (future.length === 0) return currentState;

            const next = future[0];
            const newFuture = future.slice(1);

            return {
                past: [...past, present],
                present: next,
                future: newFuture,
            };
        });
    }, []);


    const setImage = (src: string | null, srcB: string | null = null) => {
        setImageSrc(src);
        setImageSrcB(srcB);
        // Reset history when a new image is loaded
        setPointsState({ past: [], present: [], future: [] });
    };


    const [selectedPointId, setSelectedPointId] = useState<number | string | null>(null);
    const [scale, setScale] = useState<number>(1);
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isDraggingPoint, setIsDraggingPoint] = useState<boolean>(false);
    const [draggedPointId, setDraggedPointId] = useState<number | string | null>(null);
    const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
    const initialPointsRef = useRef<Point[]>([]);

    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (imageSrc && containerRef.current) {
            const img = new Image();
            img.onload = () => {
                // Use a timeout to ensure the container has been rendered and has dimensions
                setTimeout(() => {
                    const container = containerRef.current;
                    if (!container) return; // Guard against component unmount

                    const { naturalWidth, naturalHeight } = img;
                    setImageDimensions({ width: naturalWidth, height: naturalHeight });
                    
                    if (naturalWidth === 0 || naturalHeight === 0 || container.clientWidth === 0 || container.clientHeight === 0) {
                        return;
                    }

                    const containerAspect = container.clientWidth / container.clientHeight;
                    const imageAspect = naturalWidth / naturalHeight;

                    let newScale;
                    if (containerAspect > imageAspect) {
                        newScale = container.clientHeight / naturalHeight;
                    } else {
                        newScale = container.clientWidth / naturalWidth;
                    }
                    
                    const finalScale = newScale * 0.95; // Add a small margin
                    const centeredX = (container.clientWidth - (naturalWidth * finalScale)) / 2;
                    const centeredY = (container.clientHeight - (naturalHeight * finalScale)) / 2;

                    setScale(finalScale); 
                    setPosition({ x: centeredX, y: centeredY });
                }, 0);
            };
            img.src = imageSrc;
        }
    }, [imageSrc]); 

    const selectedPoint = useMemo(() => points.find(p => p.id === selectedPointId), [points, selectedPointId]);

    const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setImage(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
        if (e.ctrlKey) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const imgX = (mouseX - position.x) / scale;
        const imgY = (mouseY - position.y) / scale;
        const newScale = Math.min(Math.max(0.1, scale + (-e.deltaY * 0.001)), 20);
        setPosition({ x: mouseX - (imgX * newScale), y: mouseY - (imgY * newScale) });
        setScale(newScale);
    };

    const handleMouseDown = (e: MouseEvent<HTMLDivElement>, mode: string) => {
        if ((mode === 'view' && e.button === 0) || e.button === 2) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handlePointMouseDown = (e: MouseEvent, pointId: number | string) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        
        const point = points.find(p => p.id === pointId);
        if (!point) return;

        initialPointsRef.current = [...points];

        setIsDraggingPoint(true);
        setDraggedPointId(pointId);
        setSelectedPointId(pointId);
        
        // Save the click offset relative to point center (point is 24x24, -12 offset in CSS)
        // But since we use left/top in style, we just need the mouse pos in image coords
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const imgX = (mouseX - position.x) / scale;
        const imgY = (mouseY - position.y) / scale;
        
        setDragStart({ x: imgX - point.x, y: imgY - point.y });
    };

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (isDragging) {
            setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        } else if (isDraggingPoint && draggedPointId) {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const newX = (mouseX - position.x) / scale - dragStart.x;
            const newY = (mouseY - position.y) / scale - dragStart.y;
            
            setPointsPresentOnly(prevPoints => prevPoints.map(p => 
                p.id === draggedPointId ? { ...p, x: newX, y: newY } : p
            ));
        }
    };

    const handleMouseUp = () => {
        if (isDraggingPoint) {
            // Check if points actually changed
            if (JSON.stringify(initialPointsRef.current) !== JSON.stringify(points)) {
                setPointsState(prev => ({
                    past: [...prev.past, initialPointsRef.current],
                    present: prev.present,
                    future: []
                }));
            }
        }
        setIsDragging(false);
        setIsDraggingPoint(false);
        setDraggedPointId(null);
    };

    const handleImageClick = (e: MouseEvent<HTMLDivElement>, mode: string, projectId: number | null) => {
        if (mode === 'measure' && !isDragging && e.button === 0) {
            if (!projectId) {
                console.error("Cannot add point: No project is active.");
                return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            const x = (clickX - position.x) / scale;
            const y = (clickY - position.y) / scale;
            
            const newPoint: Point = {
                id: `temp-${Date.now()}`,
                project_id: projectId,
                x,
                y,
                label: `TP${points.length + 1}`,
                type: 'voltage',
                notes: '',
                measurements: {}
            };
            setPoints(prevPoints => [...prevPoints, newPoint]);
            setSelectedPointId(newPoint.id);
        }
    };

    const resetBoard = () => {
        setImage(null);
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setSelectedPointId(null);
    };

    const selectPoint = (id: number | string | null) => {
        setSelectedPointId(id);
        if (id && containerRef.current) {
            const point = points.find(p => p.id === id);
            if (point) {
                 const container = containerRef.current;
                 const centerX = container.clientWidth / 2;
                 const centerY = container.clientHeight / 2;
                 
                 // Center the point
                 // We keep the current scale
                 const newX = centerX - point.x * scale;
                 const newY = centerY - point.y * scale;
                 
                 setPosition({ x: newX, y: newY });
            }
        }
    };

    return {
        imageSrc,
        imageSrcB,
        setImage,
        imageDimensions,
        points,
        setPoints,
        selectedPointId,
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
        resetBoard,
        undo,
        redo,
        canUndo,
        canRedo
    };
};
