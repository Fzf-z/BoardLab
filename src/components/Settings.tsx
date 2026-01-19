import React, { useState, useEffect } from 'react';
import { useNotifier } from '../contexts/NotifierContext';
import { useProject } from '../contexts/ProjectContext';
import { InstrumentConfig, AppSettings, PointCategory } from '../types';
import { Plus, Trash2, Edit2, Check, X, Github, Keyboard, Cog, Cpu, Languages } from 'lucide-react';
import InstrumentManager from './InstrumentManager';
import { safeDeepClone } from '../utils/safeJson';
import { useTranslation } from 'react-i18next';

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
    '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#ffffff'
];

interface SettingsProps {
    instruments: InstrumentConfig;
    apiKey: string;
    setApiKey: (key: string) => void;
    appSettings: AppSettings;
    onSave: (config: InstrumentConfig, apiKey: string, appSettings: AppSettings) => void;
    onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({
    instruments, apiKey, appSettings, onSave, onClose
}) => {
    const { boardTypes, addBoardType } = useProject();
    const { t, i18n } = useTranslation();

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
    const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'instruments' | 'ai' | 'about'>('general');
    const { showNotification } = useNotifier();

    // Category State
    const [selectedBoardType, setSelectedBoardType] = useState<string>('Laptop');
    const [newCatName, setNewCatName] = useState('');
    const [newCatColor, setNewCatColor] = useState('#ffffff');

    // Board Type State
    const [isAddingBoardType, setIsAddingBoardType] = useState(false);
    const [newBoardTypeName, setNewBoardTypeName] = useState('');

    // AI API Key State (temporary for editing)
    const [tempApiKey, setTempApiKey] = useState(apiKey);

    // Set initial selected board type if available
    useEffect(() => {
        if (boardTypes.length > 0 && !boardTypes.includes(selectedBoardType)) {
            setSelectedBoardType(boardTypes[0]);
        }
    }, [boardTypes]);

    // Editing state
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editCatName, setEditCatName] = useState('');
    const [editCatColor, setEditCatColor] = useState('#ffffff');

    const handleStartEdit = (category: PointCategory) => {
        setEditingCategoryId(category.id);
        setEditCatName(category.label);
        setEditCatColor(category.color);
    };

    const handleCancelEdit = () => {
        setEditingCategoryId(null);
        setEditCatName('');
        setEditCatColor('');
    };

    const handleSaveEdit = () => {
        if (!editingCategoryId || !editCatName.trim()) return;

        setLocalAppSettings(prev => ({
            ...prev,
            categories: (prev.categories || []).map(cat =>
                cat.id === editingCategoryId
                    ? { ...cat, label: editCatName, color: editCatColor }
                    : cat
            )
        }));
        handleCancelEdit();
    };

    const handleAddCategory = () => {
        if (!newCatName.trim()) return;
        const id = newCatName.toLowerCase().replace(/\s+/g, '_');
        const categories = localAppSettings.categories || [];

        if (categories.some(c => c.id === id)) {
            showNotification(t('settings.category_exists'), 'error');
            return;
        }

        const newCategory: PointCategory = {
            id,
            label: newCatName,
            color: newCatColor,
            boardType: selectedBoardType
        };

        setLocalAppSettings(prev => ({
            ...prev,
            categories: [...(prev.categories || []), newCategory]
        }));
        setNewCatName('');
        setNewCatColor('#ffffff');
    };

    const handleDeleteCategory = (id: string) => {
        setLocalAppSettings(prev => ({
            ...prev,
            categories: (prev.categories || []).filter(c => c.id !== id)
        }));
    };

    const handleAddBoardType = async () => {
        if (!newBoardTypeName.trim()) return;
        await addBoardType(newBoardTypeName);
        setSelectedBoardType(newBoardTypeName);
        setNewBoardTypeName('');
        setIsAddingBoardType(false);
        showNotification(t('settings.board_type_added', { name: newBoardTypeName }), 'success');
    };

    // Filter categories for the active board type
    const filteredCategories = (localAppSettings.categories || []).filter(c =>
        c.boardType === selectedBoardType || (!c.boardType && selectedBoardType === 'General')
    );

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
                        <button
                            className={`px-3 py-1 rounded text-sm ${activeTab === 'general' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            onClick={() => setActiveTab('general')}
                        >
                            {t('settings.general')}
                        </button>
                        <button
                            onClick={() => setActiveTab('categories')}
                            className={`px-3 py-1 rounded text-sm ${activeTab === 'categories' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                        >
                            {t('settings.categories')}
                        </button>
                        <button
                            className={`px-3 py-1 rounded text-sm ${activeTab === 'instruments' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            onClick={() => setActiveTab('instruments')}
                        >
                            {t('settings.instruments')}
                        </button>
                        <button
                            className={`px-3 py-1 rounded text-sm ${activeTab === 'ai' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            onClick={() => setActiveTab('ai')}
                        >
                            {t('settings.ai_config')}
                        </button>
                        <button
                            className={`px-3 py-1 rounded text-sm ${activeTab === 'about' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            onClick={() => setActiveTab('about')}
                        >
                            {t('settings.about')}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* --- General Tab --- */}
                    {activeTab === 'general' && (
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
                                        <option value="es">Español</option>
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
                    )}

                    {activeTab === 'categories' && (
                        <div className="animate-in fade-in space-y-4">
                            <h3 className="text-xl font-semibold mb-4 text-blue-400 border-b border-gray-700 pb-2">{t('settings.point_categories')}</h3>

                            {/* Board Type Selector */}
                            <div className="flex items-center space-x-3 mb-6 bg-gray-700/30 p-3 rounded border border-gray-600">
                                <label className="text-sm font-medium text-gray-300">{t('settings.board_type')}:</label>
                                {isAddingBoardType ? (
                                    <div className="flex items-center space-x-2 flex-1">
                                        <input
                                            type="text"
                                            value={newBoardTypeName}
                                            onChange={(e) => setNewBoardTypeName(e.target.value)}
                                            className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm flex-1"
                                            placeholder={t('settings.enter_board_type_name')}
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleAddBoardType}
                                            className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-500"
                                        >
                                            {t('common.save')}
                                        </button>
                                        <button
                                            onClick={() => setIsAddingBoardType(false)}
                                            className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-500"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-2 flex-1">
                                        <select
                                            value={selectedBoardType}
                                            onChange={(e) => setSelectedBoardType(e.target.value)}
                                            className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm flex-1"
                                        >
                                            {boardTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                            <option value="General">{t('settings.general_global')}</option>
                                        </select>
                                        <button
                                            onClick={() => setIsAddingBoardType(true)}
                                            className="px-3 py-1.5 bg-blue-600/50 text-blue-100 rounded text-sm hover:bg-blue-600 flex items-center"
                                        >
                                            <Plus size={14} className="mr-1" /> {t('settings.new_type')}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex space-x-2 mb-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700 items-start">
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-400 mb-1">{t('settings.new_category_name', { boardType: selectedBoardType })}</label>
                                    <input
                                        type="text"
                                        value={newCatName}
                                        onChange={(e) => setNewCatName(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-white text-sm"
                                        placeholder={t('settings.category_name_placeholder')}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label className="block text-xs text-gray-400 mb-1">{t('settings.color')}</label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="color"
                                            value={newCatColor}
                                            onChange={(e) => setNewCatColor(e.target.value)}
                                            className="h-9 w-9 bg-gray-700 border border-gray-600 rounded cursor-pointer p-0.5"
                                        />
                                        <div className="grid grid-cols-6 gap-1 w-28">
                                            {PRESET_COLORS.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setNewCatColor(c)}
                                                    className={`w-4 h-4 rounded-full border ${newCatColor === c ? 'border-white scale-125' : 'border-gray-600 hover:scale-125 hover:border-gray-400'} transition-all`}
                                                    style={{ backgroundColor: c }}
                                                    title={c}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-end h-[60px]">
                                    <button onClick={handleAddCategory} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 flex items-center h-9">
                                        <Plus size={16} className="mr-1" /> {t('settings.add')}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {filteredCategories.length === 0 && (
                                    <div className="text-center text-gray-500 py-4 italic">{t('settings.no_categories_defined', { boardType: selectedBoardType })}</div>
                                )}
                                {filteredCategories.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded border border-gray-700">
                                        {editingCategoryId === cat.id ? (
                                            <div className="flex flex-col space-y-2 flex-1 mr-2">
                                                <input
                                                    type="text"
                                                    value={editCatName}
                                                    onChange={(e) => setEditCatName(e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                                                    autoFocus
                                                    placeholder={t('settings.category_name')}
                                                />
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="color"
                                                        value={editCatColor}
                                                        onChange={(e) => setEditCatColor(e.target.value)}
                                                        className="h-6 w-6 bg-gray-600 border border-gray-500 rounded cursor-pointer p-0"
                                                    />
                                                    <div className="flex flex-wrap gap-1">
                                                        {PRESET_COLORS.map(c => (
                                                            <button
                                                                key={c}
                                                                onClick={() => setEditCatColor(c)}
                                                                className={`w-4 h-4 rounded-full border ${editCatColor === c ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'}`}
                                                                style={{ backgroundColor: c }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center space-x-3">
                                                <div className="w-6 h-6 rounded-full border border-gray-500 shadow-sm" style={{ backgroundColor: cat.color }}></div>
                                                <span className="font-mono font-bold">{cat.label}</span>
                                                <span className="text-xs text-gray-500">({cat.id})</span>
                                            </div>
                                        )}

                                        <div className="flex items-center space-x-1">
                                            {editingCategoryId === cat.id ? (
                                                <>
                                                    <button onClick={handleSaveEdit} className="p-2 text-green-400 hover:bg-green-900/30 rounded" title={t('common.save')}>
                                                        <Check size={16} />
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="p-2 text-gray-400 hover:bg-gray-600 rounded" title={t('common.cancel')}>
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleStartEdit(cat)} className="p-2 text-blue-400 hover:bg-blue-900/30 rounded" title={t('common.edit')}>
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-red-400 hover:bg-red-900/30 rounded" title={t('common.delete')}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'instruments' && (
                        <div className="animate-in fade-in">
                            <InstrumentManager />
                        </div>
                    )}

                    {/* --- AI Tab --- */}
                    {activeTab === 'ai' && (
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
                    )}

                    {activeTab === 'about' && (
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
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Measure Point</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">Enter</kbd>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Cancel / Close</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">Esc</kbd>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Mode: Voltage</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">V</kbd>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Mode: Resistance</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">R</kbd>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Mode: Diode</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">D</kbd>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Mode: Ground</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">G</kbd>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Mode: Oscilloscope</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">O</kbd>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Delete Point</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">Del</kbd>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Save Project</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">Ctrl + S</kbd>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Undo</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">Ctrl + Z</kbd>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Redo</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">Ctrl + Y</kbd>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-1">
                                        <span>Zoom In/Out</span>
                                        <kbd className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 font-mono text-xs text-gray-300">Ctrl + Scroll</kbd>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-center space-y-4 pt-4 border-t border-gray-700">
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-400">Developed by <strong className="text-white">Z Electrónica UY</strong></span>
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
                    )}
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
                            onSave(localInstruments, apiKey, localAppSettings);
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
