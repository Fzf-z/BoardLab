import { Languages, Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppSettings } from '../../types';

interface GeneralSettingsProps {
    localAppSettings: AppSettings;
    setLocalAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
    localAppSettings,
    setLocalAppSettings
}) => {
    const { t, i18n } = useTranslation();

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Language Selection */}
            <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-700">
                <h3 className="text-md font-bold mb-4 flex items-center text-blue-300">
                    <Languages size={18} className="mr-2" />
                    {t('settings.language')}
                </h3>
                <div className="flex items-center space-x-4">
                    <label className="text-sm text-gray-300">{t('settings.select_language')}</label>
                    <select
                        value={i18n.language}
                        onChange={(e) => i18n.changeLanguage(e.target.value)}
                        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                    >
                        <option value="en">English</option>
                        <option value="es">Espanol</option>
                    </select>
                </div>
            </div>

            <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-700">
                <h3 className="text-md font-bold mb-4 flex items-center text-blue-300">
                    <Cpu size={18} className="mr-2" />
                    {t('settings.app_settings')}
                </h3>

                <div className="flex items-center mb-4">
                    <input
                        type="checkbox"
                        id="autosave"
                        checked={localAppSettings.autoSave}
                        onChange={(e) => setLocalAppSettings(prev => ({ ...prev, autoSave: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="autosave" className="ml-2 text-sm text-gray-300">{t('settings.auto_save')}</label>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400">{t('settings.point_size')}</label>
                        <input
                            type="number"
                            value={localAppSettings.pointSize || 24}
                            onChange={(e) => setLocalAppSettings(prev => ({ ...prev, pointSize: parseInt(e.target.value) || 24 }))}
                            className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400">{t('settings.default_point_color')}</label>
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
            </div>
        </div>
    );
};

export default GeneralSettings;
