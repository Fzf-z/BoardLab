import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

const BoardView = ({
    imageSrc,
    points,
    scale,
    position,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleImageClick,
    mode,
    selectedPointId,
    isDragging,
    setPosition,
    setSelectedPointId,
    currentProjectId,
    containerRef
}) => {
    return (
        <div className="flex-1 relative bg-gray-950 overflow-hidden select-none">
            <div
                className="w-full h-full"
                onWheel={handleWheel}
                onMouseDown={(e) => handleMouseDown(e, mode)}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onContextMenu={(e) => { if (e.cancelable) e.preventDefault(); }}
                style={{ cursor: isDragging ? 'grabbing' : mode === 'measure' ? 'crosshair' : 'grab' }}
            >
                <div
                    ref={containerRef}
                    className="absolute origin-top-left transition-transform duration-75 ease-out"
                    style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
                >
                    {imageSrc ? (
                        <img src={imageSrc} className="max-w-none shadow-2xl pointer-events-none" alt="Board" />
                    ) : (
                        <div className="w-[800px] h-[600px] bg-gray-900 flex items-center justify-center border-2 border-dashed border-gray-700 rounded-xl">
                            <div className="text-gray-500 text-center">
                                <Upload size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Sube una imagen de la placa para comenzar</p>
                            </div>
                        </div>
                    )}

                    <div
                        className="absolute inset-0 z-10"
                        onClick={(e) => handleImageClick && handleImageClick(e, mode, currentProjectId)}
                    />

                    {points.map(p => (
                        <div
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); if (!isDragging) setSelectedPointId && setSelectedPointId(p.id); }}
                            className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 shadow-lg flex items-center justify-center cursor-pointer transform hover:scale-125 transition z-20 ${selectedPointId === p.id ? 'bg-yellow-400 border-black text-black' : p.measurements && Object.keys(p.measurements).length > 0 ? 'bg-green-500 border-white text-white' : 'bg-red-500 border-white text-white'}`}
                            style={{ left: p.x, top: p.y }}
                        >
                            <span className="text-[10px] font-bold">{typeof p.id === 'number' ? p.id : 'N'}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BoardView;
