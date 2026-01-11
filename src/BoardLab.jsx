import React, { useState, useEffect } from 'react';
import { useProject } from './contexts/ProjectContext';
import { useGemini } from './hooks/useGemini';
import { useHardware } from './hooks/useHardware';

import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import BoardView from './components/BoardView';
import AIPanel from './components/AIPanel';
import Settings from './components/Settings';
import PointsTableModal from './components/modals/PointsTableModal';
import ProjectManagerModal from './components/modals/ProjectManagerModal';
import AIModal from './components/modals/AIModal';
import NewProjectModal from './components/modals/NewProjectModal';

const BoardLab = () => {
    // UI State - Stays in this component
    const [mode, setMode] = useState('view');
    const [pointsTableOpen, setPointsTableOpen] = useState(false);
    const [isProjectManagerOpen, setProjectManagerOpen] = useState(false);
    const [isNewProjectModalOpen, setNewProjectModalOpen] = useState(false);

    // Global Project State - Consumed from context
    const {
        board,
        currentProject,
        projectList,
        createProject,
        saveProject,
        loadProject,
        deleteProject,
        updateProject,
        fetchProjectList,
        deletePoint,
        addMeasurement,
        setAutoSave,
        autoSave,
    } = useProject();

    // Other Hooks
    const [apiKey, setApiKey] = useState(''); // API key can be local UI state for Settings
    const hardware = useHardware();
    const gemini = useGemini(apiKey);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = async (e) => {
            // Ignore shortcuts if user is typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const key = e.key.toUpperCase();

            // Mode Switching
            if (key === 'M') setMode('measure');
            if (key === 'V') setMode('view');

            // Save Project (Ctrl+S)
            if ((e.ctrlKey || e.metaKey) && key === 'S') {
                e.preventDefault();
                saveProject();
            }

            // Delete Point
            if (key === 'DELETE') {
                if (board.selectedPointId) {
                    deletePoint(board.selectedPointId);
                }
            }

            // Cancel / Deselect
            if (key === 'ESCAPE') {
                if (isNewProjectModalOpen) setNewProjectModalOpen(false);
                else if (isProjectManagerOpen) setProjectManagerOpen(false);
                else if (pointsTableOpen) setPointsTableOpen(false);
                else if (board.selectedPointId) board.setSelectedPointId(null);
            }

            // Measure (Enter)
            if (key === 'ENTER') {
                if (mode === 'measure' && board.selectedPoint && !hardware.isCapturing) {
                    e.preventDefault();
                    // We need to handle temp points here similar to AIPanel if we want robustness
                    // For now, assuming point is saved or addMeasurement handles it (it doesn't handle temp conversion yet)
                    // Ideally we should use a shared 'measurePoint' action.
                    const measurement = await hardware.captureValue(board.selectedPoint);
                    if (measurement) {
                        await addMeasurement(board.selectedPoint, measurement);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, board.selectedPointId, board.selectedPoint, hardware.isCapturing, isNewProjectModalOpen, isProjectManagerOpen, pointsTableOpen]);

    // Load API key and settings on mount
    useEffect(() => {
        if (hardware.isElectron) {
            window.electronAPI.loadApiKey().then(key => setApiKey(key || ''));
            window.electronAPI.loadConfig().then(config => {
                if (config?.appSettings?.autoSave) {
                    setAutoSave(true);
                }
            });
        }
    }, [hardware.isElectron, setAutoSave]);

    const handleOpenProject = async () => {
        await fetchProjectList();
        setProjectManagerOpen(true);
    };

    const handleCreateProjectAndClose = async (projectData) => {
        await createProject(projectData);
        setNewProjectModalOpen(false);
    };


    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
            <Toolbar
                mode={mode}
                setMode={setMode}
                onUpload={() => board.fileInputRef.current.click()}
                onOpenSettings={() => hardware.setConfigOpen(true)}
                onOpenPointsTable={() => setPointsTableOpen(true)}
                onNewProject={() => setNewProjectModalOpen(true)}
                onOpenProject={handleOpenProject}
                onSaveProject={saveProject}
                onExportPdf={() => { /* Logic to be added */ }}
            />
            <input
                type="file"
                ref={board.fileInputRef}
                onChange={board.handleImageUpload}
                className="hidden"
                accept="image/*"
            />

            <ProjectManagerModal
                isOpen={isProjectManagerOpen}
                onClose={() => setProjectManagerOpen(false)}
                projects={projectList}
                onLoadProject={(p) => {
                    loadProject(p);
                    setProjectManagerOpen(false);
                }}
                onDeleteProject={deleteProject}
                onUpdateProject={updateProject}
            />

            <NewProjectModal
                isOpen={isNewProjectModalOpen}
                onClose={() => setNewProjectModalOpen(false)}
                onCreate={handleCreateProjectAndClose}
            />

            <div className="flex-1 flex flex-col relative">
                <StatusBar
                    scale={board.scale}
                    setScale={board.setScale}
                    isElectron={hardware.isElectron}
                />
                <BoardView
                    mode={mode}
                    currentProjectId={currentProject?.id}
                />
            </div>

            <AIPanel
                askAboutPoint={gemini.askAboutPoint}
                captureValue={hardware.captureValue}
                isCapturing={hardware.isCapturing}
                analyzeBoard={gemini.analyzeBoard}
                instrumentConfig={hardware.instrumentConfig}
            />

            {/* Modals that don't need project data can stay as they are */}
            {hardware.configOpen && (
                <Settings
                    instruments={hardware.instrumentConfig}
                    apiKey={apiKey}
                    setApiKey={setApiKey}
                    autoSave={autoSave}
                    onAutoSaveChange={setAutoSave}
                    onSave={(newConfig, newApiKey, newAutoSave) => {
                        hardware.handleSaveConfig(newConfig);
                        if(window.electronAPI) {
                            window.electronAPI.saveApiKey(newApiKey);
                            window.electronAPI.saveConfig({ ...newConfig, appSettings: { autoSave: newAutoSave } });
                        }
                        setApiKey(newApiKey);
                        setAutoSave(newAutoSave);
                    }}
                    onClose={() => hardware.setConfigOpen(false)}
                />
            )}

            {pointsTableOpen && (
                <PointsTableModal
                    onClose={() => setPointsTableOpen(false)}
                />
            )}

            <AIModal
                isOpen={gemini.aiModalOpen}
                onClose={() => gemini.setAiModalOpen(false)}
                title={gemini.aiTitle}
                response={gemini.aiResponse}
                isLoading={gemini.isAiLoading}
            />
        </div>
    );
}

export default BoardLab;
