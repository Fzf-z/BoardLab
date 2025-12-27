import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Minus, 
  Move, 
  Crosshair, 
  Wifi, 
  Save, 
  Upload, 
  Trash2, 
  Activity, 
  Zap,
  Cpu,
  Download,
  Sparkles,
  X,
  Loader2,
  Settings,
  AlertCircle,
  Monitor
} from 'lucide-react';

const BoardLab = () => {
  // --- ESTADOS DE CONFIGURACIÓN ---
  const [configOpen, setConfigOpen] = useState(false);
  const [hwConfig, setHwConfig] = useState({
    multimeterIp: "192.168.1.100",
    scopeIp: "192.168.1.101"
  });

  // Detectar entorno Electron
  const isElectron = window.electronAPI?.isElectron || false;

  // Estados principales
  const [imageSrc, setImageSrc] = useState("/api/placeholder/800/600");
  const [points, setPoints] = useState([]);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [mode, setMode] = useState('view');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Estados de Hardware 
  const [hardwareStatus, setHardwareStatus] = useState(isElectron ? 'READY' : 'SIMULATOR');
  const [liveReading, setLiveReading] = useState("---");
  const [isCapturing, setIsCapturing] = useState(false);

  // Estados para IA (Gemini)
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiTitle, setAiTitle] = useState("");

  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectedPoint = points.find(p => p.id === selectedPointId);

  // --- Integración Gemini API ---
  const callGemini = async (prompt, title) => {
    const apiKey = ""; 
    setAiTitle(title);
    setAiModalOpen(true);
    setIsAiLoading(true);
    setAiResponse("");

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar una respuesta.";
        setAiResponse(text);
    } catch (error) {
        setAiResponse("Error de conexión con IA.");
    } finally {
        setIsAiLoading(false);
    }
  };

  const analyzeBoard = () => {
    if (points.length === 0) return alert("Agrega puntos primero.");
    const measurements = points.map(p => 
        `- ${p.label} (${p.type}): ${p.value || 'N/A'}. Notas: ${p.notes}`
    ).join('\n');
    const prompt = `Analiza estas mediciones de motherboard y da diagnóstico:\n${measurements}`;
    callGemini(prompt, "Diagnóstico Inteligente");
  };

  const askAboutPoint = () => {
    if (!selectedPoint) return;
    const prompt = `Analiza punto "${selectedPoint.label}" tipo ${selectedPoint.type}. ¿Qué función tiene y qué valor esperar?`;
    callGemini(prompt, `Consulta: ${selectedPoint.label}`);
  };

  // --- LÓGICA DE CAPTURA (ELECTRON IPC) ---
  const captureValue = async () => {
    if (!selectedPointId) return;
    setIsCapturing(true);

    const currentPoint = points.find(p => p.id === selectedPointId);
    let result = { status: 'error', value: 'Error' };

    try {
        if (isElectron) {
            // --- MODO NATIVO (ELECTRON) ---
            console.log("Invocando Hardware Nativo...");
            if (currentPoint.type === 'oscilloscope') {
                result = await window.electronAPI.measureScope({ ip: hwConfig.scopeIp });
            } else {
                const mode = currentPoint.type === 'voltage' ? 'VOLT' : 'RES';
                result = await window.electronAPI.measureMultimeter({ ip: hwConfig.multimeterIp, mode });
            }
        } else {
            // --- MODO SIMULACIÓN (PREVIEW NAVEGADOR) ---
            await new Promise(r => setTimeout(r, 800)); // Delay artificial
            if (currentPoint.type === 'oscilloscope') {
                const simWave = Array.from({length: 100}, (_,i) => Math.sin(i*0.1) + Math.random()*0.2);
                result = { status: 'success', value: 'Demo Wave', waveform: simWave };
            } else {
                const val = (3.3 + Math.random()*0.1).toFixed(3) + " V";
                result = { status: 'success', value: val };
            }
        }

        // Procesar resultado
        if (result.status === 'success') {
             const updatedPoints = points.map(p => 
                p.id === selectedPointId 
                  ? { 
                      ...p, 
                      value: result.value, 
                      waveform: result.waveform || null, 
                      timestamp: new Date().toLocaleTimeString()
                    } 
                  : p
              );
              setPoints(updatedPoints);
        } else {
            alert(`Error de Hardware: ${result.message || 'Desconocido'}`);
        }

    } catch (e) {
        alert("Error crítico al comunicar con el hardware.");
        console.error(e);
    } finally {
        setIsCapturing(false);
    }
  };

  // --- MANEJO DE IMAGEN Y UI (Igual que antes) ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => { setImageSrc(e.target.result); setPoints([]); setScale(1); setPosition({x:0, y:0}); };
      reader.readAsDataURL(file);
    }
  };

  const handleWheel = (e) => {
    if (e.ctrlKey) return; 
    e.preventDefault();
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const imagePointX = (mouseX - position.x) / scale;
    const imagePointY = (mouseY - position.y) / scale;
    const delta = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, scale + delta), 20);
    const newX = mouseX - (imagePointX * newScale);
    const newY = mouseY - (imagePointY * newScale);
    setScale(newScale);
    setPosition({ x: newX, y: newY });
  };

  const handleMouseDown = (e) => {
    if ((mode === 'view' && e.button === 0) || e.button === 2) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleImageClick = (e) => {
    if (mode === 'measure' && !isDragging && e.button === 0) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      const newPoint = { id: Date.now(), x, y, label: `TP${points.length + 1}`, type: 'voltage', value: null, notes: '', waveform: null };
      setPoints([...points, newPoint]);
      setSelectedPointId(newPoint.id);
    }
  };

  const renderWaveform = (data) => {
    if (!data || !Array.isArray(data)) return null;
    const max = Math.max(...data) || 1;
    const min = Math.min(...data) || 0;
    const range = max - min || 1;
    const width = 200;
    const height = 60;
    const pointsStr = data.map((val, i) => `${(i / (data.length - 1)) * width},${height - ((val - min) / range) * height}`).join(' ');
    return <svg width="100%" height={height} className="bg-gray-900 rounded border border-gray-700 mt-2"><polyline fill="none" stroke="#10b981" strokeWidth="1.5" points={pointsStr} /></svg>;
  };

  const ResistorIcon = ({ size=16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h2l2-5 4 10 4-10 4 10 2-5h2" /></svg>;

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="w-16 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-4 space-y-4 z-20 shadow-lg">
        <div className="p-2 bg-blue-600 rounded-lg mb-4"><Cpu size={24} /></div>
        <button onClick={() => setMode('view')} className={`p-3 rounded-xl transition-all ${mode === 'view' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700'}`}><Move size={20} /></button>
        <button onClick={() => setMode('measure')} className={`p-3 rounded-xl transition-all ${mode === 'measure' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700'}`}><Crosshair size={20} /></button>
        <div className="h-px w-8 bg-gray-700 my-2"></div>
        <button onClick={() => fileInputRef.current.click()} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl"><Upload size={20} /></button>
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
        <button className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl"><Save size={20} /></button>
        <div className="flex-1"></div>
        <button onClick={() => setConfigOpen(true)} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl animate-in fade-in"><Settings size={20} /></button>
      </div>

      {/* CANVAS */}
      <div className="flex-1 relative bg-gray-950 overflow-hidden select-none">
        {/* Status Bar */}
        <div className="absolute top-4 left-4 z-10 flex space-x-2 bg-gray-800/90 backdrop-blur p-2 rounded-lg shadow-xl border border-gray-700">
            <button onClick={() => setScale(s => s + 0.1)} className="p-1 hover:bg-gray-700 rounded"><Plus size={16}/></button>
            <span className="text-xs font-mono py-1 min-w-[3rem] text-center">{(scale * 100).toFixed(0)}%</span>
            <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="p-1 hover:bg-gray-700 rounded"><Minus size={16}/></button>
            <div className="w-px h-6 bg-gray-600 mx-2"></div>
            
            <div className={`flex items-center space-x-2 px-2 py-0.5 rounded text-xs font-bold transition-colors ${isElectron ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' : 'bg-orange-500/20 text-orange-400 border border-orange-500/50'}`}>
                {isElectron ? <Monitor size={14} /> : <Wifi size={14} />}
                <span>{isElectron ? 'ELECTRON NATIVE' : 'WEB SIMULATOR'}</span>
            </div>
        </div>

        {/* Viewport */}
        <div className="w-full h-full" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setIsDragging(false)} onContextMenu={(e) => e.preventDefault()} style={{ cursor: isDragging ? 'grabbing' : (mode === 'measure' ? 'crosshair' : 'grab') }}>
            <div ref={containerRef} className="absolute origin-top-left transition-transform duration-75 ease-out" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}>
                <img src={imageSrc} alt="Motherboard" className="max-w-none pointer-events-none shadow-2xl" onLoad={() => setPosition({x: 50, y: 50})} />
                <div className="absolute inset-0 z-10" onClick={handleImageClick}></div>
                {points.map(point => (
                    <div key={point.id} onClick={(e) => { e.stopPropagation(); if (!isDragging) setSelectedPointId(point.id); }} className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center border-2 shadow-lg cursor-pointer transform hover:scale-125 transition-transform z-20 ${selectedPointId === point.id ? 'bg-yellow-400 border-white text-black' : point.value ? 'bg-green-500 border-white text-white' : 'bg-red-500 border-white text-white'}`} style={{ left: point.x, top: point.y }}>
                        <span className="text-[10px] font-bold">{point.id % 100}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col z-20 shadow-xl relative">
        <div className="p-4 border-b border-gray-700"><h2 className="text-lg font-bold text-white flex items-center"><Activity className="mr-2 text-blue-400" />Medición</h2></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
            {!selectedPoint ? (
                <div className="text-gray-500 text-center mt-10 text-sm">Selecciona un punto.</div>
            ) : (
                <div className="space-y-6">
                    {/* Header Punto */}
                    <div className="flex justify-between items-center">
                        <div className="flex-1 mr-2 flex items-center space-x-2">
                            <input type="text" value={selectedPoint.label} onChange={(e) => setPoints(points.map(p => p.id === selectedPoint.id ? {...p, label: e.target.value} : p))} className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full font-bold" />
                            <button onClick={askAboutPoint} className="p-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded"><Sparkles size={16} /></button>
                        </div>
                        <button onClick={() => { setPoints(points.filter(p => p.id !== selectedPoint.id)); setSelectedPointId(null); }} className="text-red-400 hover:bg-red-900/30 p-2 rounded"><Trash2 size={16} /></button>
                    </div>
                    {/* Selectores */}
                    <div className="grid grid-cols-3 gap-2">
                        {[{id:'voltage', icon:Zap, lbl:'Volt'}, {id:'resistance', icon:ResistorIcon, lbl:'Ohms'}, {id:'oscilloscope', icon:Activity, lbl:'Scope'}].map(t => (
                            <button key={t.id} onClick={() => setPoints(points.map(p => p.id === selectedPoint.id ? {...p, type: t.id} : p))} className={`flex flex-col items-center p-2 rounded border ${selectedPoint.type === t.id ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-400'}`}>
                                <t.icon size={16} /><span className="text-[10px] mt-1">{t.lbl}</span>
                            </button>
                        ))}
                    </div>
                    {/* Display Valor */}
                    <div className="bg-black/40 rounded-lg p-4 border border-gray-700">
                        <div className="text-2xl font-mono text-cyan-400 font-bold mb-3 tracking-wider">{selectedPoint.value || "---"}</div>
                        {selectedPoint.type === 'oscilloscope' && renderWaveform(selectedPoint.waveform)}
                        <button onClick={captureValue} disabled={isCapturing} className={`w-full py-2 rounded font-bold flex items-center justify-center space-x-2 transition-all ${!isCapturing ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                            {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                            <span>{isCapturing ? 'MIDIENDO...' : 'CAPTURAR'}</span>
                        </button>
                    </div>
                    {/* Notas */}
                    <textarea value={selectedPoint.notes} onChange={(e) => setPoints(points.map(p => p.id === selectedPoint.id ? {...p, notes: e.target.value} : p))} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-gray-300 h-24 resize-none" placeholder="Notas..." />
                </div>
            )}
        </div>
        
        <div className="p-4 border-t border-gray-700 bg-gray-800/50 absolute bottom-0 w-full backdrop-blur-sm">
            {points.length > 0 && <button onClick={analyzeBoard} className="w-full mb-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-2 rounded shadow-lg flex items-center justify-center space-x-2"><Sparkles size={16} /><span>Diagnóstico AI</span></button>}
        </div>
      </div>

      {/* CONFIG MODAL */}
      {configOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-600 w-full max-w-md rounded-2xl shadow-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center"><Settings className="mr-2"/> Configuración Hardware</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 uppercase">IP Multímetro (ESP32)</label>
                        <input type="text" value={hwConfig.multimeterIp} onChange={(e) => setHwConfig({...hwConfig, multimeterIp: e.target.value})} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white font-mono text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 uppercase">IP Osciloscopio (Rigol)</label>
                        <input type="text" value={hwConfig.scopeIp} onChange={(e) => setHwConfig({...hwConfig, scopeIp: e.target.value})} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white font-mono text-sm" />
                    </div>
                    <div className="bg-cyan-900/30 p-3 rounded border border-cyan-500/30 text-xs text-cyan-200 flex items-start">
                        <Monitor size={16} className="mr-2 mt-0.5 shrink-0" />
                        <p>Modo Electron Nativo: La conexión TCP se realiza directamente desde el proceso principal (Main Process).</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={() => setConfigOpen(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold">Guardar y Cerrar</button>
                </div>
            </div>
        </div>
      )}

      {/* AI RESULT MODAL */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-600 w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h3 className="text-xl font-bold text-white flex items-center"><Sparkles className="text-purple-400 mr-2" />{aiTitle}</h3>
                    <button onClick={() => setAiModalOpen(false)}><X size={24} className="text-gray-400 hover:text-white" /></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 font-mono text-sm leading-relaxed text-gray-200 bg-gray-900">
                    {isAiLoading ? <div className="flex flex-col items-center justify-center h-48 space-y-4 text-purple-400"><Loader2 size={48} className="animate-spin" /><p>Consultando Gemini AI...</p></div> : <div className="whitespace-pre-wrap">{aiResponse}</div>}
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default BoardLab;