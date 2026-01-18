import React, { useState, useRef, useEffect, ChangeEvent, FormEvent } from 'react';
import { X, FilePlus, UploadCloud, Trash2, PlusCircle } from 'lucide-react';
import { CreateProjectData } from '../../types';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (projectData: CreateProjectData) => Promise<void>;
    knownAttributes?: { keys: string[], values: string[] };
}

interface DynamicAttribute {
    key: string;
    value: string;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({ 
    isOpen, 
    onClose, 
    onCreate, 
    knownAttributes = { keys: [], values: [] } 
}) => {
    const [availableTypes, setAvailableTypes] = useState<string[]>(["Laptop", "Desktop", "Industrial", "Mobile", "Other"]);
    const [boardType, setBoardType] = useState<string>("Laptop");
    const [boardModel, setBoardModel] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [dynamicAttributes, setDynamicAttributes] = useState<DynamicAttribute[]>([{ key: '', value: '' }]);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFileB, setImageFileB] = useState<File | null>(null);
    const [imagePreviewB, setImagePreviewB] = useState<string | null>(null);
    const [customBoardType, setCustomBoardType] = useState<string>('');
    const [fetchedAttributes, setFetchedAttributes] = useState<{ keys: string[], values: string[] }>({ keys: [], values: [] });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileInputRefB = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && window.electronAPI) {
            window.electronAPI.getBoardTypes().then((types: string[]) => {
                setAvailableTypes(types);
                if (types.length > 0 && !types.includes(boardType)) {
                    setBoardType(types[0]);
                }
            });
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && window.electronAPI) {
            const typeToFetch = boardType === 'Other' ? undefined : boardType;
            window.electronAPI.getAllAttributes(typeToFetch).then((attrs: { keys: string[], values: string[] }) => {
                setFetchedAttributes(attrs || { keys: [], values: [] });
            }).catch(console.error);
        }
    }, [isOpen, boardType]);

    if (!isOpen) return null;

    // --- Dynamic Attributes Handlers ---
    const handleAttributeChange = (index: number, field: keyof DynamicAttribute, value: string) => {
        const newAttributes = [...dynamicAttributes];
        newAttributes[index][field] = value;
        setDynamicAttributes(newAttributes);
    };

    const addAttribute = () => {
        setDynamicAttributes([...dynamicAttributes, { key: '', value: '' }]);
    };

    const removeAttribute = (index: number) => {
        setDynamicAttributes(dynamicAttributes.filter((_, i) => i !== index));
    };
    // ------------------------------------

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleImageChangeB = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFileB(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreviewB(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const fileToUint8Array = (file: File): Promise<Uint8Array> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(new Uint8Array(event.target?.result as ArrayBuffer));
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!boardModel.trim() || !imageFile) {
            alert("Board Model and an image are required.");
            return;
        }

        try {
            const imageDataUint8Array = await fileToUint8Array(imageFile);
            const imageDataBUint8Array = imageFileB ? await fileToUint8Array(imageFileB) : undefined;
            
            // Convert array of attributes to a JSON object
            const attributesObject = dynamicAttributes.reduce<Record<string, string>>((acc, { key, value }) => {
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
                image_data_b: imageDataBUint8Array, // Side B
            };
            
            console.log("Creating project with Side B:", !!imageDataBUint8Array);
            
            onCreate(projectData);
            
            // Reset state
            setBoardModel('');
            setNotes('');
            setDynamicAttributes([{ key: '', value: '' }]);
            setImageFile(null);
            setImagePreview(null);
        } catch (error) {
            console.error("Error processing image:", error);
            alert("Error processing image file.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-900 to-gray-800 p-6 border-b border-gray-700 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <FilePlus className="text-white" size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Nuevo Proyecto</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-gray-700/50 hover:bg-red-500/80 p-2 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* 1. Basic Info Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Board Type Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-300">Tipo de Placa</label>
                                <select 
                                    value={boardType} 
                                    onChange={(e) => setBoardType(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    {availableTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                                {boardType === 'Other' && (
                                    <input
                                        type="text"
                                        placeholder="Especificar tipo (ej: Console, TV...)"
                                        value={customBoardType}
                                        onChange={(e) => setCustomBoardType(e.target.value)}
                                        className="w-full mt-2 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm animate-in slide-in-from-top-2"
                                        autoFocus
                                    />
                                )}
                            </div>

                            {/* Model Input */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-300">Modelo / Identificador</label>
                                <input
                                    type="text"
                                    value={boardModel}
                                    onChange={(e) => setBoardModel(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    placeholder="ej: NM-A311, MacBook 820-00165"
                                    required
                                />
                            </div>
                        </div>

                        {/* 2. Image Upload Section */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-300 block">Imágenes de la Placa</label>
                            
                            <div className="flex gap-4">
                                {/* Image Upload A */}
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex-1 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all group h-48 relative ${imagePreview ? 'border-blue-500/50 bg-blue-500/5' : 'border-gray-600 hover:border-blue-400 hover:bg-gray-700/50'}`}
                                >
                                    {imagePreview ? (
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <img src={imagePreview} alt="Preview A" className="max-h-full max-w-full rounded shadow-lg object-contain" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                                <p className="text-white font-bold text-xs flex items-center"><UploadCloud className="mr-2" size={16}/> Cambiar Cara A</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-gray-700 p-3 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                                <UploadCloud className="text-blue-400" size={24} />
                                            </div>
                                            <p className="text-gray-300 font-medium text-sm">Cara A (Frontal)</p>
                                            <p className="text-gray-500 text-xs mt-1">Requerido</p>
                                        </>
                                    )}
                                    <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow">Cara A</div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleImageChange} 
                                        className="hidden" 
                                        accept="image/*" 
                                    />
                                </div>

                                {/* Image Upload B */}
                                <div 
                                    onClick={() => fileInputRefB.current?.click()}
                                    className={`flex-1 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all group h-48 relative ${imagePreviewB ? 'border-purple-500/50 bg-purple-500/5' : 'border-gray-600 hover:border-purple-400 hover:bg-gray-700/50'}`}
                                >
                                    {imagePreviewB ? (
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <img src={imagePreviewB} alt="Preview B" className="max-h-full max-w-full rounded shadow-lg object-contain" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                                <p className="text-white font-bold text-xs flex items-center"><UploadCloud className="mr-2" size={16}/> Cambiar Cara B</p>
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setImageFileB(null);
                                                    setImagePreviewB(null);
                                                }}
                                                className="absolute top-1 right-1 p-1 bg-red-600 rounded-full text-white hover:bg-red-700 z-10"
                                                title="Eliminar imagen"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-gray-700 p-3 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                                <UploadCloud className="text-purple-400" size={24} />
                                            </div>
                                            <p className="text-gray-300 font-medium text-sm">Cara B (Trasera)</p>
                                            <p className="text-gray-500 text-xs mt-1">Opcional</p>
                                        </>
                                    )}
                                    <div className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow">Cara B</div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRefB} 
                                        onChange={handleImageChangeB} 
                                        className="hidden" 
                                        accept="image/*" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Attributes Section */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-semibold text-gray-300">Detalles Técnicos (Opcional)</label>
                                <button type="button" onClick={addAttribute} className="text-xs flex items-center text-blue-400 hover:text-blue-300 transition-colors">
                                    <PlusCircle size={14} className="mr-1" /> Agregar Campo
                                </button>
                            </div>
                            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700 space-y-2 max-h-40 overflow-y-auto">
                                {dynamicAttributes.map((attr, index) => (
                                    <div key={index} className="flex space-x-2 animate-in slide-in-from-left-2">
                                        <input
                                            type="text"
                                            placeholder="Atributo (ej: CPU, RAM)"
                                            value={attr.key}
                                            onChange={(e) => handleAttributeChange(index, 'key', e.target.value)}
                                            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                                            list="known-keys"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Valor"
                                            value={attr.value}
                                            onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                                            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                                            list="known-values"
                                        />
                                        {dynamicAttributes.length > 1 && (
                                            <button type="button" onClick={() => removeAttribute(index)} className="text-red-400 hover:bg-red-900/30 p-1.5 rounded transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                         {/* 4. Notes Section */}
                         <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-300">Notas Generales</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-20 resize-none text-sm"
                                placeholder="Notas sobre el estado inicial, falla reportada..."
                            />
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="bg-gray-800 p-4 border-t border-gray-700 flex justify-end space-x-3">
                    <button 
                        onClick={onClose} 
                        className="px-5 py-2 rounded-lg text-gray-300 hover:bg-gray-700 font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/20 transition-all transform hover:scale-105 active:scale-95"
                    >
                        Crear Proyecto
                    </button>
                </div>
                
                {/* Datalist for Autocomplete */}
                <datalist id="known-keys">
                    {fetchedAttributes.keys.map((k, i) => <option key={i} value={k} />)}
                </datalist>
                <datalist id="known-values">
                    {fetchedAttributes.values.map((v, i) => <option key={i} value={v} />)}
                </datalist>
            </div>
        </div>
    );
};

export default NewProjectModal;
