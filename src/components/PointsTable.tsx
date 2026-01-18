import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, Search, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { Point } from '../types';
import Waveform from './Waveform';

interface PointsTableProps {
    mode?: 'view' | 'measure';
}

const PointsTable: React.FC<PointsTableProps> = ({ mode = 'measure' }) => {
    const { points, deletePoint, board, appSettings, currentProject } = useProject();
    const { setPoints, selectedPointId, selectPoint } = board;

    const [editedPoints, setEditedPoints] = useState<Point[]>(JSON.parse(JSON.stringify(points)));
    const [sortColumn, setSortColumn] = useState<string>('label');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [filterText, setFilterText] = useState<string>('');
    const [expandedPointIds, setExpandedPointIds] = useState<Set<string | number>>(new Set());
    const rowRefs = useRef<Record<string | number, HTMLTableRowElement | null>>({});

    const toggleExpand = (id: string | number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedPointIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Filter categories based on current project board type
    const availableCategories = (appSettings.categories || []).filter(cat => 
        !cat.boardType || (currentProject?.board_type && cat.boardType === currentProject.board_type)
    );

    useEffect(() => {
        setEditedPoints(JSON.parse(JSON.stringify(points)));
    }, [points]);

    useEffect(() => {
        if (selectedPointId && rowRefs.current[selectedPointId]) {
            rowRefs.current[selectedPointId]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [selectedPointId]);

    const handleValueChange = (pointId: string | number, measurementType: string, newValue: string) => {
        setEditedPoints(currentPoints =>
            currentPoints.map(p => {
                if (p.id === pointId) {
                    const newMeasurements = { ...p.measurements };
                    if (!newMeasurements[measurementType]) {
                        newMeasurements[measurementType] = { type: measurementType as any, value: newValue, capturedAt: new Date().toISOString() };
                    } else {
                        newMeasurements[measurementType] = {
                            ...newMeasurements[measurementType],
                            value: newValue,
                            capturedAt: new Date().toISOString(),
                        };
                    }
                    return { ...p, measurements: newMeasurements };
                }
                return p;
            })
        );
    };
    
    const handleNotesChange = (pointId: string | number, newNotes: string) => {
        setEditedPoints(currentPoints =>
            currentPoints.map(p => (p.id === pointId ? { ...p, notes: newNotes } : p))
        );
    };

    const handleCategoryChange = (pointId: string | number, newCategory: string) => {
        setEditedPoints(currentPoints =>
            currentPoints.map(p => (p.id === pointId ? { ...p, category: newCategory } : p))
        );
    };

    const handleLabelChange = (pointId: string | number, newLabel: string) => {
        setEditedPoints(currentPoints =>
            currentPoints.map(p => (p.id === pointId ? { ...p, label: newLabel } : p))
        );
    };

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const handleDelete = (pointId: string | number) => {
        if (window.confirm('Are you sure you want to delete this point?')) {
            deletePoint(pointId);
        }
    };

    const commitChanges = () => {
        setPoints(editedPoints);
    };

    const handleSaveChanges = () => {
        setPoints(editedPoints);
    };

    const filteredPoints = editedPoints.filter(point => {
        // Hide replicas/linked points from main list
        if (point.parentPointId) return false;

        const lowerCaseFilterText = filterText.toLowerCase();
        const labelMatch = point.label.toLowerCase().includes(lowerCaseFilterText);
        const notesMatch = point.notes?.toLowerCase().includes(lowerCaseFilterText);
        const categoryMatch = point.category?.toLowerCase().includes(lowerCaseFilterText);
        const measurementMatch = point.measurements && Object.values(point.measurements).some(m => 
            m?.value?.toString().toLowerCase().includes(lowerCaseFilterText)
        );
        return labelMatch || notesMatch || measurementMatch || categoryMatch;
    });

    const sortedAndFilteredPoints = [...filteredPoints].sort((a, b) => {
        let compareA: any, compareB: any;
        if (sortColumn === 'label' || sortColumn === 'notes' || sortColumn === 'category' || sortColumn === 'side') {
            compareA = (a as any)[sortColumn] || '';
            compareB = (b as any)[sortColumn] || '';
            return sortDirection === 'asc' ? compareA.localeCompare(compareB) : compareB.localeCompare(compareA);
        } else if (['voltage', 'resistance', 'diode'].includes(sortColumn)) {
            compareA = parseFloat((a.measurements?.[sortColumn]?.value as string)) || 0;
            compareB = parseFloat((b.measurements?.[sortColumn]?.value as string)) || 0;
            return sortDirection === 'asc' ? compareA - compareB : compareB - compareA;
        }
        return 0;
    });

    const navigateSelection = (direction: number) => {
        const currentIndex = sortedAndFilteredPoints.findIndex(p => p.id === selectedPointId);
        if (currentIndex === -1) {
            if (sortedAndFilteredPoints.length > 0) {
                selectPoint(sortedAndFilteredPoints[0].id);
            }
            return;
        }

        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < sortedAndFilteredPoints.length) {
            selectPoint(sortedAndFilteredPoints[newIndex].id);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateSelection(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateSelection(1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [sortedAndFilteredPoints, selectedPointId]);

    const SortIcon = ({ column }: { column: string }) => {
        if (sortColumn === column) {
            return sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1 inline" /> : <ArrowDown size={14} className="ml-1 inline" />;
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full bg-gray-900/50">
            <div className="px-4 py-2 border-b border-gray-700 flex justify-between items-center">
                <div className="relative flex-1 mr-4">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Filter..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded pl-7 pr-2 py-1 text-xs text-white focus:border-blue-500 outline-none"
                    />
                </div>
                <button 
                    onClick={handleSaveChanges} 
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                >
                    Save Changes
                </button>
            </div>
            
            <div className="flex-1 overflow-auto">
                <table className="text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-gray-800 text-gray-300 sticky top-0 z-10">
                            <th className="p-2 w-8"></th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700 whitespace-nowrap" onClick={() => handleSort('side')}>Side <SortIcon column="side" /></th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('label')}>Label <SortIcon column="label" /></th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('category')}>Category <SortIcon column="category" /></th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('voltage')}>Volt <SortIcon column="voltage" /></th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('resistance')}>Ω <SortIcon column="resistance" /></th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('diode')}>Diode <SortIcon column="diode" /></th>
                            <th className="p-2 w-10 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {sortedAndFilteredPoints.map((point, index) => {
                            const childPoints = editedPoints.filter(p => p.parentPointId === point.id);
                            const hasChildren = childPoints.length > 0;
                            const hasExpandableContent = point.notes || point.measurements?.oscilloscope || hasChildren;

                            return (
                            <React.Fragment key={point.id}>
                                <tr
                                    ref={el => { rowRefs.current[point.id] = el; }}
                                    className={`hover:bg-gray-800/50 cursor-pointer ${selectedPointId === point.id ? 'bg-blue-900/30' : ''}`}
                                    onClick={() => selectPoint(point.id)}
                                >
                                    <td className="p-2 text-center">
                                        {hasExpandableContent && (
                                            <button onClick={(e) => toggleExpand(point.id, e)} className="text-gray-400 hover:text-white">
                                                {expandedPointIds.has(point.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                        )}
                                    </td>
                                    <td className="p-2 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${point.side === 'B' ? 'bg-purple-900/80 text-purple-200' : 'bg-blue-900/80 text-blue-200'}`}>
                                                {point.side || 'A'}
                                            </span>
                                            {hasChildren && (
                                                <span className="text-[9px] text-gray-500 mt-0.5">+{childPoints.length}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="text" 
                                            value={point.label} 
                                            onChange={(e) => handleLabelChange(point.id, e.target.value)}
                                            onBlur={commitChanges}
                                            onClick={(e) => e.stopPropagation()} 
                                            readOnly={mode === 'view'}
                                            style={{ width: `${Math.max(point.label.length, 4) + 2}ch` }}
                                            className={`bg-transparent border-b border-transparent ${mode === 'view' ? 'cursor-default' : 'focus:border-blue-500'} outline-none text-white font-bold`} 
                                        />
                                    </td>
                                    <td className="p-2">
                                        <select 
                                            value={point.category || ''} 
                                            onChange={(e) => {
                                                handleCategoryChange(point.id, e.target.value);
                                            }}
                                            onBlur={commitChanges}
                                            onClick={(e) => e.stopPropagation()}
                                            disabled={mode === 'view'}
                                            style={{ 
                                                backgroundColor: availableCategories.find(c => c.id === point.category)?.color,
                                                color: point.category ? '#fff' : undefined,
                                                textShadow: point.category ? '0 1px 2px rgba(0,0,0,0.8)' : undefined,
                                                appearance: mode === 'view' ? 'none' : 'auto',
                                                WebkitAppearance: mode === 'view' ? 'none' : 'auto',
                                                MozAppearance: mode === 'view' ? 'none' : 'auto'
                                            }}
                                            className={`bg-gray-800 w-16 p-0.5 rounded text-[10px] text-white border border-gray-600 outline-none disabled:opacity-100 font-bold ${mode === 'view' ? 'text-center' : ''}`}
                                        >
                                            <option value="" style={{ backgroundColor: '#1f2937', color: 'white', textShadow: 'none' }}>-</option>
                                            {availableCategories.map(cat => (
                                                <option 
                                                    key={cat.id} 
                                                    value={cat.id}
                                                    style={{ backgroundColor: cat.color, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                                                >
                                                    {cat.label}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <input type="text" defaultValue={(point.measurements?.voltage?.value as string) || ''} onBlur={(e) => handleValueChange(point.id, 'voltage', e.target.value)} onClick={(e) => e.stopPropagation()} readOnly={mode === 'view'} className={`bg-gray-800 w-20 p-0.5 rounded text-right ${mode === 'view' ? 'text-gray-300' : ''}`} />
                                    </td>
                                    <td className="p-2">
                                        <input type="text" defaultValue={(point.measurements?.resistance?.value as string) || ''} onBlur={(e) => handleValueChange(point.id, 'resistance', e.target.value)} onClick={(e) => e.stopPropagation()} readOnly={mode === 'view'} className={`bg-gray-800 w-20 p-0.5 rounded text-right ${mode === 'view' ? 'text-gray-300' : ''}`} />
                                    </td>
                                    <td className="p-2">
                                        <input type="text" defaultValue={(point.measurements?.diode?.value as string) || ''} onBlur={(e) => handleValueChange(point.id, 'diode', e.target.value)} onClick={(e) => e.stopPropagation()} readOnly={mode === 'view'} className={`bg-gray-800 w-20 p-0.5 rounded text-right ${mode === 'view' ? 'text-gray-300' : ''}`} />
                                    </td>
                                    <td className="p-2 text-center">
                                        {mode !== 'view' && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(point.id); }} className="text-red-400 hover:text-red-300 opacity-50 hover:opacity-100" title="Delete Point">
                                            <Trash2 size={14} />
                                        </button>
                                        )}
                                    </td>
                                </tr>
                                {expandedPointIds.has(point.id) && (
                                    <tr className="bg-gray-800/30">
                                        <td colSpan={8} className="p-4 border-b border-gray-700 shadow-inner">
                                            <div className="flex flex-col gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-400 block mb-1 font-bold">Notes</label>
                                                    <textarea 
                                                        value={point.notes || ''} 
                                                        onChange={(e) => handleNotesChange(point.id, e.target.value)} 
                                                        onBlur={commitChanges} 
                                                        onClick={(e) => e.stopPropagation()} 
                                                        readOnly={mode === 'view'} 
                                                        className={`bg-gray-900 border border-gray-600 rounded p-2 text-sm text-gray-300 w-full h-20 resize-none outline-none ${mode === 'view' ? 'cursor-default' : 'focus:border-blue-500'}`} 
                                                        placeholder="Technical notes..."
                                                    />
                                                </div>
                                                
                                                {hasChildren && (
                                                    <div>
                                                        <label className="text-xs text-gray-400 block mb-1 font-bold">Linked Locations (Duplicates)</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {childPoints.map(child => (
                                                                <button 
                                                                    key={child.id}
                                                                    onClick={(e) => { e.stopPropagation(); selectPoint(child.id); }}
                                                                    className={`px-2 py-1 rounded text-xs border flex items-center gap-1 transition-colors ${selectedPointId === child.id ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                                                                >
                                                                    <span className={`w-2 h-2 rounded-full ${child.side === 'B' ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
                                                                    <span>Side {child.side || 'A'}</span>
                                                                    <span className="opacity-50 text-[10px]">({Math.round(child.x)}, {Math.round(child.y)})</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {point.measurements?.oscilloscope && (
                                                    <div className="bg-black/40 rounded-lg p-4 border border-gray-700">
                                                        <div className="text-xs text-gray-400 mb-2 font-bold">Oscillogram</div>
                                                        <Waveform pointData={point} />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PointsTable;
