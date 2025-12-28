import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowUp, ArrowDown, Search } from 'lucide-react';

const PointsTableModal = ({ points, onSave, onClose, selectedPointId, onSelectPoint }) => {
    const [editedPoints, setEditedPoints] = useState(JSON.parse(JSON.stringify(points)));
    const [sortColumn, setSortColumn] = useState('label'); // Default sort column
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
    const [filterText, setFilterText] = useState('');

    const rowRefs = useRef({});

    useEffect(() => {
        setEditedPoints(JSON.parse(JSON.stringify(points)));
    }, [points]);

    useEffect(() => {
        if (selectedPointId && rowRefs.current[selectedPointId]) {
            rowRefs.current[selectedPointId].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [selectedPointId]);

    const handleValueChange = (pointId, measurementType, newValue) => {
        setEditedPoints(currentPoints =>
            currentPoints.map(p => {
                if (p.id === pointId) {
                    const newMeasurements = { ...p.measurements };
                    newMeasurements[measurementType] = {
                        ...newMeasurements[measurementType],
                        value: newValue,
                        capturedAt: new Date().toISOString(),
                    };
                    return { ...p, measurements: newMeasurements };
                }
                return p;
            })
        );
    };
    
    const handleNotesChange = (pointId, newNotes) => {
        setEditedPoints(currentPoints =>
            currentPoints.map(p => (p.id === pointId ? { ...p, notes: newNotes } : p))
        );
    };

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const filteredPoints = editedPoints.filter(point => {
        const lowerCaseFilterText = filterText.toLowerCase();
        const labelMatch = point.label.toLowerCase().includes(lowerCaseFilterText);
        const notesMatch = point.notes?.toLowerCase().includes(lowerCaseFilterText);
        
        const measurementMatch = Object.values(point.measurements).some(m => 
            m?.value?.toString().toLowerCase().includes(lowerCaseFilterText)
        );

        return labelMatch || notesMatch || measurementMatch;
    });

    const sortedAndFilteredPoints = [...filteredPoints].sort((a, b) => {
        let compareA, compareB;

        if (sortColumn === 'label' || sortColumn === 'notes') {
            compareA = a[sortColumn] || '';
            compareB = b[sortColumn] || '';
            return sortDirection === 'asc' ? compareA.localeCompare(compareB) : compareB.localeCompare(compareA);
        } else if (['voltage', 'resistance', 'diode'].includes(sortColumn)) {
            // Extract numeric value from string (e.g., "1.23 V" -> 1.23)
            compareA = parseFloat(a.measurements[sortColumn]?.value) || 0;
            compareB = parseFloat(b.measurements[sortColumn]?.value) || 0;
            return sortDirection === 'asc' ? compareA - compareB : compareB - compareA;
        }
        
        return 0; // Should not happen
    });

    const SortIcon = ({ column }) => {
        if (sortColumn === column) {
            return sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />;
        }
        return null;
    };

    return (
        <div className="fixed top-0 left-0 w-full h-full bg-gray-900 bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl text-white flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Measurements Table</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700">
                        <X size={24} />
                    </button>
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
                                <th className="p-3 cursor-pointer hover:bg-gray-600 flex items-center" onClick={() => handleSort('label')}>
                                    Label <SortIcon column="label" />
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-600 flex items-center" onClick={() => handleSort('voltage')}>
                                    Voltage <SortIcon column="voltage" />
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-600 flex items-center" onClick={() => handleSort('resistance')}>
                                    Resistance <SortIcon column="resistance" />
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-600 flex items-center" onClick={() => handleSort('diode')}>
                                    Diode <SortIcon column="diode" />
                                </th>
                                <th className="p-3 cursor-pointer hover:bg-gray-600 flex items-center" onClick={() => handleSort('notes')}>
                                    Notes <SortIcon column="notes" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAndFilteredPoints.map(point => (
                                <tr
                                    key={point.id}
                                    ref={el => (rowRefs.current[point.id] = el)}
                                    className={`border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer ${selectedPointId === point.id ? 'bg-blue-600/50' : ''}`}
                                    onClick={() => onSelectPoint(point.id)}
                                >
                                    <td className="p-2 font-bold">{point.label}</td>
                                    <td className="p-2">
                                        <input 
                                            type="text"
                                            value={point.measurements.voltage?.value || ''}
                                            onChange={(e) => handleValueChange(point.id, 'voltage', e.target.value)}
                                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="text"
                                            value={point.measurements.resistance?.value || ''}
                                            onChange={(e) => handleValueChange(point.id, 'resistance', e.target.value)}
                                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="text"
                                            value={point.measurements.diode?.value || ''}
                                            onChange={(e) => handleValueChange(point.id, 'diode', e.target.value)}
                                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="text"
                                            value={point.notes || ''}
                                            onChange={(e) => handleNotesChange(point.id, e.target.value)}
                                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end p-4 bg-gray-700/50">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 mr-4"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onSave(editedPoints);
                            onClose();
                        }}
                        className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PointsTableModal;
