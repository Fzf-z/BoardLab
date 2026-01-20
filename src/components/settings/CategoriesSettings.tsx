import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotifier } from '../../contexts/NotifierContext';
import { useProject } from '../../contexts/ProjectContext';
import type { AppSettings, PointCategory } from '../../types';

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
    '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#ffffff'
];

interface CategoriesSettingsProps {
    localAppSettings: AppSettings;
    setLocalAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export const CategoriesSettings: React.FC<CategoriesSettingsProps> = ({
    localAppSettings,
    setLocalAppSettings
}) => {
    const { boardTypes, addBoardType } = useProject();
    const { showNotification } = useNotifier();
    const { t } = useTranslation();

    const [selectedBoardType, setSelectedBoardType] = useState<string>('Laptop');
    const [newCatName, setNewCatName] = useState('');
    const [newCatColor, setNewCatColor] = useState('#ffffff');
    const [isAddingBoardType, setIsAddingBoardType] = useState(false);
    const [newBoardTypeName, setNewBoardTypeName] = useState('');

    // Editing state
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editCatName, setEditCatName] = useState('');
    const [editCatColor, setEditCatColor] = useState('#ffffff');

    useEffect(() => {
        if (boardTypes.length > 0 && !boardTypes.includes(selectedBoardType)) {
            setSelectedBoardType(boardTypes[0]);
        }
    }, [boardTypes, selectedBoardType]);

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

    const filteredCategories = (localAppSettings.categories || []).filter(c =>
        c.boardType === selectedBoardType || (!c.boardType && selectedBoardType === 'General')
    );

    return (
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

            {/* Add Category Form */}
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

            {/* Categories List */}
            <div className="space-y-2">
                {filteredCategories.length === 0 && (
                    <div className="text-center text-gray-500 py-4 italic">{t('settings.no_categories_defined', { boardType: selectedBoardType })}</div>
                )}
                {filteredCategories.map(cat => (
                    <CategoryRow
                        key={cat.id}
                        category={cat}
                        isEditing={editingCategoryId === cat.id}
                        editCatName={editCatName}
                        editCatColor={editCatColor}
                        setEditCatName={setEditCatName}
                        setEditCatColor={setEditCatColor}
                        onStartEdit={() => handleStartEdit(cat)}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={handleCancelEdit}
                        onDelete={() => handleDeleteCategory(cat.id)}
                    />
                ))}
            </div>
        </div>
    );
};

interface CategoryRowProps {
    category: PointCategory;
    isEditing: boolean;
    editCatName: string;
    editCatColor: string;
    setEditCatName: (name: string) => void;
    setEditCatColor: (color: string) => void;
    onStartEdit: () => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onDelete: () => void;
}

const CategoryRow: React.FC<CategoryRowProps> = ({
    category,
    isEditing,
    editCatName,
    editCatColor,
    setEditCatName,
    setEditCatColor,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onDelete
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-between bg-gray-700/50 p-3 rounded border border-gray-700">
            {isEditing ? (
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
                    <div className="w-6 h-6 rounded-full border border-gray-500 shadow-sm" style={{ backgroundColor: category.color }}></div>
                    <span className="font-mono font-bold">{category.label}</span>
                    <span className="text-xs text-gray-500">({category.id})</span>
                </div>
            )}

            <div className="flex items-center space-x-1">
                {isEditing ? (
                    <>
                        <button onClick={onSaveEdit} className="p-2 text-green-400 hover:bg-green-900/30 rounded" title={t('common.save')}>
                            <Check size={16} />
                        </button>
                        <button onClick={onCancelEdit} className="p-2 text-gray-400 hover:bg-gray-600 rounded" title={t('common.cancel')}>
                            <X size={16} />
                        </button>
                    </>
                ) : (
                    <>
                        <button onClick={onStartEdit} className="p-2 text-blue-400 hover:bg-blue-900/30 rounded" title={t('common.edit')}>
                            <Edit2 size={16} />
                        </button>
                        <button onClick={onDelete} className="p-2 text-red-400 hover:bg-red-900/30 rounded" title={t('common.delete')}>
                            <Trash2 size={16} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default CategoriesSettings;
