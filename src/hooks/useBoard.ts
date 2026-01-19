import { useState, useRef, useEffect, useMemo, useCallback, ChangeEvent, MouseEvent, WheelEvent } from 'react';
import { Logger } from '../utils/logger';
import { Point } from '../types';

const log = Logger.Board;

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
    const [imageAWidth, setImageAWidth] = useState<number>(0);
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
            const imgA = new Image();
            
            const processDimensions = (widthA: number, heightA: number, widthB: number = 0, heightB: number = 0) => {
                // Use a timeout to ensure the container has been rendered and has dimensions
                setTimeout(() => {
                    const container = containerRef.current;
                    if (!container) return;

                    const gap = widthB > 0 ? 48 : 0; // 3rem gap matching BoardView
                    const totalWidth = widthA + gap + widthB;
                    const totalHeight = Math.max(heightA, heightB);

                    setImageDimensions({ width: totalWidth, height: totalHeight });
                    setImageAWidth(widthA);
                    
                    if (totalWidth === 0 || totalHeight === 0 || container.clientWidth === 0 || container.clientHeight === 0) {
                        return;
                    }

                    // Fit logic
                    const containerAspect = container.clientWidth / container.clientHeight;
                    const contentAspect = totalWidth / totalHeight;

                    let newScale;
                    if (containerAspect > contentAspect) {
                        newScale = container.clientHeight / totalHeight;
                    } else {
                        newScale = container.clientWidth / totalWidth;
                    }
                    
                    const finalScale = newScale * 0.95; 
                    const centeredX = (container.clientWidth - (totalWidth * finalScale)) / 2;
                    const centeredY = (container.clientHeight - (totalHeight * finalScale)) / 2;

                    setScale(finalScale); 
                    setPosition({ x: centeredX, y: centeredY });
                }, 0);
            };

            imgA.onload = () => {
                if (imageSrcB) {
                    const imgB = new Image();
                    imgB.onload = () => {
                        processDimensions(imgA.naturalWidth, imgA.naturalHeight, imgB.naturalWidth, imgB.naturalHeight);
                    };
                    imgB.src = imageSrcB;
                } else {
                    processDimensions(imgA.naturalWidth, imgA.naturalHeight);
                }
            };
            imgA.src = imageSrc;
        }
    }, [imageSrc, imageSrcB]); 

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

    const addPoint = (point: Point) => {
        setPoints([...points, point]);
    };

    const handleImageClick = (e: MouseEvent<HTMLDivElement>, mode: string, projectId: number | null) => {
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
            
            // Determine side based on X coordinate
            // If we have Image B, check if X is past Image A width
            let side: 'A' | 'B' = 'A';
            if (imageSrcB && imageAWidth > 0 && x > imageAWidth) {
                side = 'B';
            }
            // Generar el nuevo nombre con padding de ceros (ej: TP01, TP05, TP10)
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
    };

    const updatePoint = useCallback((pointId: number | string, updates: Partial<Point>) => {
        setPoints(currentPoints => 
            currentPoints.map(p => p.id === pointId ? { ...p, ...updates } : p)
        );
    }, [setPoints]);

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
        addPoint,
        updatePoint,
        resetBoard,
        undo,
        redo,
        canUndo,
        canRedo
    };
};
