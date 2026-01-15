import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { useHardware } from '../hooks/useHardware';
import { Play, SkipForward, SkipBack, Square, Timer, Zap, Radio } from 'lucide-react';

const SequencerPanel: React.FC = () => {
    const { sequence, stopSequence, nextInSequence, prevInSequence, points, addMeasurement } = useProject();
    const hardware = useHardware();
    
    const [autoMode, setAutoMode] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const processingRef = useRef(false);
    
    // Use timeout from config as delay (converted to seconds, min 1s)
    const autoDelaySec = Math.max(1, Math.round((hardware.instrumentConfig.timeout || 3000) / 1000));
    
    // Derive Locked Type directly from the first point in the sequence
    // This ensures that whatever the user set as the first point's type dictates the mode for the whole run
    const firstPointId = sequence.order[0];
    const firstPoint = points.find(p => p.id === firstPointId);
    const lockedType = firstPoint?.type || null;

    const currentPointId = sequence.order[sequence.currentIndex];
    const currentPoint = points.find(p => p.id === currentPointId);

    // Calculate progress
    const progress = Math.round(((sequence.currentIndex + 1) / sequence.order.length) * 100);

    const captureAndAdvance = async (overrideData?: string) => {
        if (!currentPoint || hardware.isCapturing || processingRef.current) return;
        
        processingRef.current = true;
        try {
            // Use locked type if available, otherwise point type
            const pointToMeasure = lockedType ? { ...currentPoint, type: lockedType } : currentPoint;
            
            const measurement = await hardware.captureValue(pointToMeasure as any, overrideData);
            if (measurement) {
                await addMeasurement(currentPoint, measurement);
                nextInSequence();
            }
        } finally {
            // Debounce unlock slightly to prevent multiple triggers from same event burst
            setTimeout(() => {
                processingRef.current = false;
            }, 500);
        }
    };

    // Auto Mode Logic
    useEffect(() => {
        if (!autoMode || !currentPoint) {
            setCountdown(null);
            return;
        }

        setCountdown(autoDelaySec);
        
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev === null) return null;
                if (prev <= 1) {
                    clearInterval(timer);
                    captureAndAdvance(); // Trigger capture
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [sequence.currentIndex, autoMode, autoDelaySec]); // Reset when index changes or mode toggles

    // External Trigger Logic
    useEffect(() => {
        if (!sequence.active || !currentPoint || !window.electronAPI) return;

        const cleanup = window.electronAPI.onExternalTrigger((data: any) => {
            console.log('External trigger received:', data);
            captureAndAdvance(data);
        });

        return cleanup;
    }, [sequence.active, currentPoint, hardware.isCapturing]); // Re-bind if point changes to capture correct one

    if (!sequence.active) return null;

    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-4 z-50 flex items-center space-x-4 min-w-[500px]">
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-blue-400">SEQUENCE MODE</span>
                    <span className="text-xs text-gray-400 flex items-center gap-2">
                        {hardware.instrumentConfig.monitor?.enabled && (
                            <span className="text-green-400 flex items-center gap-1" title="Listening for Multimeter Data">
                                <Radio size={12} className="animate-pulse"/> MONITORING
                            </span>
                        )}
                        {sequence.currentIndex + 1} / {sequence.order.length}
                    </span>
                </div>
                <div className="text-white text-lg font-mono truncate flex items-center justify-between">
                    <div className="flex flex-col">
                        <span>{currentPoint?.label || 'Unknown Point'}</span>
                        {lockedType && (
                            <span className="text-xs text-blue-300 font-bold uppercase tracking-wider">
                                MODE: {lockedType}
                            </span>
                        )}
                    </div>
                    {countdown !== null && (
                        <span className="text-yellow-400 font-bold animate-pulse">
                            {countdown}s
                        </span>
                    )}
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-700 h-2 rounded mt-2">
                    <div 
                        className="bg-blue-500 h-2 rounded transition-all duration-300" 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>

            <div className="flex space-x-2 border-l border-gray-600 pl-4 items-center">
                 <button 
                    onClick={() => setAutoMode(!autoMode)}
                    className={`p-2 rounded transition ${autoMode ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                    title="Toggle Auto-Measure Timer"
                >
                    <Timer size={20} />
                </button>
                
                <div className="w-px h-8 bg-gray-700 mx-1"></div>

                <button 
                    onClick={prevInSequence}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition"
                    title="Previous"
                >
                    <SkipBack size={20} />
                </button>
                
                <button 
                    onClick={() => captureAndAdvance()} 
                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded text-white transition shadow-lg"
                    title="Measure Now (Enter)"
                    disabled={hardware.isCapturing}
                >
                    {hardware.isCapturing ? <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"/> : <Zap size={20} />}
                </button>

                <button 
                    onClick={nextInSequence} 
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition"
                    title="Skip / Next"
                >
                    <SkipForward size={20} />
                </button>
                <button 
                    onClick={stopSequence}
                    className="p-2 bg-red-600 hover:bg-red-500 rounded text-white transition"
                    title="Stop Sequence"
                >
                    <Square size={20} />
                </button>
            </div>
        </div>
    );
};

export default SequencerPanel;
