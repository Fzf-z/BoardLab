import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, Search, Trash2 } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { Point } from '../types';
import WaveformThumbnail from './WaveformThumbnail';

const PointsTable: React.FC = () => {
    const { points, deletePoint, board, appSettings } = useProject();
    const { setPoints, selectedPointId, setSelectedPointId, selectPoint } = board;

    const [editedPoints, setEditedPoints] = useState<Point[]>(JSON.parse(JSON.stringify(points)));
    const [sortColumn, setSortColumn] = useState<string>('label');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [filterText, setFilterText] = useState<string>('');
    const rowRefs = useRef<Record<string | number, HTMLTableRowElement | null>>({});

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
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-gray-800 text-gray-300 sticky top-0 z-10">
                            <th className="p-2 w-8 text-center">#</th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700 whitespace-nowrap" onClick={() => handleSort('side')}>Side <SortIcon column="side" /></th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('label')}>Label <SortIcon column="label" /></th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('category')}>Cat <SortIcon column="category" /></th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('voltage')}>V <SortIcon column="voltage" /></th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('resistance')}>Ω <SortIcon column="resistance" /></th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('diode')}>D <SortIcon column="diode" /></th>
                            <th className="p-2">Scope</th>
                            <th className="p-2 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('notes')}>Notes <SortIcon column="notes" /></th>
                            <th className="p-2 w-10 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {sortedAndFilteredPoints.map((point, index) => (
                            <tr
                                key={point.id}
                                ref={el => { rowRefs.current[point.id] = el; }}
                                className={`hover:bg-gray-800/50 cursor-pointer ${selectedPointId === point.id ? 'bg-blue-900/30' : ''}`}
                                onClick={() => selectPoint(point.id)}
                            >
                                <td className="p-2 text-center text-gray-500">{sortedAndFilteredPoints.length - index}</td>
                                <td className="p-2 text-center">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${point.side === 'B' ? 'bg-purple-900/80 text-purple-200' : 'bg-blue-900/80 text-blue-200'}`}>
                                        {point.side || 'A'}
                                    </span>
                                </td>
                                <td className="p-2">
                                    <input 
                                        type="text" 
                                        value={point.label} 
                                        onChange={(e) => handleLabelChange(point.id, e.target.value)}
                                        onBlur={commitChanges}
                                        onClick={(e) => e.stopPropagation()} 
                                        className="bg-transparent w-full border-b border-transparent focus:border-blue-500 outline-none text-white font-bold" 
                                    />
                                </td>
                                <td className="p-2">
                                    <select 
                                        value={point.category || ''} 
                                        onChange={(e) => {
                                            handleCategoryChange(point.id, e.target.value);
                                            // For select, we commit immediately after change because there is no blur flow needed like text
                                            // But since state update is async, we can't call commitChanges immediately with old state.
                                            // We need to update local state AND global state.
                                            // The simplest way is to let the local state update, and rely on user clicking away? 
                                            // No, for select it's better to save immediately.
                                            // We'll modify handleCategoryChange to save too or use a timeout/effect.
                                            // Actually, let's just trigger a blur-like save or pass the new value up.
                                            // For simplicity, I'll stick to local state and let the user click "Save" or click away if I add onBlur, 
                                            // but select onBlur is tricky.
                                            // Let's defer commit to a useEffect or helper.
                                            // Re-reading: The user wants "edit name... change name".
                                            // I'll add onBlur to select too for consistency.
                                        }}
                                        onBlur={commitChanges}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-gray-800 w-16 p-0.5 rounded text-[10px] text-white border border-gray-600 outline-none"
                                    >
                                        <option value="">-</option>
                                        {appSettings.categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-2">
                                    <input type="text" defaultValue={(point.measurements?.voltage?.value as string) || ''} onBlur={(e) => handleValueChange(point.id, 'voltage', e.target.value)} onClick={(e) => e.stopPropagation()} className="bg-gray-800 w-20 p-0.5 rounded text-right" />
                                </td>
                                <td className="p-2">
                                    <input type="text" defaultValue={(point.measurements?.resistance?.value as string) || ''} onBlur={(e) => handleValueChange(point.id, 'resistance', e.target.value)} onClick={(e) => e.stopPropagation()} className="bg-gray-800 w-20 p-0.5 rounded text-right" />
                                </td>
                                <td className="p-2">
                                    <input type="text" defaultValue={(point.measurements?.diode?.value as string) || ''} onBlur={(e) => handleValueChange(point.id, 'diode', e.target.value)} onClick={(e) => e.stopPropagation()} className="bg-gray-800 w-20 p-0.5 rounded text-right" />
                                </td>
                                <td className="p-2">
                                    {point.measurements?.oscilloscope ? (
                                         <div className="scale-75 origin-left">
                                            <WaveformThumbnail measurement={point.measurements.oscilloscope} width={80} height={40} />
                                         </div>
                                    ) : <span className="text-gray-600 text-[10px]">-</span>}
                                </td>
                                <td className="p-2">
                                    <input type="text" value={point.notes || ''} onChange={(e) => handleNotesChange(point.id, e.target.value)} onBlur={commitChanges} onClick={(e) => e.stopPropagation()} className="bg-transparent border-b border-transparent focus:border-gray-500 w-full text-gray-400 outline-none" />
                                </td>
                                <td className="p-2 text-center">
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(point.id); }} className="text-red-400 hover:text-red-300 opacity-50 hover:opacity-100" title="Delete Point">
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PointsTable;
