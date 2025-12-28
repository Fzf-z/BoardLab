import React from 'react';
import { Activity, Zap, Cpu, Sparkles, Trash2, Wifi, Loader2 } from 'lucide-react';
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
    instrumentConfig
}) => {
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
                        <div className="flex justify-between items-center">
                            <div className="flex-1 mr-2 flex space-x-2">
                                <input
                                    value={selectedPoint.label}
                                    onChange={(e) => handlePointUpdate('label', e.target.value)}
                                    className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full font-bold"
                                />
                                <button onClick={() => askAboutPoint(selectedPoint)} className="p-2 bg-purple-600/20 text-purple-300 rounded hover:bg-purple-600/40">
                                    <Sparkles size={16} />
                                </button>
                            </div>
                            <button onClick={() => { setPoints(points.filter(p => p.id !== selectedPoint.id)); setSelectedPointId(null); }} className="text-red-400 p-2 hover:bg-red-900/30 rounded">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            {[{ id: 'voltage', icon: Zap, lbl: 'Volt' }, { id: 'resistance', icon: Cpu, lbl: 'Ohms' }, { id: 'diode', icon: Zap, lbl: 'Diode' }, { id: 'oscilloscope', icon: Activity, lbl: 'Scope' }].map(t => (
                                <button key={t.id} onClick={() => handlePointUpdate('type', t.id)} className={`flex flex-col items-center p-2 rounded border ${selectedPoint.type === t.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                    <t.icon size={16} />
                                    <span className="text-[10px] mt-1">{t.lbl}</span>
                                </button>
                            ))}
                        </div>

                        <div className="bg-black/40 rounded-lg p-4 border border-gray-700">
                            <div className="text-2xl font-mono text-cyan-400 font-bold mb-1">
                                {selectedPoint.type === 'oscilloscope' ? 'Scope Data' : (selectedPoint.measurements && selectedPoint.measurements[selectedPoint.type] ? selectedPoint.measurements[selectedPoint.type].value : "---")}
                            </div>
                            {selectedPoint.type === 'oscilloscope' && <Waveform pointData={selectedPoint} />}
                            <button onClick={() => captureValue(selectedPoint, points, setPoints)} disabled={isCapturing} className={`w-full py-2 rounded font-bold flex items-center justify-center space-x-2 transition ${!isCapturing ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'}`}>
                                {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                                <span>{isCapturing ? 'MIDIENDO...' : 'CAPTURAR'}</span>
                            </button>
                        </div>

                        <textarea
                            value={selectedPoint.notes}
                            onChange={(e) => handlePointUpdate('notes', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-gray-300 h-24 resize-none"
                            placeholder="Notas técnicas..."
                        />
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
