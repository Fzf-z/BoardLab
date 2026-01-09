import { useState, useRef, useEffect, useMemo } from 'react';

export const useBoard = () => {
    const [imageSrc, setImageSrc] = useState(null);
    const [points, setPoints] = useState([]);
    const [selectedPointId, setSelectedPointId] = useState(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const containerRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (imageSrc && containerRef.current) {
            const img = new Image();
            img.onload = () => {
                // Use a timeout to ensure the container has been rendered and has dimensions
                setTimeout(() => {
                    const container = containerRef.current;
                    if (!container) return; // Guard against component unmount

                    const { naturalWidth, naturalHeight } = img;
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
    }, [imageSrc, containerRef.current]); // Add containerRef.current to dependencies

    const selectedPoint = useMemo(() => points.find(p => p.id === selectedPointId), [points, selectedPointId]);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setImageSrc(ev.target.result);
                setPoints([]);
                // Scale and position are now handled by useEffect
            };
            reader.readAsDataURL(file);
        }
    };

    const handleWheel = (e) => {
        if (e.ctrlKey) return;
        if (e.cancelable) e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const imgX = (mouseX - position.x) / scale;
        const imgY = (mouseY - position.y) / scale;
        const newScale = Math.min(Math.max(0.1, scale + (-e.deltaY * 0.001)), 20);
        setPosition({ x: mouseX - (imgX * newScale), y: mouseY - (imgY * newScale) });
        setScale(newScale);
    };

    const handleMouseDown = (e, mode) => {
        if ((mode === 'view' && e.button === 0) || e.button === 2) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging) {
            setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleImageClick = (e, mode, projectId) => {
        if (mode === 'measure' && !isDragging && e.button === 0) {
            if (!projectId) {
                console.error("Cannot add point: No project is active.");
                return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            // rect is already transformed (scaled and translated) because the click target is inside the transformed container.
            // So rect.left represents the visual left edge of the image on screen.
            // We just need to calculate the relative position and divide by scale.
            // We do NOT subtract position.x/y because rect.left/top already accounts for it.
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;
            const newPoint = {
                id: `temp-${Date.now()}`,
                project_id: projectId,
                x,
                y,
                label: `TP${points.length + 1}`,
                type: 'voltage',
                notes: '',
                measurements: {}
            };
            setPoints([...points, newPoint]);
            setSelectedPointId(newPoint.id);
        }
    };

    const resetBoard = () => {
        setImageSrc(null);
        setPoints([]);
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setSelectedPointId(null);
    };

    return {
        imageSrc,
        setImage: setImageSrc,
        points,
        setPoints,
        selectedPointId,
        setSelectedPointId,
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
        handleImageClick,
        resetBoard,
    };
};
