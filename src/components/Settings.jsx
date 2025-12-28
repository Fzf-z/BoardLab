import React, { useState } from 'react';

const Settings = ({ instruments, apiKey, setApiKey, onSave, onClose }) => {
  const [localInstruments, setLocalInstruments] = useState(instruments);
  const [activeTab, setActiveTab] = useState('app'); // 'app', 'multimeter', 'oscilloscope'

  const handleInstrumentChange = (instrument, field, value) => {
    setLocalInstruments(prev => ({
      ...prev,
      [instrument]: {
        ...prev[instrument],
        [field]: value,
      },
    }));
  };

  const handleCommandChange = (instrument, commandName, value) => {
    setLocalInstruments(prev => ({
        ...prev,
        [instrument]: {
            ...prev[instrument],
            commands: {
                ...prev[instrument].commands,
                [commandName]: value,
            }
        },
      }));
  };
  
  const handleTestConnection = async (instrument) => {
    const { ip, port } = localInstruments[instrument];
    if (window.electronAPI) {
        const result = await window.electronAPI.testConnection(ip, port);
        alert(`${instrument} connection test: ${result.status}`);
    } else {
        alert('Connection testing only available in Electron environment.');
    }
  };

  const renderInstrumentConfig = (instrumentKey) => {
    const instrument = localInstruments[instrumentKey];
    if (!instrument) return null;

    return (
        <div key={instrumentKey}>
            <h3 className="text-xl font-semibold mb-2 capitalize">{instrumentKey}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400">IP Address</label>
                <input
                  type="text"
                  value={instrument.ip}
                  onChange={(e) => handleInstrumentChange(instrumentKey, 'ip', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">Port</label>
                <input
                  type="number"
                  value={instrument.port}
                  onChange={(e) => handleInstrumentChange(instrumentKey, 'port', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="mt-4">
                <h4 className="text-lg font-medium text-gray-300">SCPI Commands</h4>
                {instrument.commands && Object.keys(instrument.commands).map(cmdKey => (
                     <div key={cmdKey} className="mt-2">
                        <label className="block text-sm font-medium text-gray-400 capitalize">{cmdKey.replace(/_/g, ' ')}</label>
                        <input
                        type="text"
                        value={instrument.commands[cmdKey]}
                        onChange={(e) => handleCommandChange(instrumentKey, cmdKey, e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                ))}
            </div>
            <div className="mt-4">
              <button
                onClick={() => handleTestConnection(instrumentKey)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Test Connection
              </button>
            </div>
        </div>
    );
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full bg-gray-900 bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl text-white">
        <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold">Configuration</h2>
        </div>
        
        <div className="flex border-b border-gray-700">
            <button onClick={() => setActiveTab('app')} className={`flex-1 px-6 py-3 text-lg font-medium ${activeTab === 'app' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
                App
            </button>
            <button onClick={() => setActiveTab('multimeter')} className={`flex-1 px-6 py-3 text-lg font-medium ${activeTab === 'multimeter' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
                Multimeter
            </button>
            <button onClick={() => setActiveTab('oscilloscope')} className={`flex-1 px-6 py-3 text-lg font-medium ${activeTab === 'oscilloscope' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
                Oscilloscope
            </button>
        </div>

        <div className="p-6 min-h-[300px]">
            {activeTab === 'app' && (
                <div>
                    <h3 className="text-xl font-semibold mb-4">Gemini AI</h3>
                    <label className="block text-sm font-medium text-gray-400">API Key</label>
                    <div className="mt-1">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="Enter your Gemini API Key"
                        />
                    </div>
                </div>
            )}

            {activeTab === 'multimeter' && renderInstrumentConfig('multimeter')}
            {activeTab === 'oscilloscope' && renderInstrumentConfig('oscilloscope')}
        </div>

        <div className="flex justify-end p-6 bg-gray-700/50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 mr-4"
          >
            Cancel
          </button>
          <button
            onClick={() => {
                onSave(localInstruments, apiKey);
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

export default Settings;
