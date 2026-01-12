import React from 'react';
import { Plus, Minus, Monitor, Wifi } from 'lucide-react';

interface StatusBarProps {
    scale: number;
    setScale: React.Dispatch<React.SetStateAction<number>>; 
    isElectron: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ scale, setScale, isElectron }) => {
    return (
        <div className="absolute top-4 left-4 z-10 flex space-x-2 bg-gray-800/90 backdrop-blur p-2 rounded-lg shadow-xl border border-gray-700 items-center">
            <button onClick={() => setScale(s => s + 0.1)} className="p-1 hover:bg-gray-700 rounded">
                <Plus size={16} />
            </button>
            <span className="text-xs font-mono w-12 text-center">{(scale * 100).toFixed(0)}%</span>
            <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="p-1 hover:bg-gray-700 rounded">
                <Minus size={16} />
            </button>
            <div className="w-px h-4 bg-gray-600 mx-2"></div>
            <div className={`flex items-center space-x-2 px-2 py-0.5 rounded text-xs font-bold ${isElectron ? 'text-cyan-400 bg-cyan-900/30 border border-cyan-500/30' : 'text-orange-400 bg-orange-900/30 border border-orange-500/30'}`}>
                {isElectron ? <Monitor size={14} /> : <Wifi size={14} />}
                <span>{isElectron ? 'ELECTRON' : 'WEB DEMO'}</span>
            </div>
        </div>
    );
};

export default StatusBar;
