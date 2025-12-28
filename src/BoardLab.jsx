import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, Minus, Move, Crosshair, Wifi, Save, Upload, Trash2, 
  Activity, Zap, Cpu, Sparkles, X, Loader2, Settings as SettingsIcon, Monitor 
} from 'lucide-react';
import Settings from './components/Settings'; // Importar el nuevo componente

const BoardLab = () => {
  // --- CONFIGURACIÓN ---
  const [configOpen, setConfigOpen] = useState(false);
  // Estado de configuración de instrumentos más detallado
  const [instrumentConfig, setInstrumentConfig] = useState({
    multimeter: {
        ip: "192.168.0.202",
        port: 9876,
        commands: {
            measure_voltage: "MEAS:VOLT:DC?",
            measure_resistance: "MEAS:RES?"
        }
    },
    oscilloscope: {
        ip: "192.168.0.200",
        port: 5555,
        commands: {
            prepare_waveform: ":WAV:SOUR CHAN1",
            request_waveform: ":WAV:DATA?"
        }
    }
  });

  const isElectron = window.electronAPI?.isElectron || false;

  // Cargar configuración al iniciar (si es Electron)
  useEffect(() => {
    if (isElectron) {
      window.electronAPI.loadConfig().then(config => {
        if (config) {
          setInstrumentConfig(config);
        }
      });
    }
  }, [isElectron]);

  const handleSaveConfig = (newConfig) => {
    setInstrumentConfig(newConfig);
    if (isElectron) {
      window.electronAPI.saveConfig(newConfig);
    }
  };
  
  // --- ESTADOS ---
  const [imageSrc, setImageSrc] = useState(null); // Null para mostrar placeholder
  const [points, setPoints] = useState([]);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [mode, setMode] = useState('view');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isCapturing, setIsCapturing] = useState(false);
  
  // IA
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiTitle, setAiTitle] = useState("");

  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectedPoint = points.find(p => p.id === selectedPointId);

  // --- GEMINI AI ---
  const callGemini = async (prompt, title) => {
    // IMPORTANTE: Inserta tu API Key aquí si usas la versión Web
    const apiKey = ""; 
    
    setAiTitle(title);
    setAiModalOpen(true);
    setIsAiLoading(true);
    setAiResponse("");

    if (!apiKey) {
        setAiResponse("⚠️ Error: Falta la API Key de Gemini en el código (src/BoardLab.jsx).");
        setIsAiLoading(false);
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";
        setAiResponse(text);
    } catch (error) {
        setAiResponse("Error de conexión con IA.");
    } finally {
        setIsAiLoading(false);
    }
  };

  const analyzeBoard = () => {
    if (points.length === 0) return alert("Agrega puntos primero.");
    const measurements = points.map(p => `- ${p.label} (${p.type}): ${p.value || 'N/A'}. Notas: ${p.notes}`).join('\n');
    callGemini(`Analiza estas mediciones de motherboard y da diagnóstico:\n${measurements}`, "Diagnóstico Inteligente");
  };

  const askAboutPoint = () => {
    if (!selectedPoint) return;
    callGemini(`Analiza punto "${selectedPoint.label}" tipo ${selectedPoint.type}. ¿Qué función tiene y qué valor esperar?`, `Consulta: ${selectedPoint.label}`);
  };

  // --- CAPTURA DE HARDWARE ---
  const captureValue = async () => {
    if (!selectedPointId) return;
    setIsCapturing(true);
    const currentPoint = points.find(p => p.id === selectedPointId);
    let result = { status: 'error' };

    try {
        if (isElectron) {
            console.log("Midiendo hardware real...");
            if (currentPoint.type === 'oscilloscope') {
                result = await window.electronAPI.measureScope(instrumentConfig.oscilloscope);
            } else {
                const command = currentPoint.type === 'voltage' ? 
                    instrumentConfig.multimeter.commands.measure_voltage : 
                    instrumentConfig.multimeter.commands.measure_resistance;
                
                result = await window.electronAPI.measureMultimeter({
                    ip: instrumentConfig.multimeter.ip,
                    port: instrumentConfig.multimeter.port,
                    command: command,
                });
            }
        } else {
            // Simulación Web
            await new Promise(r => setTimeout(r, 500));
            const val = (Math.random() * 5).toFixed(3) + " V";
            result = { status: 'success', value: val };
        }

        if (result.status === 'success') {
             const updatedPoints = points.map(p => p.id === selectedPointId ? { ...p, value: result.value, waveform: result.waveform || null } : p);
             setPoints(updatedPoints);
        } else {
            alert(`Error: ${result.message}`);
        }
    } catch (e) {
        alert("Error de comunicación.");
    } finally {
        setIsCapturing(false);
    }
  };

  // --- EVENTOS DE MOUSE & ZOOM ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => { setImageSrc(ev.target.result); setPoints([]); setScale(1); setPosition({x:0, y:0}); };
      reader.readAsDataURL(file);
    }
  };

  const handleWheel = (e) => {
    if (e.ctrlKey) return; 
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const imgX = (mouseX - position.x) / scale;
    const imgY = (mouseY - position.y) / scale;
    const newScale = Math.min(Math.max(0.1, scale + (-e.deltaY * 0.001)), 20);
    setPosition({ x: mouseX - (imgX * newScale), y: mouseY - (imgY * newScale) });
    setScale(newScale);
  };

  const handleMouseDown = (e) => {
    if ((mode === 'view' && e.button === 0) || e.button === 2) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleImageClick = (e) => {
    if (mode === 'measure' && !isDragging && e.button === 0) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      const newPoint = { id: Date.now(), x, y, label: `TP${points.length + 1}`, type: 'voltage', value: null, notes: '' };
      setPoints([...points, newPoint]);
      setSelectedPointId(newPoint.id);
    }
  };

  const renderWaveform = (data) => {
    if (!data) return null;
    const pointsStr = data.map((val, i) => `${(i / (data.length - 1)) * 200},${60 - ((val - Math.min(...data)) / (Math.max(...data) - Math.min(...data) || 1)) * 60}`).join(' ');
    return <svg width="100%" height={60} className="bg-gray-900 border border-gray-700 mt-2 rounded"><polyline points={pointsStr} fill="none" stroke="#10b981" strokeWidth="1.5"/></svg>;
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
      
      {/* SIDEBAR IZQUIERDO */}
      <div className="w-16 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-4 space-y-4 z-20 shadow-lg">
        <div className="p-2 bg-blue-600 rounded-lg mb-4"><Cpu size={24} /></div>
        <button onClick={() => setMode('view')} className={`p-3 rounded-xl transition ${mode === 'view' ? 'bg-blue-600 shadow-lg' : 'hover:bg-gray-700 text-gray-400'}`}><Move size={20} /></button>
        <button onClick={() => setMode('measure')} className={`p-3 rounded-xl transition ${mode === 'measure' ? 'bg-red-500 shadow-lg' : 'hover:bg-gray-700 text-gray-400'}`}><Crosshair size={20} /></button>
        <div className="h-px w-8 bg-gray-700 my-2"></div>
        <button onClick={() => fileInputRef.current.click()} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl"><Upload size={20} /></button>
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
        <div className="flex-1"></div>
        <button onClick={() => setConfigOpen(true)} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl"><SettingsIcon size={20} /></button>
      </div>

      {/* ÁREA DE TRABAJO (CANVAS) */}
      <div className="flex-1 relative bg-gray-950 overflow-hidden select-none">
        {/* Status Bar */}
        <div className="absolute top-4 left-4 z-10 flex space-x-2 bg-gray-800/90 backdrop-blur p-2 rounded-lg shadow-xl border border-gray-700 items-center">
            <button onClick={() => setScale(s => s + 0.1)} className="p-1 hover:bg-gray-700 rounded"><Plus size={16}/></button>
            <span className="text-xs font-mono w-12 text-center">{(scale * 100).toFixed(0)}%</span>
            <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="p-1 hover:bg-gray-700 rounded"><Minus size={16}/></button>
            <div className="w-px h-4 bg-gray-600 mx-2"></div>
            <div className={`flex items-center space-x-2 px-2 py-0.5 rounded text-xs font-bold ${isElectron ? 'text-cyan-400 bg-cyan-900/30 border border-cyan-500/30' : 'text-orange-400 bg-orange-900/30 border border-orange-500/30'}`}>
                {isElectron ? <Monitor size={14} /> : <Wifi size={14} />}
                <span>{isElectron ? 'ELECTRON' : 'WEB DEMO'}</span>
            </div>
        </div>

        {/* Viewport Imagen */}
        <div className="w-full h-full" 
             onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={(e) => isDragging && setPosition({x: e.clientX - dragStart.x, y: e.clientY - dragStart.y})} 
             onMouseUp={() => setIsDragging(false)} onContextMenu={(e) => e.preventDefault()} 
             style={{ cursor: isDragging ? 'grabbing' : mode === 'measure' ? 'crosshair' : 'grab' }}>
            
            <div ref={containerRef} className="absolute origin-top-left transition-transform duration-75 ease-out" 
                 style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}>
                
                {imageSrc ? (
                    <img src={imageSrc} className="max-w-none shadow-2xl pointer-events-none" onLoad={() => setPosition({x: 50, y: 50})} />
                ) : (
                    <div className="w-[800px] h-[600px] bg-gray-900 flex items-center justify-center border-2 border-dashed border-gray-700 rounded-xl">
                        <div className="text-gray-500 text-center">
                            <Upload size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Sube una imagen de la placa para comenzar</p>
                        </div>
                    </div>
                )}
                
                <div className="absolute inset-0 z-10" onClick={handleImageClick}></div>
                
                {points.map(p => (
                    <div key={p.id} onClick={(e) => { e.stopPropagation(); if(!isDragging) setSelectedPointId(p.id); }}
                         className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 shadow-lg flex items-center justify-center cursor-pointer transform hover:scale-125 transition z-20 ${selectedPointId === p.id ? 'bg-yellow-400 border-black text-black' : p.value ? 'bg-green-500 border-white text-white' : 'bg-red-500 border-white text-white'}`}
                         style={{ left: p.x, top: p.y }}>
                        <span className="text-[10px] font-bold">{p.id % 100}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col z-20 shadow-xl">
        <div className="p-4 border-b border-gray-700"><h2 className="text-lg font-bold text-white flex items-center"><Activity className="mr-2 text-blue-400" />Datos</h2></div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!selectedPoint ? (
                <div className="text-gray-500 text-center mt-10 text-sm">Selecciona un punto.</div>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="flex justify-between items-center">
                        <div className="flex-1 mr-2 flex space-x-2">
                            <input value={selectedPoint.label} onChange={(e) => setPoints(points.map(p => p.id === selectedPoint.id ? {...p, label: e.target.value} : p))} className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full font-bold" />
                            <button onClick={askAboutPoint} className="p-2 bg-purple-600/20 text-purple-300 rounded hover:bg-purple-600/40"><Sparkles size={16}/></button>
                        </div>
                        <button onClick={() => { setPoints(points.filter(p => p.id !== selectedPoint.id)); setSelectedPointId(null); }} className="text-red-400 p-2 hover:bg-red-900/30 rounded"><Trash2 size={16}/></button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {[{id:'voltage', icon:Zap, lbl:'Volt'}, {id:'resistance', icon:Cpu, lbl:'Ohms'}, {id:'oscilloscope', icon:Activity, lbl:'Scope'}].map(t => (
                            <button key={t.id} onClick={() => setPoints(points.map(p => p.id === selectedPoint.id ? {...p, type: t.id} : p))} className={`flex flex-col items-center p-2 rounded border ${selectedPoint.type === t.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                <t.icon size={16} /><span className="text-[10px] mt-1">{t.lbl}</span>
                            </button>
                        ))}
                    </div>

                    <div className="bg-black/40 rounded-lg p-4 border border-gray-700">
                        <div className="text-2xl font-mono text-cyan-400 font-bold mb-3">{selectedPoint.value || "---"}</div>
                        {selectedPoint.type === 'oscilloscope' && renderWaveform(selectedPoint.waveform)}
                        <button onClick={captureValue} disabled={isCapturing} className={`w-full py-2 rounded font-bold flex items-center justify-center space-x-2 transition ${!isCapturing ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'}`}>
                            {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                            <span>{isCapturing ? 'MIDIENDO...' : 'CAPTURAR'}</span>
                        </button>
                    </div>

                    <textarea value={selectedPoint.notes} onChange={(e) => setPoints(points.map(p => p.id === selectedPoint.id ? {...p, notes: e.target.value} : p))} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-gray-300 h-24 resize-none" placeholder="Notas técnicas..." />
                </div>
            )}
        </div>

        {points.length > 0 && <div className="p-4 border-t border-gray-700"><button onClick={analyzeBoard} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-2 rounded shadow-lg flex items-center justify-center space-x-2"><Sparkles size={16} /><span>Diagnóstico AI</span></button></div>}
      </div>

      {/* MODALES */}
      {configOpen && <Settings instruments={instrumentConfig} onSave={handleSaveConfig} onClose={() => setConfigOpen(false)} />}

      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-gray-800 border border-gray-600 w-full max-w-2xl max-h-[80vh] rounded-2xl flex flex-col">
                <div className="p-4 border-b border-gray-700 flex justify-between bg-gray-900/50"><h3 className="text-xl font-bold text-white flex items-center"><Sparkles className="text-purple-400 mr-2" />{aiTitle}</h3><button onClick={() => setAiModalOpen(false)}><X size={24} className="text-gray-400 hover:text-white" /></button></div>
                <div className="p-6 overflow-y-auto flex-1 font-mono text-sm leading-relaxed text-gray-200 bg-gray-900">{isAiLoading ? <div className="flex flex-col items-center h-24 justify-center"><Loader2 className="animate-spin text-purple-500" /></div> : <div className="whitespace-pre-wrap">{aiResponse}</div>}</div>
            </div>
        </div>
      )}
    </div>
  );
};

export default BoardLab;