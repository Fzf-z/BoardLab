import { Keyboard, Github } from 'lucide-react';

export const AboutSettings: React.FC = () => {
    return (
        <div className="animate-in fade-in space-y-6 text-gray-300">
            <div className="text-center space-y-2">
                <div className="flex justify-center mb-2">
                    <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                        BL
                    </div>
                </div>
                <h3 className="text-2xl font-bold text-white">BoardLab</h3>
                <p className="text-sm text-gray-400">Intelligent Electronic Diagnostics</p>
                <p className="text-xs text-gray-500 font-mono">v1.0.0</p>
            </div>

            <div className="bg-gray-700/30 p-4 rounded border border-gray-700">
                <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <Keyboard className="w-5 h-5 mr-2 text-blue-400" />
                    Keyboard Shortcuts
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    <ShortcutRow label="Measure Point" shortcut="Enter" />
                    <ShortcutRow label="Cancel / Close" shortcut="Esc" />
                    <ShortcutRow label="Mode: Voltage" shortcut="V" />
                    <ShortcutRow label="Mode: Resistance" shortcut="R" />
                    <ShortcutRow label="Mode: Diode" shortcut="D" />
                    <ShortcutRow label="Mode: Ground" shortcut="G" />
                    <ShortcutRow label="Mode: Oscilloscope" shortcut="O" />
                    <ShortcutRow label="Delete Point" shortcut="Del" />
                    <ShortcutRow label="Save Project" shortcut="Ctrl + S" />
                    <ShortcutRow label="Undo" shortcut="Ctrl + Z" />
                    <ShortcutRow label="Redo" shortcut="Ctrl + Y" />
                    <ShortcutRow label="Zoom In/Out" shortcut="Ctrl + Scroll" />
                </div>
            </div>

            <div className="flex flex-col items-center space-y-4 pt-4 border-t border-gray-700">
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">Developed by <strong className="text-white">Z Electronica UY</strong></span>
                </div>

                <a
                    href="https://github.com/Fzf-z/BoardLab"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
                >
                    <Github className="w-5 h-5" />
                    <span>View on GitHub</span>
                </a>
            </div>
        </div>
    );
};

const ShortcutRow: React.FC<{ label: string; shortcut: string }> = ({ label, shortcut }) => (
    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
        <span>{label}</span>
        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">{shortcut}</kbd>
    </div>
);

export default AboutSettings;
