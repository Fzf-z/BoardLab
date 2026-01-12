import React, { useState } from 'react';
import { X, Folder, Trash2, Search, Edit2, Save, ArrowLeft, Plus } from 'lucide-react';
import { Project } from '../../types';

interface ProjectManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
    onLoadProject: (project: Project) => void;
    onDeleteProject: (id: number) => void;
    onUpdateProject: (project: Partial<Project>) => void;
}

type EditingProject = Omit<Project, 'attributes'> & { attributes: Record<string, string> };

const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({ 
    isOpen, onClose, projects, onLoadProject, onDeleteProject, onUpdateProject 
}) => {
    const [filter, setFilter] = useState<string>('');
    const [editingProject, setEditingProject] = useState<EditingProject | null>(null);
    const [newAttrKey, setNewAttrKey] = useState<string>('');
    const [newAttrValue, setNewAttrValue] = useState<string>('');

    if (!isOpen) return null;

    const filteredProjects = projects.filter(p => 
        (p.board_model || '').toLowerCase().includes(filter.toLowerCase()) || 
        (p.board_type || '').toLowerCase().includes(filter.toLowerCase())
    );

    // --- Edit Form State Handling ---
    const handleEditStart = (project: Project) => {
        // Ensure attributes is an object. If string, try parse, else empty object.
        let attrs: Record<string, string> = {};
        if (typeof project.attributes === 'string') {
            try {
                attrs = JSON.parse(project.attributes);
            } catch (e) {
                // ignore
            }
        } else if (typeof project.attributes === 'object' && project.attributes !== null) {
             // @ts-ignore
            attrs = { ...project.attributes };
        }

        setEditingProject({ ...project, attributes: attrs });
        setNewAttrKey('');
        setNewAttrValue('');
    };

    const handleEditCancel = () => {
        setEditingProject(null);
    };

    const handleEditSave = () => {
        if (onUpdateProject && editingProject) {
            onUpdateProject({
                ...editingProject,
                attributes: JSON.stringify(editingProject.attributes)
            });
            setEditingProject(null);
        }
    };

    const handleAttributeChange = (key: string, value: string) => {
        if (!editingProject) return;
        setEditingProject(prev => {
            if (!prev) return null;
            const currentAttrs = prev.attributes;
            return {
                ...prev,
                attributes: { ...currentAttrs, [key]: value }
            };
        });
    };

    const handleAddAttribute = () => {
        if (newAttrKey.trim() && newAttrValue.trim() && editingProject) {
            setEditingProject(prev => {
                if (!prev) return null;
                const currentAttrs = prev.attributes;
                return {
                    ...prev,
                    attributes: { ...currentAttrs, [newAttrKey.trim()]: newAttrValue.trim() }
                };
            });
            setNewAttrKey('');
            setNewAttrValue('');
        }
    };

    // --- Render Edit View ---
    if (editingProject) {
        const attributes = editingProject.attributes || {};
        
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
                                onChange={e => setEditingProject(prev => prev ? ({ ...prev, board_model: e.target.value }) : null)}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Board Type</label>
                            <select 
                                value={editingProject.board_type} 
                                onChange={e => setEditingProject(prev => prev ? ({ ...prev, board_type: e.target.value }) : null)}
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
                                onChange={e => setEditingProject(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white h-24 resize-none"
                                placeholder="General repair notes..."
                            />
                        </div>
                        
                        <div className="pt-4 border-t border-gray-700">
                            <h3 className="text-sm font-bold text-gray-300 mb-3">Attributes</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(attributes).map(([key, val]) => (
                                    <div key={key}>
                                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">{key}</label>
                                        <input 
                                            type="text" 
                                            value={val}
                                            onChange={(e) => handleAttributeChange(key, e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-600 rounded p-1.5 text-sm text-white"
                                        />
                                    </div>
                                ))}
                            </div>
                            
                            {/* Add new attribute */}
                            <div className="mt-4 flex space-x-2 items-end">
                                <div className="flex-1">
                                    <input 
                                        type="text" 
                                        placeholder="New Attribute Name"
                                        value={newAttrKey}
                                        onChange={e => setNewAttrKey(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                                    />
                                </div>
                                <div className="flex-1">
                                    <input 
                                        type="text" 
                                        placeholder="Value"
                                        value={newAttrValue}
                                        onChange={e => setNewAttrValue(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                                        onKeyDown={e => e.key === 'Enter' && handleAddAttribute()}
                                    />
                                </div>
                                <button 
                                    onClick={handleAddAttribute}
                                    className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-700 flex justify-end">
                         <button 
                            onClick={handleEditSave} 
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded flex items-center shadow-lg"
                        >
                            <Save size={18} className="mr-2" /> Save Changes
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- Render List View ---
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-700 overflow-hidden flex flex-col h-[80vh]">
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <Folder className="mr-2 text-yellow-500" />
                        Project Manager
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white bg-gray-700 p-2 rounded-full"><X size={20} /></button>
                </div>
                
                <div className="p-4 bg-gray-800 border-b border-gray-700">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search projects..." 
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {filteredProjects.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">
                            No projects found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredProjects.map(project => (
                                <div key={project.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors group relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-lg text-white">{project.board_model}</h3>
                                            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{project.board_type}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="text-sm text-gray-500 mb-4 line-clamp-2">
                                        {project.notes || "No notes."}
                                    </div>
                                    
                                    <div className="flex items-center text-xs text-gray-500 mb-4">
                                         {/* Attributes preview could go here */}
                                         {project.created_at && new Date(project.created_at).toLocaleDateString()}
                                    </div>

                                    <div className="flex space-x-2 mt-auto">
                                        <button 
                                            onClick={() => onLoadProject(project)}
                                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded text-sm font-medium transition-colors"
                                        >
                                            Open
                                        </button>
                                        <button 
                                            onClick={() => handleEditStart(project)}
                                            className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                                            title="Edit Details"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (window.confirm(`Delete project "${project.board_model}"?`)) {
                                                    onDeleteProject(project.id);
                                                }
                                            }}
                                            className="p-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectManagerModal;
