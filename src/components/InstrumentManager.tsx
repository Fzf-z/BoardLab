import React, { useState, useEffect } from 'react';
import { Instrument } from '../types';
import { Plus, Trash2, Edit2, Save, Activity, Wifi } from 'lucide-react';
import { useNotifier } from '../contexts/NotifierContext';
import { safeInstrumentAPI } from '../utils/safeElectronAPI';

const InstrumentManager: React.FC = () => {
    const [instruments, setInstruments] = useState<Instrument[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<Partial<Instrument>>({});
    const [testing, setTesting] = useState(false);
    const [availablePorts, setAvailablePorts] = useState<string[]>([]);
    const { showNotification } = useNotifier();

    useEffect(() => {
        loadInstruments();
    }, []);

    useEffect(() => {
        if (formData.connection_type === 'serial' && window.electronAPI?.getSerialPorts) {
            window.electronAPI.getSerialPorts().then((ports: string[]) => {
                setAvailablePorts(ports);
            });
        }
    }, [formData.connection_type]);

    const loadInstruments = async () => {
        const data = await safeInstrumentAPI.getAllInstruments();
        setInstruments(data);
    };

    const handleEdit = (inst: Instrument) => {
        setEditingId(inst.id!);
        let prettyMap = inst.command_map;
        try {
            // Format JSON for readability
            const parsed = JSON.parse(inst.command_map);
            prettyMap = JSON.stringify(parsed, null, 4);
        } catch (e) {
            // Keep original if parsing fails
        }
        setFormData({ ...inst, command_map: prettyMap });
    };

    const handleNew = () => {
        setEditingId(-1); // -1 indicates new

        // Template with standard SCPI commands pre-filled
        const defaultCommands = {
            "IDN": "*IDN?",
            "READ_DC": "MEAS:SHOW?",
            "READ_RESISTANCE": "MEAS:SHOW?",
            "READ_DIODE": "MEAS:SHOW?",
            "CONFIGURE_VOLTAGE": "CONF:VOLT:DC AUTO",
            "CONFIGURE_RESISTANCE": "CONF:RES AUTO",
            "CONFIGURE_DIODE": "CONF:DIOD"
        };

        setFormData({
            name: 'New Multimeter',
            type: 'multimeter',
            connection_type: 'tcp_raw',
            ip_address: '192.168.1.100',
            port: 9876,
            command_map: JSON.stringify(defaultCommands, null, 4),
            is_active: 0
        });
    };

    const handleCancel = () => {
        setEditingId(null);
        setFormData({});
    };

    const handleDelete = async (id: number) => {
        if (confirm("Are you sure you want to delete this instrument?")) {
            const result = await safeInstrumentAPI.deleteInstrument(id);
            if (result?.status === 'success') {
                showNotification("Instrument deleted", "success");
                loadInstruments();
            } else {
                showNotification("Failed to delete", "error");
            }
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.ip_address || !formData.port) {
            showNotification("Please fill required fields", "warning");
            return;
        }

        // Validate JSON
        try {
            if (typeof formData.command_map === 'string') {
                JSON.parse(formData.command_map);
            }
        } catch {
            showNotification("Invalid JSON in Command Map", "error");
            return;
        }

        const result = await safeInstrumentAPI.saveInstrument(formData as Instrument);
        if (result) {
            showNotification("Instrument saved", "success");
            setEditingId(null);
            loadInstruments();
        } else {
            showNotification("Failed to save", "error");
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);

        // Validate JSON first
        try {
            if (typeof formData.command_map === 'string') {
                JSON.parse(formData.command_map);
            }
        } catch {
            showNotification("Invalid JSON", "error");
            setTesting(false);
            return;
        }

        const result = await safeInstrumentAPI.testConnection(formData as Instrument);
        if (result?.status === 'success') {
            showNotification("Connection OK", "success");
        } else {
            showNotification(`Connection Failed: ${result?.message || 'Unknown error'}`, "error");
        }

        setTesting(false);
    };

    const renderForm = () => {
        return (
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Name</label>
                        <input
                            type="text"
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={formData.name || ''}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Type</label>
                        <select
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={formData.type || 'multimeter'}
                            onChange={e => setFormData({ ...formData, type: e.target.value as 'multimeter' | 'oscilloscope' })}
                        >
                            <option value="multimeter">Multimeter</option>
                            <option value="oscilloscope">Oscilloscope</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Connection</label>
                        <select
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={formData.connection_type || 'tcp_raw'}
                            onChange={e => setFormData({ ...formData, connection_type: e.target.value as 'tcp_raw' | 'serial' })}
                        >
                            <option value="tcp_raw">TCP / LAN</option>
                            <option value="serial">USB / Serial</option>
                        </select>
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs text-gray-400 mb-1">
                            {formData.connection_type === 'serial' ? 'COM Port' : 'IP Address'}
                        </label>
                        {formData.connection_type === 'serial' ? (
                            <div className="flex gap-2">
                                <select
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                    value={formData.ip_address || ''}
                                    onChange={e => setFormData({ ...formData, ip_address: e.target.value })}
                                >
                                    <option value="">Select Port</option>
                                    {availablePorts.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <button
                                    onClick={() => window.electronAPI?.getSerialPorts().then(setAvailablePorts)}
                                    className="px-2 bg-gray-700 hover:bg-gray-600 rounded"
                                    title="Refresh Ports"
                                >
                                    ↻
                                </button>
                            </div>
                        ) : (
                            <input
                                type="text"
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                value={formData.ip_address || ''}
                                onChange={e => setFormData({ ...formData, ip_address: e.target.value })}
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">
                            {formData.connection_type === 'serial' ? 'Baud Rate' : 'Port'}
                        </label>
                        {formData.connection_type === 'serial' ? (
                            <select
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                value={formData.port || 9600}
                                onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })}
                            >
                                {[9600, 19200, 38400, 57600, 115200].map(rate => (
                                    <option key={rate} value={rate}>{rate}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="number"
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                value={formData.port || ''}
                                onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })}
                            />
                        )}
                    </div>
                </div>

                <div>
                    <label className="text-xs text-gray-400 mb-1 flex justify-between">
                        <span>Command Map (JSON)</span>
                        <span className="text-gray-500">Maps actions to SCPI commands</span>
                    </label>
                    <textarea
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white font-mono text-xs h-32"
                        value={formData.command_map || ''}
                        onChange={e => setFormData({ ...formData, command_map: e.target.value })}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                        Required keys:
                        {formData.type === 'multimeter' ? ' IDN, READ_DC, READ_RESISTANCE, READ_DIODE, CONFIGURE_VOLTAGE, CONFIGURE_RESISTANCE, CONFIGURE_DIODE' : ' IDN, SETUP_WAVE, READ_WAVE'}
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        id="isActive"
                        checked={!!formData.is_active}
                        onChange={e => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                        className="w-4 h-4 bg-gray-900 border-gray-700 rounded"
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-300">Set as Active Instrument</label>
                </div>

                <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-gray-700">
                    <button
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded flex items-center space-x-1"
                    >
                        {testing ? <Activity className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                        <span>Test Connection</span>
                    </button>
                    <div className="flex-1"></div>
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center space-x-1"
                    >
                        <Save className="w-4 h-4" />
                        <span>Save Instrument</span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-white">Instrument Definitions</h3>
                {!editingId && (
                    <button
                        onClick={handleNew}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded flex items-center space-x-1 text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Instrument</span>
                    </button>
                )}
            </div>

            {editingId !== null ? renderForm() : (
                <div className="grid gap-3">
                    {instruments.map(inst => (
                        <div key={inst.id} className="bg-gray-800 p-3 rounded border border-gray-700 flex justify-between items-center group">
                            <div className="flex items-center space-x-3">
                                <div className={`p-2 rounded-full ${inst.is_active ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                    {inst.type === 'multimeter' ? <Activity className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                                </div>
                                <div>
                                    <div className="font-medium text-white flex items-center space-x-2">
                                        <span>{inst.name}</span>
                                        {inst.is_active ? <span className="text-[10px] bg-green-900 text-green-300 px-1 rounded">ACTIVE</span> : null}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {inst.type} | {inst.ip_address}:{inst.port} | {inst.connection_type}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(inst)} className="p-1.5 hover:bg-gray-700 rounded text-blue-400">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(inst.id!)} className="p-1.5 hover:bg-gray-700 rounded text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {instruments.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No instruments defined. Add one to get started.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default InstrumentManager;
