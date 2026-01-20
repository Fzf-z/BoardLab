import { Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProFeatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    featureName: string;
}

const ProFeatureModal: React.FC<ProFeatureModalProps> = ({ isOpen, onClose, featureName }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 animate-in fade-in">
            <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-8 max-w-md text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Crown size={32} className="text-white" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                    {t('pro.feature_title')}
                </h2>

                <p className="text-gray-400 mb-6">
                    <span className="text-blue-400 font-semibold">{featureName}</span>{' '}
                    {t('pro.available_in_pro')}
                </p>

                <div className="space-y-3">
                    <a
                        href="https://boardlab.pro"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-bold rounded-lg hover:from-yellow-400 hover:to-amber-500 transition-all shadow-lg"
                    >
                        {t('pro.upgrade_now')}
                    </a>
                    <button
                        onClick={onClose}
                        className="w-full px-6 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProFeatureModal;
