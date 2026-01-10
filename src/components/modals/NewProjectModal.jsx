import React, { useState, useRef, useEffect } from 'react';
import { X, FilePlus, UploadCloud, Trash2, PlusCircle } from 'lucide-react';

const NewProjectModal = ({ isOpen, onClose, onCreate, knownAttributes }) => {
    const [availableTypes, setAvailableTypes] = useState(["Laptop", "Desktop", "Industrial", "Mobile", "Other"]);
    const [boardType, setBoardType] = useState("Laptop");
    const [boardModel, setBoardModel] = useState('');
    const [notes, setNotes] = useState('');
    const [dynamicAttributes, setDynamicAttributes] = useState([{ key: '', value: '' }]);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [customBoardType, setCustomBoardType] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen && window.electronAPI) {
            window.electronAPI.getBoardTypes().then(types => {
                setAvailableTypes(types);
                if (types.length > 0 && !types.includes(boardType)) {
                    setBoardType(types[0]);
                }
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // --- Dynamic Attributes Handlers ---
    const handleAttributeChange = (index, field, value) => {
        const newAttributes = [...dynamicAttributes];
        newAttributes[index][field] = value;
        setDynamicAttributes(newAttributes);
    };

    const addAttribute = () => {
        setDynamicAttributes([...dynamicAttributes, { key: '', value: '' }]);
    };

    const removeAttribute = (index) => {
        setDynamicAttributes(dynamicAttributes.filter((_, i) => i !== index));
    };
    // ------------------------------------

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const fileToUint8Array = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(new Uint8Array(event.target.result));
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!boardModel.trim() || !imageFile) {
            alert("Board Model and an image are required.");
            return;
        }

        try {
            const imageDataUint8Array = await fileToUint8Array(imageFile);
            
            // Convert array of attributes to a JSON object
            const attributesObject = dynamicAttributes.reduce((acc, { key, value }) => {
                if (key.trim()) { // Only include attributes with a name
                    acc[key.trim()] = value.trim();
                }
                return acc;
            }, {});

            const finalBoardType = boardType === 'Other' ? customBoardType.trim() : boardType;
            if (boardType === 'Other' && !finalBoardType) {
                alert("Please specify the custom board type.");
                return;
            }

            if (boardType === 'Other' && window.electronAPI) {
                await window.electronAPI.addBoardType(finalBoardType);
            }

            const projectData = {
                board_type: finalBoardType,
                board_model: boardModel.trim(),
                attributes: attributesObject,
                notes: notes.trim(),
                image_data: imageDataUint8Array, // Ahora es un Uint8Array
            };
            
            onCreate(projectData);
            
            // Reset state
            setBoardModel('');
            setNotes('');
            setCustomBoardType('');
            setDynamicAttributes([{ key: '', value: '' }]);
            setImageFile(null);
            setImagePreview(null);
            setCustomBoardType('');
            onClose();
        } catch (error) {
            console.error("Error processing data:", error);
            alert("Failed to process project data.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl text-white animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold flex items-center"><FilePlus size={20} className="mr-2"/> Create New Project</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="p-6 grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Board Type</label>
                                <select value={boardType} onChange={e => setBoardType(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2">
                                    {availableTypes.map(type => <option key={type} value={type}>{type}</option>)}
                                </select>
                                {boardType === 'Other' && (
                                    <input 
                                        type="text" 
                                        value={customBoardType} 
                                        onChange={e => setCustomBoardType(e.target.value)} 
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 mt-2" 
                                        placeholder="Specify Board Type" 
                                        required
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Board Model / Name</label>
                                <input type="text" value={boardModel} onChange={(e) => setBoardModel(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2" placeholder="e.g., MacBook Pro A2141 2019" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Project Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 h-28 resize-none"
                                    placeholder="Initial diagnosis, board condition..."
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Custom Attributes</label>
                                <div className="space-y-2">
                                    {dynamicAttributes.map((attr, index) => (
                                        <div key={index} className="flex items-center space-x-2">
                                            <input type="text" list="attribute-keys" placeholder="Attribute (e.g., CPU)" value={attr.key} onChange={e => handleAttributeChange(index, 'key', e.target.value)} className="flex-1 w-1/3 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm" />
                                            <input type="text" list="attribute-values" placeholder="Value" value={attr.value} onChange={e => handleAttributeChange(index, 'value', e.target.value)} className="flex-1 w-2/3 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm" />
                                            <button type="button" onClick={() => removeAttribute(index)} className="p-2 text-red-500 hover:bg-gray-700 rounded-full"><Trash2 size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                                <datalist id="attribute-keys">
                                    {knownAttributes.keys.map(key => <option key={key} value={key} />)}
                                </datalist>
                                <datalist id="attribute-values">
                                    {knownAttributes.values.map(val => <option key={val} value={val} />)}
                                </datalist>
                                <button type="button" onClick={addAttribute} className="mt-2 flex items-center text-sm text-blue-400 hover:text-blue-300">
                                    <PlusCircle size={16} className="mr-1"/> Add Attribute
                                </button>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Board Image</label>
                            <div className="w-full h-64 border-2 border-dashed border-gray-600 rounded-lg flex flex-col justify-center items-center text-gray-400 cursor-pointer hover:border-blue-500 hover:text-blue-500 transition" onClick={() => fileInputRef.current.click()}>
                                {imagePreview ? <img src={imagePreview} alt="Board Preview" className="w-full h-full object-contain rounded-lg" /> : (<> <UploadCloud size={48} /> <p className="mt-2">Click to upload an image</p> <p className="text-xs">(Required)</p> </>)}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" required />
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold disabled:opacity-50" disabled={!boardModel.trim() || !imageFile}>Create Project</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewProjectModal;
