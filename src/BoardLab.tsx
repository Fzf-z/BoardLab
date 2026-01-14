import React, { useState, useEffect } from 'react';
import { useProject } from './contexts/ProjectContext';
import { useGemini } from './hooks/useGemini';
import { useHardware } from './hooks/useHardware';
import { InstrumentConfig, Project } from './types';

// Importing Components
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import BoardView from './components/BoardView';
import AIPanel from './components/AIPanel';
import SequencerPanel from './components/SequencerPanel';
import Settings from './components/Settings';
import ProjectManagerModal from './components/modals/ProjectManagerModal';
import AIModal from './components/modals/AIModal';
import NewProjectModal from './components/modals/NewProjectModal';
import ComparisonModal from './components/modals/ComparisonModal';

const BoardLab: React.FC = () => {
    // UI State - Stays in this component
    const [mode, setMode] = useState<'view' | 'measure'>('view');
    const [isProjectManagerOpen, setProjectManagerOpen] = useState<boolean>(false);
    const [isNewProjectModalOpen, setNewProjectModalOpen] = useState<boolean>(false);
    const [isComparisonModalOpen, setComparisonModalOpen] = useState<boolean>(false);
    const [comparisonPoint, setComparisonPoint] = useState<any>(null);

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
        appSettings,
        setAppSettings,
        undo,
        redo,
        sequence,
        startSequence,
        nextInSequence,
    } = useProject();

    // Other Hooks
    const [apiKey, setApiKey] = useState<string>(''); // API key can be local UI state for Settings
    const hardware = useHardware();
    const gemini = useGemini(apiKey);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Ignore shortcuts if user is typing in an input field
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            // Undo (Ctrl+Z)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
                return; // Prevent other shortcuts from firing
            }

            // Redo (Ctrl+Y or Ctrl+Shift+Z)
            if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
                e.preventDefault();
                redo();
                return; // Prevent other shortcuts from firing
            }

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
                else if (board.selectedPointId) board.setSelectedPointId(null);
            }

            // Measure (Enter)
            if (key === 'ENTER') {
                if (sequence.active && board.selectedPoint && !hardware.isCapturing) {
                    e.preventDefault();
                    const measurement = await hardware.captureValue(board.selectedPoint);
                    if (measurement) {
                        await addMeasurement(board.selectedPoint, measurement);
                        // Small delay to let the user see the result briefly if needed, 
                        // but usually instant for efficiency. 
                        nextInSequence();
                    }
                } else if (mode === 'measure' && board.selectedPoint && !hardware.isCapturing) {
                    e.preventDefault();
                    const measurement = await hardware.captureValue(board.selectedPoint);
                    if (measurement) {
                        await addMeasurement(board.selectedPoint, measurement);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, board.selectedPointId, board.selectedPoint, hardware.isCapturing, isNewProjectModalOpen, isProjectManagerOpen, sequence.active]);

    // Load API key and settings on mount
    useEffect(() => {
        if (hardware.isElectron && window.electronAPI) {
            window.electronAPI.loadApiKey().then((key: string) => setApiKey(key || ''));
            window.electronAPI.loadConfig().then((config: any) => {
                if (config?.appSettings) {
                    setAppSettings(config.appSettings);
                }
            });
        }
    }, [hardware.isElectron, setAppSettings]);

    const handleOpenProject = async () => {
        await fetchProjectList();
        setProjectManagerOpen(true);
    };

    const handleCreateProjectAndClose = async (projectData: any) => {
        await createProject(projectData);
        setNewProjectModalOpen(false);
    };


    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
            <Toolbar
                mode={mode}
                setMode={setMode}
                onUpload={() => board.fileInputRef.current?.click()}
                onOpenSettings={() => hardware.setConfigOpen(true)}
                onOpenPointsTable={() => setPointsTableOpen(true)}
                onNewProject={() => setNewProjectModalOpen(true)}
                onOpenProject={handleOpenProject}
                onSaveProject={saveProject}
                onExportPdf={() => { /* Logic to be added */ }}
                onStartSequence={startSequence}
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
                onLoadProject={(p: Project) => {
                    loadProject(p);
                    setProjectManagerOpen(false);
                }}
                onDeleteProject={deleteProject}
                onUpdateProject={updateProject}
            />

            <ComparisonModal 
                isOpen={isComparisonModalOpen}
                onClose={() => setComparisonModalOpen(false)}
                currentPoint={board.selectedPoint}
                onImportReference={(pt: any) => {
                    setComparisonPoint(pt);
                    setComparisonModalOpen(false);
                    if (board.selectedPoint && !board.selectedPoint.expected_value && (pt.expected_value || pt.measurements?.[pt.type]?.value)) {
                        const val = pt.expected_value || pt.measurements?.[pt.type]?.value;
                        const valStr = typeof val === 'object' ? 'Scope Data' : String(val);
                        board.setPoints(board.points.map(p => p.id === board.selectedPoint?.id ? { ...p, expected_value: valStr, tolerance: pt.tolerance || 10 } : p));
                    }
                }}
            />

            <NewProjectModal
                isOpen={isNewProjectModalOpen}
                onClose={() => setNewProjectModalOpen(false)}
                onCreate={handleCreateProjectAndClose}
            />

            <div className="flex-1 flex flex-col relative">
                <SequencerPanel />
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
                onOpenComparison={() => setComparisonModalOpen(true)}
                comparisonPoint={comparisonPoint}
            />

            {/* Modals that don't need project data can stay as they are */}
            {hardware.configOpen && (
                <Settings
                    instruments={hardware.instrumentConfig}
                    apiKey={apiKey}
                    setApiKey={setApiKey}
                    appSettings={appSettings}
                    onSave={(newConfig: InstrumentConfig, newApiKey: string, newAppSettings: AppSettings) => {
                        hardware.handleSaveConfig(newConfig);
                        if(window.electronAPI) {
                            window.electronAPI.saveApiKey(newApiKey);
                            window.electronAPI.saveConfig({ ...newConfig, appSettings: newAppSettings });
                        }
                        setApiKey(newApiKey);
                        setAppSettings(newAppSettings);
                    }}
                    onClose={() => hardware.setConfigOpen(false)}
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
