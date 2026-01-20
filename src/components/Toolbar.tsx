import { Cpu, Move, Crosshair, Settings as SettingsIcon, FilePlus, FolderOpen, Save, FileDown, Play, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ToolbarProps {
    mode: 'view' | 'measure';
    setMode: (mode: 'view' | 'measure') => void;
    onOpenSettings: () => void;
    onNewProject: () => void;
    onOpenProject: () => void;
    onSaveProject: () => void;
    onProFeature: (featureName: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
    mode,
    setMode,
    onOpenSettings,
    onNewProject,
    onOpenProject,
    onSaveProject,
    onProFeature
}) => {
    const { t } = useTranslation();
    return (
        <div className="w-16 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-4 space-y-4 z-20 shadow-lg">
            <div className="p-2 bg-blue-600 rounded-lg mb-4">
                <Cpu size={24} />
            </div>
            <button
                onClick={() => setMode('view')}
                className={`p-3 rounded-xl transition ${mode === 'view' ? 'bg-blue-600 shadow-lg' : 'hover:bg-gray-700 text-gray-400'}`}
                title={t('toolbar.move_pan')}
            >
                <Move size={20} />
            </button>
            <button
                onClick={() => setMode('measure')}
                className={`p-3 rounded-xl transition ${mode === 'measure' ? 'bg-red-500 shadow-lg' : 'hover:bg-gray-700 text-gray-400'}`}
                title={t('toolbar.measure')}
            >
                <Crosshair size={20} />
            </button>

            <div className="h-px w-8 bg-gray-700 my-2"></div>

            <button onClick={onNewProject} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl" title={t('toolbar.new_project')}>
                <FilePlus size={20} />
            </button>
            <button onClick={onOpenProject} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl" title={t('toolbar.open_project')}>
                <FolderOpen size={20} />
            </button>
            <button onClick={onSaveProject} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl" title={t('toolbar.save_project')}>
                <Save size={20} />
            </button>
            <button
                onClick={() => onProFeature(t('toolbar.export_pdf'))}
                className="p-3 text-amber-400/60 hover:bg-gray-700 rounded-xl relative"
                title={t('toolbar.export_pdf')}
            >
                <FileDown size={20} />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full text-[8px] flex items-center justify-center text-white font-bold">P</span>
            </button>
            <button
                onClick={() => onProFeature(t('toolbar.export_image'))}
                className="p-3 text-amber-400/60 hover:bg-gray-700 rounded-xl relative"
                title={t('toolbar.export_image')}
            >
                <ImageIcon size={20} />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full text-[8px] flex items-center justify-center text-white font-bold">P</span>
            </button>

            <button
                onClick={() => onProFeature(t('toolbar.start_sequence'))}
                className="p-3 text-amber-400/60 hover:bg-gray-700 rounded-xl relative"
                title={t('toolbar.start_sequence')}
            >
                <Play size={20} />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full text-[8px] flex items-center justify-center text-white font-bold">P</span>
            </button>

            <div className="h-px w-8 bg-gray-700 my-2"></div>

            <div className="flex-1"></div>

            <button onClick={onOpenSettings} className="p-3 text-gray-400 hover:bg-gray-700 rounded-xl" title={t('toolbar.settings')}>
                <SettingsIcon size={20} />
            </button>
        </div>
    );
};

export default Toolbar;
