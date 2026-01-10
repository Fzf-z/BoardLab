import React, { useState } from 'react';
import { X, Folder, Trash2, Search, Edit2, Save, ArrowLeft, Plus } from 'lucide-react';

const ProjectManagerModal = ({ isOpen, onClose, projects, onLoadProject, onDeleteProject, onUpdateProject }) => {
    const [filter, setFilter] = useState('');
    const [editingProject, setEditingProject] = useState(null);
    const [newAttrKey, setNewAttrKey] = useState('');
    const [newAttrValue, setNewAttrValue] = useState('');

    if (!isOpen) return null;

    // --- Edit Form State Handling ---
    const handleEditStart = (project) => {
        setEditingProject({ ...project, attributes: { ...project.attributes } });
        setNewAttrKey('');
        setNewAttrValue('');
    };

    const handleEditCancel = () => {
        setEditingProject(null);
    };

    const handleEditSave = () => {
        if (onUpdateProject && editingProject) {
            onUpdateProject(editingProject);
            setEditingProject(null);
        }
    };

    const handleAttributeChange = (key, value) => {
        setEditingProject(prev => ({
            ...prev,
            attributes: { ...prev.attributes, [key]: value }
        }));
    };

    const handleAddAttribute = () => {
        if (newAttrKey.trim() && newAttrValue.trim()) {
            setEditingProject(prev => ({
                ...prev,
                attributes: { ...prev.attributes, [newAttrKey.trim()]: newAttrValue.trim() }
            }));
            setNewAttrKey('');
            setNewAttrValue('');
        }
    };

    // --- Render Edit View ---
    if (editingProject) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
                <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl text-white animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                        <h2 className="text-lg font-bold flex items-center">
                            <button onClick={handleEditCancel} className="mr-3 p-1 hover:bg-gray-700 rounded-full"><ArrowLeft size={20} /></button>
                            Edit Project
                        </h2>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Board Model</label>
                            <input 
                                type="text" 
                                value={editingProject.board_model} 
                                onChange={e => setEditingProject(prev => ({ ...prev, board_model: e.target.value }))}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Board Type</label>
                            <select 
                                value={editingProject.board_type} 
                                onChange={e => setEditingProject(prev => ({ ...prev, board_type: e.target.value }))}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            >
                                <option value="Laptop">Laptop</option>
                                <option value="Desktop">Desktop</option>
                                <option value="Industrial">Industrial</option>
                                <option value="Mobile">Mobile</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Project Notes</label>
                            <textarea 
                                value={editingProject.notes || ''} 
                                onChange={e => setEditingProject(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white h-24 resize-none"
                                placeholder="General repair notes..."
                            />
                        </div>
                        
                        <div className="pt-4 border-t border-gray-700">
                            <h3 className="text-sm font-bold text-gray-300 mb-3">Attributes</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(editingProject.attributes || {}).map(([key, val]) => (
                                    <div key={key}>
                                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">{key}</label>
                                        <input 
                                            type="text" 
                                            value={val} 
                                            onChange={e => handleAttributeChange(key, e.target.value)}
                                            className="w-full bg-gray-900/50 border border-gray-600 rounded p-2 text-sm text-white"
                                        />
                                    </div>
                                ))}
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-gray-700/50">
                                <label className="block text-xs font-bold text-blue-400 mb-2 uppercase">Add New Attribute</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Name (e.g. GPU)" 
                                        value={newAttrKey}
                                        onChange={e => setNewAttrKey(e.target.value)}
                                        className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Value (e.g. RTX 3060)" 
                                        value={newAttrValue}
                                        onChange={e => setNewAttrValue(e.target.value)}
                                        className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                                    />
                                    <button 
                                        onClick={handleAddAttribute}
                                        disabled={!newAttrKey.trim() || !newAttrValue.trim()}
                                        className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex justify-end space-x-3">
                        <button onClick={handleEditCancel} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">Cancel</button>
                        <button onClick={handleEditSave} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg flex items-center">
                            <Save size={18} className="mr-2" /> Save Changes
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- Render List View ---
    const lowerCaseFilter = filter.toLowerCase();
    const filteredProjects = projects.filter(p => {
        if (!filter) return true;
        const modelMatch = p.board_model.toLowerCase().includes(lowerCaseFilter);
        const typeMatch = p.board_type.toLowerCase().includes(lowerCaseFilter);
        const attributesMatch = p.attributes && Object.values(p.attributes).some(val => 
            String(val).toLowerCase().includes(lowerCaseFilter)
        );
        return modelMatch || typeMatch || attributesMatch;
    });

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl text-white animate-in fade-in zoom-in-95 flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center">
                        <Folder className="mr-2 text-blue-400" /> Project Manager
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Filter projects..."
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-gray-900/30">
                    {projects.length === 0 ? (
                        <div className="text-center py-10">
                            <Folder size={48} className="mx-auto text-gray-600 mb-2" />
                            <p className="text-gray-500">No saved projects found.</p>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <p className="text-gray-500 text-center py-10">No projects match your search.</p>
                    ) : (
                        filteredProjects.map(p => (
                            <div key={p.id} className="bg-gray-800 border border-gray-700 p-4 rounded-xl flex justify-between items-start hover:border-gray-500 transition-colors group shadow-sm">
                                <div className="flex-1 min-w-0 mr-4">
                                    <div className="flex items-center mb-1">
                                        <h3 className="font-bold text-lg text-white truncate mr-3">{p.board_model}</h3>
                                        <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded border border-blue-800">{p.board_type}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mb-3">Created: {new Date(p.created_at).toLocaleString()}</div>
                                    
                                    {p.notes && (
                                        <div className="mb-3 text-xs text-gray-400 italic bg-gray-900/30 p-2 rounded border-l-2 border-blue-500/50 line-clamp-2">
                                            {p.notes}
                                        </div>
                                    )}

                                    {/* Attributes Chips */}
                                    <div className="flex flex-wrap gap-2">
                                        {p.attributes && Object.entries(p.attributes).map(([key, val]) => (
                                            val && (
                                                <span key={key} className="inline-flex items-center px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-300">
                                                    <span className="font-semibold text-gray-500 mr-1 uppercase text-[10px]">{key}:</span> {val}
                                                </span>
                                            )
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => onLoadProject(p)}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-semibold shadow-lg"
                                    >
                                        Open
                                    </button>
                                    <button 
                                        onClick={() => handleEditStart(p)}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                        title="Edit Details"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if(window.confirm('Delete project?')) onDeleteProject(p.id);
                                        }}
                                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                                        title="Delete Project"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-gray-700 bg-gray-800/50 text-right">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectManagerModal;
