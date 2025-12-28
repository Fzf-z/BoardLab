import React, { useState, useEffect } from 'react';

const Settings = ({ instruments, onSave, onClose }) => {
  const [settings, setSettings] = useState(instruments);

  useEffect(() => {
    setSettings(instruments);
  }, [instruments]);

  const handleChange = (instrument, field, value) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      [instrument]: {
        ...prevSettings[instrument],
        [field]: value,
      },
    }));
  };

  const handleCommandChange = (instrument, commandName, value) => {
    setSettings(prevSettings => ({
        ...prevSettings,
        [instrument]: {
            ...prevSettings[instrument],
            commands: {
                ...prevSettings[instrument].commands,
                [commandName]: value,
            }
        },
      }));
  }

  const handleTestConnection = async (instrument) => {
    const { ip, port } = settings[instrument];
    if (window.electronAPI) {
        const result = await window.electronAPI.testConnection(ip, port);
        alert(`${instrument} connection test: ${result.status}`);
    } else {
        alert('Connection testing only available in Electron environment.');
    }
  };


  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    setSettings(instruments);
    if (window.electronAPI) {
      window.electronAPI.loadApiKey().then(key => {
        if (key) setApiKey(key);
      });
    }
  }, [instruments]);

  const handleSaveApiKey = () => {
    if (window.electronAPI) {
      window.electronAPI.saveApiKey(apiKey);
      alert('API Key saved!');
    } else {
      alert('API Key can only be saved in the Electron environment.');
    }
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full bg-gray-900 bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl text-white">
        <h2 className="text-2xl font-bold mb-4">Configuration</h2>

        <div className="mb-6 border-b border-gray-700 pb-4">
            <h3 className="text-xl font-semibold mb-2">Gemini AI</h3>
            <label className="block text-sm font-medium text-gray-400">API Key</label>
            <div className="flex items-center space-x-2 mt-1">
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Enter your Gemini API Key"
                />
                <button
                    onClick={handleSaveApiKey}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                    Save
                </button>
            </div>
        </div>


        <h2 className="text-2xl font-bold mb-4">Instrument Configuration</h2>

        {Object.keys(settings).map(key => (
          <div key={key} className="mb-6 border-b border-gray-700 pb-4">
            <h3 className="text-xl font-semibold mb-2 capitalize">{key}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400">IP Address</label>
                <input
                  type="text"
                  value={settings[key].ip}
                  onChange={(e) => handleChange(key, 'ip', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">Port</label>
                <input
                  type="number"
                  value={settings[key].port}
                  onChange={(e) => handleChange(key, 'port', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="mt-4">
                <h4 className="text-lg font-medium text-gray-300">SCPI Commands</h4>
                {settings[key].commands && Object.keys(settings[key].commands).map(cmdKey => (
                     <div key={cmdKey} className="mt-2">
                        <label className="block text-sm font-medium text-gray-400 capitalize">{cmdKey.replace('_', ' ')}</label>
                        <input
                        type="text"
                        value={settings[key].commands[cmdKey]}
                        onChange={(e) => handleCommandChange(key, cmdKey, e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                ))}
            </div>
            <div className="mt-4">
              <button
                onClick={() => handleTestConnection(key)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Test Connection
              </button>
            </div>
          </div>
        ))}

        <div className="flex justify-end mt-6">
          <button
            onClick={() => {
                onSave(settings);
                onClose();
            }}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mr-2"
          >
            Save & Close
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

};

export default Settings;
