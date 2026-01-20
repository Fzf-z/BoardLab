import { useTranslation } from 'react-i18next';

interface AISettingsProps {
    tempApiKey: string;
    setTempApiKey: (key: string) => void;
}

export const AISettings: React.FC<AISettingsProps> = ({
    tempApiKey,
    setTempApiKey
}) => {
    const { t } = useTranslation();

    return (
        <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-700 space-y-4 animate-in fade-in">
            <h3 className="text-md font-bold text-green-300">{t('settings.ai_config')}</h3>

            <div>
                <label className="block text-sm text-gray-400 mb-1">{t('settings.ai_api_key')}</label>
                <input
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white font-mono"
                    placeholder={t('settings.ai_api_key_placeholder')}
                />
                <p className="text-xs text-gray-500 mt-1">{t('settings.ai_api_key_description')}</p>
            </div>

            <div>
                <label className="block text-sm text-gray-400 mb-1">{t('settings.ai_model')}</label>
                <input
                    type="text"
                    value="Gemini 2.5 Flash"
                    disabled
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-gray-500 font-mono"
                />
            </div>
        </div>
    );
};

export default AISettings;
