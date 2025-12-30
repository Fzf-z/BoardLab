import React from 'react';
import { X, Folder, Trash2 } from 'lucide-react';

const ProjectManagerModal = ({ isOpen, onClose, projects, onOpen, onDelete }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl text-white animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Project Manager</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {projects.length === 0 ? (
                        <p className="text-gray-400 text-center">No saved projects found.</p>
                    ) : (
                        <div className="space-y-3">
                            {projects.map(p => (
                                <div key={p.id} className="bg-gray-900/80 p-4 rounded-lg flex justify-between items-center hover:bg-gray-900 transition-colors">
                                    <div className="flex items-center">
                                        <Folder className="text-blue-400 mr-4" size={24}/>
                                        <div>
                                            <div className="font-bold">{p.nombre}</div>
                                            <div className="text-xs text-gray-400">
                                                Created: {new Date(p.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button 
                                            onClick={() => onOpen(p.id)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold"
                                        >
                                            Open
                                        </button>
                                        <button 
                                            onClick={() => onDelete(p.id)}
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
