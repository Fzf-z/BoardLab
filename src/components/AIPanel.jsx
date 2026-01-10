import React, { useState, useEffect } from 'react';
import { Activity, Zap, Cpu, Sparkles, Trash2, Wifi, Loader2, Clock, GitCommit } from 'lucide-react';
import Waveform from './Waveform';

const AIPanel = ({
    selectedPoint,
    points,
    setPoints,
    setSelectedPointId,
    askAboutPoint,
    captureValue,
    isCapturing,
    analyzeBoard,
    instrumentConfig,
    autoSave,
    handleSaveProject,
    onDeletePoint,
}) => {
    const [history, setHistory] = useState([]);
    const [referenceWaveform, setReferenceWaveform] = useState(null);

    useEffect(() => {
        setHistory([]);
        setReferenceWaveform(null);
        if (selectedPoint && selectedPoint.id && typeof selectedPoint.id === 'number' && window.electronAPI) {
            window.electronAPI.getMeasurementsForPoint(selectedPoint.id)
                .then(measurements => {
                    setHistory(measurements || []);
                })
                .catch(err => {
                    console.error("Error fetching measurement history:", err);
                    setHistory([]);
                });
        }
    }, [selectedPoint]);
    
    const handlePointUpdate = (field, value) => {
        setPoints(points.map(p => (p.id === selectedPoint.id ? { ...p, [field]: value } : p)));

        if (field === 'type' && value !== 'oscilloscope') {
            const configCommand = instrumentConfig.multimeter.commands[`configure_${value}`];
            if (configCommand && window.electronAPI) {
                window.electronAPI.multimeterSetConfig({
                    ip: instrumentConfig.multimeter.ip,
                    port: instrumentConfig.multimeter.port,
                    configCommand: configCommand,
                });
            }
        }
    };

    const handleCapture = async () => {
        if (!selectedPoint || !selectedPoint.id) {
            console.warn("Attempted to capture measurement with no point selected.");
            return;
        }

        let pointToMeasure = selectedPoint;

        // Si el punto es nuevo (ID temporal), guárdalo primero para obtener un ID permanente.
        if (typeof pointToMeasure.id === 'string' && pointToMeasure.id.startsWith('temp-')) {
            const savedPoints = await handleSaveProject();
            // Añadir comprobación de seguridad
            if (Array.isArray(savedPoints)) {
                const newlySavedPoint = savedPoints.find(p => p.label === pointToMeasure.label && p.x === pointToMeasure.x); 
                if (newlySavedPoint) {
                    pointToMeasure = newlySavedPoint;
                    setSelectedPointId(newlySavedPoint.id); // Actualizar el ID seleccionado en la UI
                } else {
                    console.error("Could not find the newly saved point. Aborting measurement.");
                    return;
                }
            } else {
                 console.error("handleSaveProject did not return saved points. Aborting measurement.");
                 return;
            }
        }

        const measurement = await captureValue(pointToMeasure);
        if (!measurement) return;

        // 1. Update UI state with the new measurement
        const updatedPoints = points.map(p => {
            if (p.id === pointToMeasure.id) {
                const newMeasurements = { ...p.measurements, [measurement.type]: { ...measurement, capturedAt: new Date().toISOString() } };
                return { ...p, measurements: newMeasurements };
            }
            return p;
        });
        setPoints(updatedPoints);

        // 2. Save the measurement to the DB
        try {
            // For oscilloscope data, save the entire measurement object.
            // For other types, save just the value.
            const valueToSave = measurement.type === 'oscilloscope' ? measurement : measurement.value;

            const result = await window.electronAPI.createMeasurement({
                pointId: pointToMeasure.id,
                type: pointToMeasure.type,
                value: valueToSave,
            });
            
            if(result.id) {
                 // Update history with the saved measurement
                const newHistoryItem = { ...measurement, id: result.id, created_at: new Date().toISOString() };
                setHistory([newHistoryItem, ...history]);
            } else {
                console.error("Failed to save measurement, backend returned:", JSON.stringify(result, null, 2));
            }
        } catch (error) {
            console.error("Error saving measurement:", error);
        }
    };

    return (
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col z-20 shadow-xl">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-bold text-white flex items-center">
                    <Activity className="mr-2 text-blue-400" />
                    Datos del Punto
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!selectedPoint ? (
                    <div className="text-gray-500 text-center mt-10 text-sm">Selecciona un punto.</div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        {/* --- Point Details --- */}
                        <div className="flex justify-between items-center">
                            <div className="flex-1 mr-2 flex space-x-2">
                                <input
                                    value={selectedPoint.label}
                                    onChange={(e) => handlePointUpdate('label', e.target.value)}
                                    className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full font-bold"
                                />
                                <button onClick={() => askAboutPoint(selectedPoint)} className="p-2 bg-purple-600/20 text-purple-300 rounded hover:bg-purple-600/40" title="Ask AI">
                                    <Sparkles size={16} />
                                </button>
                            </div>
                            <button 
                                onClick={() => onDeletePoint && onDeletePoint(selectedPoint.id)} 
                                className="text-red-400 p-2 hover:bg-red-900/30 rounded" 
                                title="Delete Point"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {/* --- Measurement Type --- */}
                        <div className="grid grid-cols-4 gap-2">
                            {[{ id: 'voltage', icon: Zap, lbl: 'Volt' }, { id: 'resistance', icon: Cpu, lbl: 'Ohms' }, { id: 'diode', icon: Zap, lbl: 'Diode' }, { id: 'oscilloscope', icon: Activity, lbl: 'Scope' }].map(t => (
                                <button key={t.id} onClick={() => handlePointUpdate('type', t.id)} className={`flex flex-col items-center p-2 rounded border ${selectedPoint.type === t.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                                    <t.icon size={16} />
                                    <span className="text-[10px] mt-1">{t.lbl}</span>
                                </button>
                            ))}
                        </div>

                        {/* --- Live Measurement --- */}
                        <div className="bg-black/40 rounded-lg p-4 border border-gray-700">
                            <div className="text-2xl font-mono text-cyan-400 font-bold mb-1">
                                {selectedPoint.type === 'oscilloscope' ? 'Scope Data' : (selectedPoint.measurements && selectedPoint.measurements[selectedPoint.type] ? selectedPoint.measurements[selectedPoint.type].value : "---")}
                            </div>
                            {selectedPoint.type === 'oscilloscope' && (
                                <Waveform 
                                    pointData={selectedPoint} 
                                    referenceData={referenceWaveform} 
                                />
                            )}
                            <button onClick={handleCapture} disabled={isCapturing} className={`w-full py-2 rounded font-bold flex items-center justify-center space-x-2 transition ${!isCapturing ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'}`}>
                                {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                                <span>{isCapturing ? 'MIDIENDO...' : 'CAPTURAR'}</span>
                            </button>
                        </div>

                        {/* --- Notes --- */}
                        <textarea
                            value={selectedPoint.notes}
                            onChange={(e) => handlePointUpdate('notes', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-gray-300 h-24 resize-none"
                            placeholder="Notas técnicas..."
                        />

                        {/* --- History --- */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-gray-400 flex items-center">
                                <Clock size={14} className="mr-2" />
                                Historial de Mediciones
                            </h3>
                            <div className="bg-gray-900/70 rounded-lg p-2 space-y-2 max-h-48 overflow-y-auto">
                                {history.length > 0 ? (
                                    history.map(m => {
                                        let displayValue;
                                        try {
                                            const parsed = JSON.parse(m.value);
                                            // Si es un objeto, busca una propiedad 'value', si no, usa el valor parseado.
                                            displayValue = typeof parsed === 'object' && parsed !== null ? (parsed.value || 'Scope Data') : parsed;
                                        } catch (e) {
                                            displayValue = m.value; // Si no es JSON, usa el valor crudo.
                                        }

                                        return (
                                            <div key={m.id} className="text-xs text-gray-300 bg-gray-800/50 p-2 rounded flex justify-between items-center">
                                                <div>
                                                    <span className="font-mono">{displayValue}</span>
                                                    <span className="text-gray-500 ml-2">{new Date(m.created_at).toLocaleString()}</span>
                                                </div>
                                                {m.type === 'oscilloscope' && m.value &&(
                                                    <button 
                                                        onClick={() => {
                                                            try {
                                                                setReferenceWaveform(JSON.parse(m.value));
                                                            } catch (e) {
                                                                console.error("Failed to parse reference waveform:", e);
                                                            }
                                                        }}
                                                        className="p-1 text-blue-400 hover:bg-blue-900/30 rounded"
                                                        title="Set as reference waveform"
                                                    >
                                                        <GitCommit size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center text-gray-500 text-xs py-4">No hay mediciones guardadas para este punto.</div>
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {points.length > 0 && (
                <div className="p-4 border-t border-gray-700">
                    <button onClick={() => analyzeBoard(points)} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-2 rounded shadow-lg flex items-center justify-center space-x-2">
                        <Sparkles size={16} />
                        <span>Diagnóstico AI</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default AIPanel;
