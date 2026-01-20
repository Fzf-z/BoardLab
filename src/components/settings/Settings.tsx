import { useState } from 'react';
import { Cog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { safeDeepClone } from '../../utils/safeJson';
import InstrumentManager from '../InstrumentManager';
import { GeneralSettings } from './GeneralSettings';
import { CategoriesSettings } from './CategoriesSettings';
import { AISettings } from './AISettings';
import { AboutSettings } from './AboutSettings';
import type { InstrumentConfig, AppSettings } from '../../types';

type TabId = 'general' | 'categories' | 'instruments' | 'ai' | 'about';

interface SettingsProps {
    instruments: InstrumentConfig;
    apiKey: string;
    appSettings: AppSettings;
    onSave: (config: InstrumentConfig, apiKey: string, appSettings: AppSettings) => void;
    onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({
    instruments, apiKey, appSettings, onSave, onClose
}) => {
    const { t } = useTranslation();

    const [localInstruments] = useState<InstrumentConfig>(() => {
        const inst = safeDeepClone(instruments, {
            multimeter: { ip: '', port: 0, commands: {} },
            oscilloscope: { ip: '', port: 0, commands: {} },
            monitor: { enabled: false }
        });
        if (!inst.monitor) inst.monitor = { enabled: false };
        return inst;
    });

    const [localAppSettings, setLocalAppSettings] = useState<AppSettings>(() => {
        const settings = safeDeepClone(appSettings, {
            autoSave: false,
            pointSize: 24,
            pointColor: '#4b5563',
            categories: []
        });
        if (!settings.categories) settings.categories = [];
        return settings;
    });

    const [activeTab, setActiveTab] = useState<TabId>('general');
    const [tempApiKey, setTempApiKey] = useState(apiKey);

    const tabs: { id: TabId; label: string }[] = [
        { id: 'general', label: t('settings.general') },
        { id: 'categories', label: t('settings.categories') },
        { id: 'instruments', label: t('settings.instruments') },
        { id: 'ai', label: t('settings.ai_config') },
        { id: 'about', label: t('settings.about') },
    ];

    return (
        <div className="fixed inset-0 top-0 left-0 w-full h-full bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 animate-in fade-in zoom-in-95">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl border border-gray-700 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900">
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <Cog className="mr-2" size={24} />
                        {t('settings.title')}
                    </h2>
                    <div className="flex space-x-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`px-3 py-1 rounded text-sm ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'general' && (
                        <GeneralSettings
                            localAppSettings={localAppSettings}
                            setLocalAppSettings={setLocalAppSettings}
                        />
                    )}

                    {activeTab === 'categories' && (
                        <CategoriesSettings
                            localAppSettings={localAppSettings}
                            setLocalAppSettings={setLocalAppSettings}
                        />
                    )}

                    {activeTab === 'instruments' && (
                        <div className="animate-in fade-in">
                            <InstrumentManager />
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <AISettings
                            tempApiKey={tempApiKey}
                            setTempApiKey={setTempApiKey}
                        />
                    )}

                    {activeTab === 'about' && <AboutSettings />}
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
                            onSave(localInstruments, tempApiKey, localAppSettings);
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
