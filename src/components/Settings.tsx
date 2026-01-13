import React, { useState } from 'react';
import { useNotifier } from '../contexts/NotifierContext';
import { InstrumentConfig, AppSettings } from '../types';

interface SettingsProps {
    instruments: InstrumentConfig;
    apiKey: string;
    setApiKey: (key: string) => void;
    appSettings: AppSettings;
    onSave: (config: InstrumentConfig, apiKey: string, appSettings: AppSettings) => void;
    onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
    instruments, apiKey, setApiKey, appSettings, onSave, onClose 
}) => {
  const [localInstruments, setLocalInstruments] = useState<InstrumentConfig>(JSON.parse(JSON.stringify(instruments)));
  const [localAppSettings, setLocalAppSettings] = useState<AppSettings>(JSON.parse(JSON.stringify(appSettings)));
  const [activeTab, setActiveTab] = useState<'app' | 'multimeter' | 'oscilloscope'>('app');
  const { showNotification } = useNotifier();

  const handleInstrumentChange = (instrument: 'multimeter' | 'oscilloscope', field: string, value: string | number) => {
    setLocalInstruments(prev => ({
      ...prev,
      [instrument]: {
        ...prev[instrument],
        [field]: value,
      },
    }));
  };

  const handleCommandChange = (instrument: 'multimeter' | 'oscilloscope', commandName: string, value: string) => {
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
  
  const handleTestConnection = async (instrument: 'multimeter' | 'oscilloscope') => {
    const instData = localInstruments[instrument];
    if (window.electronAPI) {
        const result = await window.electronAPI.testConnection(instData.ip, instData.port);
        if (result.status === 'success') {
            showNotification(`${instrument} connection test successful!`, 'success');
        } else {
            showNotification(`${instrument} connection test failed: ${result.message}`, 'error');
        }
    } else {
        showNotification('Connection testing only available in Electron environment.', 'info');
    }
  };

  const renderInstrumentConfig = (instrumentKey: 'multimeter' | 'oscilloscope') => {
    const instrument = localInstruments[instrumentKey];
    if (!instrument) return null;

    return (
        <div key={instrumentKey} className="animate-in fade-in">
            <h3 className="text-xl font-semibold mb-4 capitalize text-blue-400 border-b border-gray-700 pb-2">{instrumentKey}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400">IP Address</label>
                <input
                  type="text"
                  value={instrument.ip}
                  onChange={(e) => handleInstrumentChange(instrumentKey, 'ip', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">Port</label>
                <input
                  type="number"
                  value={instrument.port}
                  onChange={(e) => handleInstrumentChange(instrumentKey, 'port', parseInt(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                />
              </div>
            </div>
            <div className="mt-6">
                <h4 className="text-lg font-medium text-gray-300 mb-2">SCPI Commands</h4>
                <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-3">
                    {instrument.commands && Object.keys(instrument.commands).map(cmdKey => (
                        <div key={cmdKey}>
                            <label className="block text-xs font-medium text-gray-500 capitalize mb-1">{cmdKey.replace(/_/g, ' ')}</label>
                            <input
                            type="text"
                            value={instrument.commands[cmdKey]}
                            onChange={(e) => handleCommandChange(instrumentKey, cmdKey, e.target.value)}
                            className="block w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-xs font-mono text-green-400 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-4">
              <button
                onClick={() => handleTestConnection(instrumentKey)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 w-full md:w-auto transition-colors"
              >
                Test Connection
              </button>
            </div>
        </div>
    );
  }

  return (
    <div className="fixed inset-0 top-0 left-0 w-full h-full bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 animate-in fade-in zoom-in-95">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl border border-gray-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900">
            <h2 className="text-xl font-bold text-white flex items-center">
                Settings
            </h2>
            <div className="flex space-x-2">
                <button 
                    onClick={() => setActiveTab('app')} 
                    className={`px-3 py-1 rounded text-sm ${activeTab === 'app' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                >
                    Application
                </button>
                <button 
                    onClick={() => setActiveTab('multimeter')} 
                    className={`px-3 py-1 rounded text-sm ${activeTab === 'multimeter' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                >
                    Multimeter
                </button>
                <button 
                    onClick={() => setActiveTab('oscilloscope')} 
                    className={`px-3 py-1 rounded text-sm ${activeTab === 'oscilloscope' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                >
                    Oscilloscope
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
            {activeTab === 'app' && (
                <div className="space-y-6 animate-in fade-in">
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Gemini AI Configuration</h3>
                        <label className="block text-sm font-medium text-gray-400">API Key</label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                            placeholder="Enter your Google Gemini API Key"
                        />
                        <p className="text-xs text-gray-500 mt-1">Required for diagnosis and component analysis features.</p>
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                         <h3 className="text-lg font-semibold text-white mb-2">General</h3>
                         <div className="flex items-center">
                            <input 
                                type="checkbox" 
                                id="autosave" 
                                checked={localAppSettings.autoSave} 
                                onChange={(e) => setLocalAppSettings(prev => ({ ...prev, autoSave: e.target.checked }))}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="autosave" className="ml-2 text-sm text-gray-300">Auto-save project on changes</label>
                         </div>
                         <div className="grid grid-cols-2 gap-4 mt-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-400">Point Size (px)</label>
                                <input
                                    type="number"
                                    value={localAppSettings.pointSize || 24}
                                    onChange={(e) => setLocalAppSettings(prev => ({ ...prev, pointSize: parseInt(e.target.value) || 24 }))}
                                    className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white"
                                />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-400">Default Point Color</label>
                                <div className="flex items-center mt-1 space-x-2">
                                    <input
                                        type="color"
                                        value={localAppSettings.pointColor || '#4b5563'}
                                        onChange={(e) => setLocalAppSettings(prev => ({ ...prev, pointColor: e.target.value }))}
                                        className="h-9 w-16 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                                    />
                                    <span className="text-xs text-gray-500 font-mono">{localAppSettings.pointColor}</span>
                                </div>
                             </div>
                         </div>
                         <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-400">Measurement Timeout (ms)</label>
                            <input
                                type="number"
                                value={localInstruments.timeout || 2000}
                                onChange={(e) => setLocalInstruments(prev => ({ ...prev, timeout: parseInt(e.target.value) || 2000 }))}
                                className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                            />
                            <p className="text-xs text-gray-500 mt-1">Time to wait for instrument response before failing.</p>
                         </div>
                    </div>
                </div>
            )}

            {activeTab === 'multimeter' && renderInstrumentConfig('multimeter')}
            {activeTab === 'oscilloscope' && renderInstrumentConfig('oscilloscope')}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
                onSave(localInstruments, apiKey, localAppSettings);
                onClose();
            }}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-500 shadow-lg transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
