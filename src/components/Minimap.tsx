import React, { useRef, useEffect, useState, useMemo, MouseEvent } from 'react';

interface MinimapProps {
    imageSrc: string;
    imageSrcB?: string | null;
    imageDimensions: { width: number; height: number };
    scale: number;
    position: { x: number; y: number };
    setPosition: (pos: { x: number; y: number }) => void;
    containerDimensions: { width: number; height: number };
}

const Minimap: React.FC<MinimapProps> = ({ 
    imageSrc, 
    imageSrcB,
    imageDimensions, 
    scale, 
    position, 
    setPosition,
    containerDimensions 
}) => {
    const miniSize = 180; // Max width/height of the minimap
    const mapRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Calculate minimap dimensions preserving aspect ratio
    const { miniWidth, miniHeight, miniScale } = useMemo(() => {
        if (!imageDimensions.width || !imageDimensions.height) {
            return { miniWidth: 0, miniHeight: 0, miniScale: 0 };
        }
        const aspect = imageDimensions.width / imageDimensions.height;
        let width, height;
        if (aspect > 1) {
            width = miniSize;
            height = miniSize / aspect;
        } else {
            height = miniSize;
            width = miniSize * aspect;
        }
        return { miniWidth: width, miniHeight: height, miniScale: width / imageDimensions.width };
    }, [imageDimensions, miniSize]);

    const handleMove = (e: MouseEvent | globalThis.MouseEvent) => {
        if (!mapRef.current || !miniScale) return;
        const rect = mapRef.current.getBoundingClientRect();
        
        const x = (e.clientX - rect.left) / miniScale;
        const y = (e.clientY - rect.top) / miniScale;

        // Center the view on click/drag point
        const newPosX = -(x * scale) + (containerDimensions.width / 2);
        const newPosY = -(y * scale) + (containerDimensions.height / 2);

        setPosition({ x: newPosX, y: newPosY });
    };

    const onMouseDown = (e: MouseEvent) => {
        setIsDragging(true);
        handleMove(e);
    };

    useEffect(() => {
        const onMouseMove = (e: globalThis.MouseEvent) => {
            if (isDragging) handleMove(e);
        };
        const onMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging, scale, containerDimensions, miniScale]);

    if (!miniScale) return null;

    // Viewport rectangle in minimap coordinates
    // We want to show where the container is relative to the image
    const viewWidth = (containerDimensions.width / scale) * miniScale;
    const viewHeight = (containerDimensions.height / scale) * miniScale;
    const viewX = (-position.x / scale) * miniScale;
    const viewY = (-position.y / scale) * miniScale;

    return (
        <div 
            ref={mapRef}
            className="absolute bottom-4 left-4 bg-gray-900 border-2 border-gray-600 rounded shadow-2xl overflow-hidden cursor-pointer select-none z-30"
            style={{ width: miniWidth, height: miniHeight }}
            onMouseDown={onMouseDown}
        >
            {/* Content Container Scaled Down */}
            <div style={{ 
                width: imageDimensions.width, 
                height: imageDimensions.height, 
                transform: `scale(${miniScale})`, 
                transformOrigin: '0 0',
                display: 'flex'
            }}>
                <img 
                    src={imageSrc} 
                    alt="Minimap A" 
                    className="block max-w-none opacity-40"
                    draggable={false}
                />
                {imageSrcB && (
                    <img 
                        src={imageSrcB} 
                        alt="Minimap B" 
                        className="block max-w-none opacity-40 ml-12" // ml-12 matches 3rem (48px)
                        style={{ marginLeft: '48px' }}
                        draggable={false}
                    />
                )}
            </div>

            {/* Viewport Rectangle */}
            <div 
                className="absolute border border-blue-400 bg-blue-400/20 shadow-[0_0_10px_rgba(96,165,250,0.5)] pointer-events-none z-10"
                style={{
                    left: viewX,
                    top: viewY,
                    width: viewWidth,
                    height: viewHeight,
                    boxSizing: 'border-box'
                }}
            />
        </div>
    );
};

export default Minimap;
