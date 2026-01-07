import React, { useState } from 'react';
import { X, Folder, Trash2, Search } from 'lucide-react';

const ProjectManagerModal = ({ isOpen, onClose, projects, onLoadProject, onDeleteProject }) => {
    const [filter, setFilter] = useState('');

    if (!isOpen) return null;

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
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl text-white animate-in fade-in zoom-in-95 flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Project Manager</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-700">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by model, type, CPU, etc..."
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="p-6 flex-1 overflow-y-auto">
                    {projects.length === 0 ? (
                        <p className="text-gray-400 text-center">No saved projects found.</p>
                    ) : filteredProjects.length === 0 ? (
                        <p className="text-gray-400 text-center">No projects match your search.</p>
                    ) : (
                        <div className="space-y-3">
                            {filteredProjects.map(p => (
                                <div key={p.id} className="bg-gray-900/80 p-4 rounded-lg flex justify-between items-center hover:bg-gray-900 transition-colors">
                                    <div className="flex items-center">
                                        <Folder className="text-blue-400 mr-4" size={24}/>
                                        <div>
                                            <div className="font-bold">{p.board_model}</div>
                                            <div className="text-xs text-gray-400">
                                                {p.board_type} - Created: {new Date(p.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button 
                                            onClick={() => onLoadProject(p)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold"
                                        >
                                            Open
                                        </button>
                                        <button 
                                            onClick={() => onDeleteProject(p.id)}
                                            className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-700 bg-gray-800/50 text-right">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectManagerModal;
