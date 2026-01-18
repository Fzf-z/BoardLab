import React from 'react';
import { Plus, Minus, FileText } from 'lucide-react';

interface StatusBarProps {
    scale: number;
    setScale: React.Dispatch<React.SetStateAction<number>>; 
    projectName?: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ scale, setScale, projectName }) => {
    return (
        <div className="absolute top-4 left-4 z-10 flex space-x-2 bg-gray-800/90 backdrop-blur p-2 rounded-lg shadow-xl border border-gray-700 items-center">
            <button onClick={() => setScale(s => s + 0.1)} className="p-1 hover:bg-gray-700 rounded">
                <Plus size={16} />
            </button>
            <span className="text-xs font-mono w-12 text-center">{(scale * 100).toFixed(0)}%</span>
            <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="p-1 hover:bg-gray-700 rounded">
                <Minus size={16} />
            </button>
            {projectName && (
                <>
                    <div className="w-px h-4 bg-gray-600 mx-2"></div>
                    <div className="flex items-center space-x-2 px-2 py-0.5 rounded text-xs font-bold text-gray-300">
                        <FileText size={14} />
                        <span>{projectName}</span>
                    </div>
                </>
            )}
        </div>
    );
};

export default StatusBar;
