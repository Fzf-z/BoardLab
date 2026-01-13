import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowUp, ArrowDown, Search, Trash2 } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { Point } from '../../types';
import WaveformThumbnail from '../WaveformThumbnail';

interface PointsTableModalProps {
    onClose: () => void;
}

const PointsTableModal: React.FC<PointsTableModalProps> = ({ onClose }) => {
    const { points, deletePoint, board, appSettings } = useProject();
    const { setPoints, selectedPointId, setSelectedPointId } = board;

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
                    // Ensure the measurement object exists before updating value
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
            // The useEffect listening to `points` prop will update `editedPoints`
        }
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
        if (sortColumn === 'label' || sortColumn === 'notes' || sortColumn === 'category') {
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
        <div className="fixed top-0 left-0 w-full h-full bg-gray-900 bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl text-white flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Measurements Table</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700"><X size={24} /></button>
                </div>
                <div className="px-6 py-4 border-b border-gray-700">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter points..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
                <div className="p-6 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-700">
                                <th className="p-3 w-12 text-right">#</th>
                                <th className="p-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('label')}>Label <SortIcon column="label" /></th>
                                <th className="p-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('category')}>Categ <SortIcon column="category" /></th>
                                <th className="p-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('voltage')}>Voltage <SortIcon column="voltage" /></th>
                                <th className="p-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('resistance')}>Resistance <SortIcon column="resistance" /></th>
                                <th className="p-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('diode')}>Diode <SortIcon column="diode" /></th>
                                <th className="p-3">Scope</th>
                                <th className="p-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('notes')}>Notes <SortIcon column="notes" /></th>
                                <th className="p-3 w-24 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAndFilteredPoints.map((point, index) => (
                                <tr
                                    key={point.id}
                                    ref={el => { rowRefs.current[point.id] = el; }}
                                    className={`border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer ${selectedPointId === point.id ? 'bg-blue-600/50' : ''}`}
                                    onClick={() => setSelectedPointId(point.id)}
                                >
                                    <td className="px-4 py-2 text-right">{sortedAndFilteredPoints.length - index}</td>
                                    <td className="px-4 py-2">
                                        <input 
                                            type="text" 
                                            value={point.label} 
                                            onChange={(e) => handleLabelChange(point.id, e.target.value)} 
                                            onClick={(e) => e.stopPropagation()} 
                                            className="bg-gray-700 w-full p-1 rounded font-bold text-white" 
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <select 
                                            value={point.category || ''} 
                                            onChange={(e) => handleCategoryChange(point.id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-gray-700 w-24 p-1 rounded text-sm text-white border border-gray-600"
                                        >
                                            <option value="">-</option>
                                            {appSettings.categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-2">
                                        <input type="text" defaultValue={(point.measurements?.voltage?.value as string) || ''} onBlur={(e) => handleValueChange(point.id, 'voltage', e.target.value)} onClick={(e) => e.stopPropagation()} className="bg-gray-700 w-full p-1 rounded" />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input type="text" defaultValue={(point.measurements?.resistance?.value as string) || ''} onBlur={(e) => handleValueChange(point.id, 'resistance', e.target.value)} onClick={(e) => e.stopPropagation()} className="bg-gray-700 w-full p-1 rounded" />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input type="text" defaultValue={(point.measurements?.diode?.value as string) || ''} onBlur={(e) => handleValueChange(point.id, 'diode', e.target.value)} onClick={(e) => e.stopPropagation()} className="bg-gray-700 w-full p-1 rounded" />
                                    </td>
                                    <td className="px-4 py-2">
                                        {point.measurements?.oscilloscope ? (
                                             <WaveformThumbnail measurement={point.measurements.oscilloscope} />
                                        ) : <span className="text-gray-600 text-xs">-</span>}
                                    </td>
                                    <td className="px-4 py-2">
                                        <input type="text" value={point.notes || ''} onChange={(e) => handleNotesChange(point.id, e.target.value)} onClick={(e) => e.stopPropagation()} className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full" />
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(point.id); }} className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg" title="Delete Point">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end p-4 bg-gray-700/50">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 mr-4">Cancel</button>
                    <button onClick={() => { setPoints(editedPoints); onClose(); }} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">Save Changes</button>
                </div>
            </div>
        </div>
    );
};

export default PointsTableModal;
