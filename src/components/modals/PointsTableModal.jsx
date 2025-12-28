import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const PointsTableModal = ({ points, onSave, onClose }) => {
    const [editedPoints, setEditedPoints] = useState(JSON.parse(JSON.stringify(points)));

    useEffect(() => {
        setEditedPoints(JSON.parse(JSON.stringify(points)));
    }, [points]);

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

    return (
        <div className="fixed top-0 left-0 w-full h-full bg-gray-900 bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl text-white flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Measurements Table</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-700">
                                <th className="p-3">Label</th>
                                <th className="p-3">Voltage</th>
                                <th className="p-3">Resistance</th>
                                <th className="p-3">Diode</th>
                                <th className="p-3">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {editedPoints.map(point => (
                                <tr key={point.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                    <td className="p-2 font-bold">{point.label}</td>
                                    <td className="p-2">
                                        <input 
                                            type="text"
                                            value={point.measurements.voltage.value || ''}
                                            onChange={(e) => handleValueChange(point.id, 'voltage', e.target.value)}
                                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="text"
                                            value={point.measurements.resistance.value || ''}
                                            onChange={(e) => handleValueChange(point.id, 'resistance', e.target.value)}
                                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="text"
                                            value={point.measurements.diode.value || ''}
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
