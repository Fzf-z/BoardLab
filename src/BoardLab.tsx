import React, { useState, useEffect } from 'react';
import { useProject } from './contexts/ProjectContext';
import { useNotifier } from './contexts/NotifierContext';
import { useGemini } from './hooks/useGemini';
import { useHardware } from './hooks/useHardware';
import { InstrumentConfig, Project, AppSettings } from './types';

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
// import PointsTable from './components/PointsTable';

const BoardLab: React.FC = () => {
    // UI State - Stays in this component
    const [mode, setMode] = useState<'view' | 'measure'>('view');
    const [isProjectManagerOpen, setProjectManagerOpen] = useState<boolean>(false);
    const [isNewProjectModalOpen, setNewProjectModalOpen] = useState<boolean>(false);
    const [isComparisonModalOpen, setComparisonModalOpen] = useState<boolean>(false);
    // const [isPointsTableOpen, setPointsTableOpen] = useState<boolean>(false);
    const [comparisonPoint, setComparisonPoint] = useState<any>(null);
    const { showNotification } = useNotifier();

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
            if (key === ' ') { e.preventDefault(); setMode('view'); } // Space for Pan/View

            // Measurement Type Shortcuts (Only works when a point is selected or creating one)
            if (board.selectedPoint) {
                if (key === 'V') board.updatePoint(board.selectedPoint.id, { type: 'voltage' });
                if (key === 'R') board.updatePoint(board.selectedPoint.id, { type: 'resistance' });
                if (key === 'D') board.updatePoint(board.selectedPoint.id, { type: 'diode' });
                if (key === 'G') board.updatePoint(board.selectedPoint.id, { type: 'ground' });
                if (key === 'O') board.updatePoint(board.selectedPoint.id, { type: 'oscilloscope' });
            }

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

    const handleExportPdf = async () => {
        if (!currentProject) {
            showNotification('No project open to export', 'warning');
            return;
        }

        if (hardware.isElectron && window.electronAPI) {
            try {
                showNotification('Generating PDF...', 'info');
                const result = await window.electronAPI.exportPdf(currentProject.id);
                if (result.status === 'success') {
                    showNotification(`Report saved to ${result.filePath}`, 'success');
                } else if (result.status === 'cancelled') {
                   // User cancelled
                } else {
                    showNotification(`Export failed: ${result.message}`, 'error');
                }
            } catch (error: any) {
                showNotification(`Export error: ${error.message}`, 'error');
            }
        } else {
            showNotification('PDF Export is only available in Desktop App', 'warning');
        }
    };

    const handleExportImage = async () => {
        if (!currentProject) {
            showNotification('No project open to export', 'warning');
            return;
        }

        if (hardware.isElectron && window.electronAPI) {
            try {
                showNotification('Generating High-Res Image...', 'info');
                const result = await window.electronAPI.exportImage(currentProject.id);
                if (result.status === 'success') {
                    showNotification(`Image saved to ${result.filePath}`, 'success');
                } else if (result.status === 'cancelled') {
                   // User cancelled
                } else {
                    showNotification(`Export failed: ${result.message}`, 'error');
                }
            } catch (error: any) {
                showNotification(`Export error: ${error.message}`, 'error');
            }
        } else {
            showNotification('Image Export is only available in Desktop App', 'warning');
        }
    };


    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
            <Toolbar
                mode={mode}
                setMode={setMode}
                onOpenSettings={() => hardware.setConfigOpen(true)}
                // onOpenPointsTable={() => setPointsTableOpen(true)}
                onNewProject={() => setNewProjectModalOpen(true)}
                onOpenProject={handleOpenProject}
                onSaveProject={saveProject}
                onExportPdf={handleExportPdf}
                onExportImage={handleExportImage}
                onStartSequence={startSequence}
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
                currentPoint={board.selectedPoint || null}
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
                    projectName={currentProject?.board_model}
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
                mode={mode}
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



            {/* Points Table removed */}

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
