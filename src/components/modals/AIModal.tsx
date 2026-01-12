import React from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';

interface AIModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    response: string;
    isLoading: boolean;
}

const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, title, response, isLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-gray-800 border border-gray-600 w-full max-w-2xl max-h-[80vh] rounded-2xl flex flex-col">
                <div className="p-4 border-b border-gray-700 flex justify-between bg-gray-900/50">
                    <h3 className="text-xl font-bold text-white flex items-center">
                        <Sparkles className="text-purple-400 mr-2" />
                        {title}
                    </h3>
                    <button onClick={onClose}>
                        <X size={24} className="text-gray-400 hover:text-white" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 font-mono text-sm leading-relaxed text-gray-200 bg-gray-900">
                    {isLoading ? (
                        <div className="flex flex-col items-center h-24 justify-center">
                            <Loader2 className="animate-spin text-purple-500" />
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap">{response}</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIModal;
