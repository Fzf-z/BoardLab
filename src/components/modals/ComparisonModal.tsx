import React, { useState, useEffect } from 'react';
import { Project, Point } from '../../types';
import { Search, Folder, Zap, Activity, Filter, CheckCircle2 } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';

interface ComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPoint: Point | null;
    onImportReference: (sourcePoint: Point) => void;
}

const ComparisonModal: React.FC<ComparisonModalProps> = ({ isOpen, onClose, currentPoint, onImportReference }) => {
    const { projectList } = useProject();
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [points, setPoints] = useState<Point[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Filters
    const [pointSearchTerm, setPointSearchTerm] = useState('');
    const [projectSearchTerm, setProjectSearchTerm] = useState('');
    const [selectedBoardType, setSelectedBoardType] = useState<string>('');
    
    // Deep Search (search inside points of all projects)
    const [pointFilterQuery, setPointFilterQuery] = useState('');
    const [matchingProjectIds, setMatchingProjectIds] = useState<number[] | null>(null);

    const [matchType, setMatchType] = useState(true);

    // Autocomplete states
    const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
    const [showPointSuggestions, setShowPointSuggestions] = useState(false);

    const uniqueBoardTypes = Array.from(new Set(projectList.map(p => p.board_type))).filter(Boolean);
    
    // Extract models and all attribute values for autocomplete
    const uniqueSuggestions = React.useMemo(() => {
        const suggestions = new Set<string>();
        
        projectList.forEach(p => {
            if (p.board_model) suggestions.add(p.board_model);
            
            try {
                const attrs = typeof p.attributes === 'string' ? JSON.parse(p.attributes) : p.attributes;
                if (attrs && typeof attrs === 'object') {
                    Object.values(attrs).forEach((val: any) => {
                         if (typeof val === 'string' && val.length > 1 && val.length < 20) {
                             suggestions.add(val);
                         }
                    });
                }
            } catch (e) { /* ignore */ }
        });

        return Array.from(suggestions);
    }, [projectList]);

    useEffect(() => {
        if (isOpen) {
            setSelectedProject(null);
            setPoints([]);
            setPointSearchTerm(currentPoint?.label || '');
            setProjectSearchTerm('');
            setSelectedBoardType('');
            setPointFilterQuery('');
            setMatchingProjectIds(null);
            setMatchType(true);
        }
    }, [isOpen, currentPoint]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (pointFilterQuery.trim().length > 0 && window.electronAPI) {
                window.electronAPI.searchProjectsByPoint(pointFilterQuery)
                    .then(ids => setMatchingProjectIds(ids))
                    .catch(err => console.error("Search points failed", err));
            } else {
                setMatchingProjectIds(null);
            }
        }, 400); // Debounce
        return () => clearTimeout(timer);
    }, [pointFilterQuery]);

    useEffect(() => {
        if (selectedProject && window.electronAPI) {
            setIsLoading(true);
            window.electronAPI.getPoints(selectedProject.id)
                .then(pts => {
                    setPoints(pts);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching points:", err);
                    setIsLoading(false);
                });
        }
    }, [selectedProject]);

    if (!isOpen) return null;

    // Filter Projects
    const filteredProjects = projectList.filter(proj => {
        const query = projectSearchTerm.toLowerCase();
        const modelMatch = proj.board_model.toLowerCase().includes(query);
        const typeMatch = proj.board_type.toLowerCase().includes(query);
        
        let attrMatch = false;
        try {
            // Check if attributes is a string (JSON) or object. It's defined as string in types, but handled as object in context sometimes?
            // ProjectContext usually parses it in getProjects. 
            // Let's assume it might be an object or string.
            const attrs = typeof proj.attributes === 'string' ? JSON.parse(proj.attributes) : proj.attributes;
            if (attrs && typeof attrs === 'object') {
                attrMatch = Object.values(attrs).some((val: any) => 
                    String(val).toLowerCase().includes(query)
                );
            }
        } catch (e) { /* ignore */ }

        const matchesSearch = modelMatch || typeMatch || attrMatch;
        const matchesTypeFilter = selectedBoardType ? proj.board_type === selectedBoardType : true;
        const matchesDeepSearch = matchingProjectIds === null || matchingProjectIds.includes(proj.id);

        return matchesSearch && matchesTypeFilter && matchesDeepSearch;
    });

    // Filter Points
    const filteredPoints = points.filter(p => {
        const nameMatch = p.label.toLowerCase().includes(pointSearchTerm.toLowerCase()) || 
                          (p.notes && p.notes.toLowerCase().includes(pointSearchTerm.toLowerCase()));
        
        const typeMatch = matchType && currentPoint ? p.type === currentPoint.type : true;
        
        return nameMatch && typeMatch;
    });

    const AttributeBadge = ({ attributes }: { attributes: Project['attributes'] }) => {
        let attrs: Record<string, string> = {};
        if (typeof attributes === 'string') {
            try { attrs = JSON.parse(attributes); } catch (e) { return null; }
        } else if (typeof attributes === 'object' && attributes !== null) {
            attrs = attributes as Record<string, string>;
        }

        const importantKeys = ['CPU', 'GPU', 'RAM'];
        const displayAttrs = Object.entries(attrs)
            .filter(([key]) => importantKeys.includes(key.toUpperCase()))
            .slice(0, 2);

        if (displayAttrs.length === 0) return null;

        return (
            <div className="flex flex-wrap gap-1 mt-1">
                {displayAttrs.map(([key, val]) => (
                    <span key={key} className="text-[9px] bg-gray-700/60 text-gray-400 px-1.5 py-0.5 rounded">
                        <strong>{key}:</strong> {val}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-[900px] max-h-[85vh] flex flex-col border border-gray-700">
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <Activity className="mr-2 text-purple-400" />
                        Comparar con "Golden Board"
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left: Project List */}
                    <div className="w-1/3 border-r border-gray-700 flex flex-col bg-gray-800/50">
                        <div className="p-2 border-b border-gray-700 bg-gray-800">
                            <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider flex items-center">
                                <Filter size={12} className="mr-1" />
                                Filtrar Proyectos
                            </h3>
                            
                            <select 
                                value={selectedBoardType} 
                                onChange={(e) => setSelectedBoardType(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white mb-2 outline-none focus:border-purple-500"
                            >
                                <option value="">Todos los tipos</option>
                                {uniqueBoardTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>

                            <div className="relative mb-2">
                                <Search className="absolute left-2 top-2 text-gray-500" size={12} />
                                <input
                                    type="text"
                                    value={projectSearchTerm}
                                    onChange={(e) => {
                                        setProjectSearchTerm(e.target.value);
                                        setShowProjectSuggestions(true);
                                    }}
                                    onFocus={() => setShowProjectSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowProjectSuggestions(false), 200)}
                                    placeholder="Modelo, tipo, CPU..."
                                    className="w-full bg-gray-900 border border-gray-600 rounded pl-7 pr-2 py-1 text-xs text-white focus:border-purple-500 outline-none transition"
                                />
                                {showProjectSuggestions && projectSearchTerm.length > 0 && (
                                    <div className="absolute z-10 w-full bg-gray-800 border border-gray-600 rounded mt-1 max-h-32 overflow-y-auto shadow-lg">
                                        {uniqueSuggestions.filter(s => s.toLowerCase().includes(projectSearchTerm.toLowerCase())).map(suggestion => (
                                            <div 
                                                key={suggestion} 
                                                className="px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer"
                                                onClick={() => setProjectSearchTerm(suggestion)}
                                            >
                                                {suggestion}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                             <div className="relative">
                                <Zap className="absolute left-2 top-2 text-yellow-500" size={12} />
                                <input
                                    type="text"
                                    value={pointFilterQuery}
                                    onChange={(e) => setPointFilterQuery(e.target.value)}
                                    placeholder="Contiene punto (ej. 3.3V)..."
                                    className="w-full bg-gray-900 border border-gray-600 rounded pl-7 pr-2 py-1 text-xs text-white focus:border-yellow-500 outline-none transition"
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {filteredProjects.length > 0 ? filteredProjects.map(proj => (
                                <button
                                    key={proj.id}
                                    onClick={() => setSelectedProject(proj)}
                                    className={`w-full text-left p-2 rounded text-sm flex items-center ${selectedProject?.id === proj.id ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                >
                                    <Folder size={14} className="mr-2 flex-shrink-0" />
                                    <div className="truncate min-w-0">
                                        <div className="font-bold truncate">{proj.board_model}</div>
                                        <div className="text-[10px] opacity-70 truncate flex items-center">
                                            <span className="bg-gray-900/50 px-1 rounded mr-1">{proj.board_type}</span>
                                        </div>                                        <AttributeBadge attributes={proj.attributes} />                                    </div>
                                </button>
                            )) : (
                                <div className="text-center text-gray-500 text-xs mt-4">No se encontraron proyectos.</div>
                            )}
                        </div>
                    </div>

                    {/* Right: Points List */}
                    <div className="w-2/3 flex flex-col bg-gray-900/30">
                        {selectedProject ? (
                            <>
                                <div className="p-2 border-b border-gray-700 flex flex-col gap-2 bg-gray-800/30">
                                    {/* Search Bar */}
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 text-gray-500" size={14} />
                                        <input
                                            type="text"
                                            value={pointSearchTerm}
                                            onChange={(e) => setPointSearchTerm(e.target.value)}
                                            placeholder="Buscar punto..."
                                            className="w-full bg-gray-900 border border-gray-600 rounded pl-8 pr-2 py-1.5 text-sm text-white focus:border-purple-500 outline-none transition"
                                        />
                                    </div>
                                    
                                    {/* Filter Controls */}
                                    <div className="flex items-center space-x-4 px-1">
                                        <label className="flex items-center space-x-2 text-xs text-gray-300 cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={matchType} 
                                                onChange={(e) => setMatchType(e.target.checked)}
                                                className="form-checkbox bg-gray-900 border-gray-600 rounded text-purple-500 focus:ring-0 w-3 h-3"
                                            />
                                            <span>Solo {currentPoint?.type || 'mismo tipo'}</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                    {isLoading ? (
                                        <div className="text-center text-gray-500 mt-10 flex flex-col items-center">
                                            <Activity className="animate-spin mb-2" />
                                            Cargando puntos...
                                        </div>
                                    ) : filteredPoints.length > 0 ? (
                                        filteredPoints.map(p => (
                                            <div key={p.id} className="bg-gray-800 p-3 rounded border border-gray-700 hover:border-purple-500/50 transition group">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-bold text-white flex items-center">
                                                            {p.label}
                                                            {p.type === 'oscilloscope' && <Activity size={12} className="ml-2 text-yellow-400" />}
                                                            {p.type === 'voltage' && <Zap size={12} className="ml-2 text-blue-400" />}
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-1">
                                                            {p.measurements && p.measurements[p.type] ? (
                                                                <span className="font-mono text-cyan-300">
                                                                    {typeof p.measurements[p.type]?.value === 'object' 
                                                                        ? 'Datos Osciloscopio' 
                                                                        : p.measurements[p.type]?.value}
                                                                </span>
                                                            ) : 'Sin datos'}
                                                        </div>
                                                        {(p.tolerance || p.expected_value) && (
                                                            <div className="text-[10px] text-gray-500 mt-1">
                                                                Ref: {p.expected_value} (±{p.tolerance}%)
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => onImportReference(p)}
                                                        className="bg-gray-700 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs transition opacity-0 group-hover:opacity-100 flex items-center"
                                                    >
                                                        <CheckCircle2 size={12} className="mr-1" />
                                                        Usar
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-gray-500 mt-10 text-sm">
                                            No se encontraron puntos coincidentes.
                                            {matchType && <div className="mt-1 text-xs opacity-70">Prueba desactivando el filtro de tipo.</div>}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                                <Folder size={48} className="mb-4 opacity-20" />
                                <p>Selecciona un proyecto para explorar.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComparisonModal;
