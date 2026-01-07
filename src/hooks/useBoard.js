import { useState, useRef } from 'react';

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

    const selectedPoint = points.find(p => p.id === selectedPointId);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setImageSrc(ev.target.result);
                setPoints([]);
                setScale(1);
                setPosition({ x: 0, y: 0 });
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

    const handleImageClick = (e, mode, projectId) => { // <-- projectId añadido
        if (mode === 'measure' && !isDragging && e.button === 0) {
            if (!projectId) {
                console.error("Cannot add point: No project is active.");
                // Podrías mostrar una notificación al usuario aquí.
                return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;
            const newPoint = {
                id: `temp-${Date.now()}`, // Usar un ID temporal
                project_id: projectId, // <-- Asociar con el proyecto
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
