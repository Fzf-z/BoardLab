import { useState, useCallback, RefObject, WheelEvent, MouseEvent } from 'react';

interface Position {
    x: number;
    y: number;
}

interface UseZoomPanOptions {
    containerRef: RefObject<HTMLDivElement>;
}

export function useZoomPan({ containerRef }: UseZoomPanOptions) {
    const [scale, setScale] = useState<number>(1);
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });

    const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
        if (e.ctrlKey) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const imgX = (mouseX - position.x) / scale;
        const imgY = (mouseY - position.y) / scale;
        const newScale = Math.min(Math.max(0.1, scale + (-e.deltaY * 0.001)), 20);
        setPosition({ x: mouseX - (imgX * newScale), y: mouseY - (imgY * newScale) });
        setScale(newScale);
    }, [position, scale]);

    const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>, mode: string) => {
        if ((mode === 'view' && e.button === 0) || e.button === 2) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    }, [position]);

    const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
        if (isDragging) {
            setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const centerOnPoint = useCallback((x: number, y: number) => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const centerX = container.clientWidth / 2;
        const centerY = container.clientHeight / 2;
        const newX = centerX - x * scale;
        const newY = centerY - y * scale;
        setPosition({ x: newX, y: newY });
    }, [containerRef, scale]);

    const fitToContainer = useCallback((contentWidth: number, contentHeight: number) => {
        if (!containerRef.current) return;
        const container = containerRef.current;

        if (contentWidth === 0 || contentHeight === 0 || container.clientWidth === 0 || container.clientHeight === 0) {
            return;
        }

        const containerAspect = container.clientWidth / container.clientHeight;
        const contentAspect = contentWidth / contentHeight;

        let newScale;
        if (containerAspect > contentAspect) {
            newScale = container.clientHeight / contentHeight;
        } else {
            newScale = container.clientWidth / contentWidth;
        }

        const finalScale = newScale * 0.95;
        const centeredX = (container.clientWidth - (contentWidth * finalScale)) / 2;
        const centeredY = (container.clientHeight - (contentHeight * finalScale)) / 2;

        setScale(finalScale);
        setPosition({ x: centeredX, y: centeredY });
    }, [containerRef]);

    const reset = useCallback(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    return {
        scale,
        setScale,
        position,
        setPosition,
        isDragging,
        dragStart,
        handleWheel,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        centerOnPoint,
        fitToContainer,
        reset
    };
}
