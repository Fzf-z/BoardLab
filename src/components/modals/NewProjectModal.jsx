import React, { useState } from 'react';
import { X, FilePlus } from 'lucide-react';

const NewProjectModal = ({ isOpen, onClose, onCreate }) => {
    const [projectName, setProjectName] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (projectName.trim()) {
            onCreate(projectName.trim());
            setProjectName('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md text-white animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold flex items-center"><FilePlus size={20} className="mr-2"/> Create New Project</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <label htmlFor="projectName" className="block text-sm font-medium text-gray-300 mb-2">
                            Project Name
                        </label>
                        <input
                            type="text"
                            id="projectName"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="e.g., Motherboard Rev. 2"
                            autoFocus
                        />
                    </div>

                    <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex justify-end space-x-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!projectName.trim()}
                        >
                            Create Project
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewProjectModal;
