import React from 'react';
import { Cpu, Move, Crosshair, Upload, Settings as SettingsIcon, Table, FilePlus, FolderOpen, Save, FileDown, Play } from 'lucide-react';

interface ToolbarProps {
    mode: 'view' | 'measure';
    setMode: (mode: 'view' | 'measure') => void;
    onUpload: () => void;
    onOpenSettings: () => void;
    onOpenPointsTable: () => void;
    onNewProject: () => void;
    onOpenProject: () => void;
    onSaveProject: () => void;
    onExportPdf: () => void;
    onStartSequence: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
    mode, 
    setMode, 
    onUpload, 
    onOpenSettings, 
    onOpenPointsTable, 
    onNewProject, 
    onOpenProject, 
    onSaveProject, 
    onExportPdf,
    onStartSequence
}) => {
    return (
        <div className="w-16 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-4 space-y-4 z-20 shadow-lg">
            <div className="p-2 bg-blue-600 rounded-lg mb-4">
                <Cpu size={24} />
            </div>
            <button
                onClick={() => setMode('view')}
                className={`p-3 rounded-xl transition ${mode === 'view' ? 'bg-blue-600 shadow-lg' : 'hover:bg-gray-700 text-gray-400'}`}
                title="Move/Pan Mode"
            >
                <Move size={20} />
            </button>
            <button
                onClick={() => setMode('measure')}
                className={`p-3 rounded-xl transition ${mode === 'measure' ? 'bg-red-500 shadow-lg' : 'hover:bg-gray-700 text-gray-400'}`}
                title="Measure Mode"
            >
                <Crosshair size={20} />
            </button>
            
            <div className="h-px w-8 bg-gray-700 my-2"></div>

            <button onClick={onNewProject} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl" title="New Project">
                <FilePlus size={20} />
            </button>
            <button onClick={onOpenProject} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl" title="Open Project">
                <FolderOpen size={20} />
            </button>
            <button onClick={onSaveProject} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl" title="Save Project">
                <Save size={20} />
            </button>
            <button onClick={onExportPdf} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl" title="Export to PDF">
                <FileDown size={20} />
            </button>
            
            <button onClick={onStartSequence} className="p-3 text-green-400 hover:bg-gray-700 rounded-xl" title="Start Sequence">
                <Play size={20} />
            </button>

            <div className="h-px w-8 bg-gray-700 my-2"></div>
            
            <button onClick={onUpload} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl" title="Upload Image">
                <Upload size={20} />
            </button>

            <div className="flex-1"></div>
            
            <button onClick={onOpenSettings} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl" title="Settings">
                <SettingsIcon size={20} />
            </button>
        </div>
    );
};

export default Toolbar;
