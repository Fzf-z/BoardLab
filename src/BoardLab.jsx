import React, { useState, useEffect } from 'react';

import { useBoard } from './hooks/useBoard';
import { useGemini } from './hooks/useGemini';
import { useHardware } from './hooks/useHardware';

import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import BoardView from './components/BoardView';
import AIPanel from './components/AIPanel';
import Settings from './components/Settings';
import { useNotifier } from './contexts/NotifierContext';
import PointsTableModal from './components/modals/PointsTableModal';
import ProjectManagerModal from './components/modals/ProjectManagerModal';
import AIModal from './components/modals/AIModal';
import NewProjectModal from './components/modals/NewProjectModal';

const BoardLab = () => {
    const [mode, setMode] = useState('view'); // 'view' or 'measure'
    const [apiKey, setApiKey] = useState('');
    const [pointsTableOpen, setPointsTableOpen] = useState(false);
    const [currentProject, setCurrentProject] = useState(null);
    const [isProjectManagerOpen, setProjectManagerOpen] = useState(false);
    const [isNewProjectModalOpen, setNewProjectModalOpen] = useState(false);
    const [projectList, setProjectList] = useState([]);
    const [autoSave, setAutoSave] = useState(false);
    const [knownAttributes, setKnownAttributes] = useState({ keys: [], values: [] });

    const board = useBoard();
    const hardware = useHardware();
    const gemini = useGemini(apiKey);
    const { showNotification } = useNotifier();

    useEffect(() => {
        if (hardware.isElectron) {
            window.electronAPI.loadApiKey().then(key => {
                if (key) setApiKey(key);
            });
            window.electronAPI.loadConfig().then(config => {
                if (config && config.appSettings) {
                    setAutoSave(config.appSettings.autoSave || false);
                }
            });
            // Cargar atributos para autocompletado
            window.electronAPI.getAllAttributes().then(attrs => {
                setKnownAttributes(attrs);
            });
        }
    }, [hardware.isElectron]);

    // Auto-save when a new temporary point is added
    useEffect(() => {
        const hasTempPoint = board.points.some(p => typeof p.id === 'string' && p.id.startsWith('temp-'));
        if (hasTempPoint && autoSave && currentProject) {
            console.log("Auto-saving due to new point creation...");
            handleSaveProject();
        }
    }, [board.points, autoSave, currentProject]);

    const handleSave = (newInstrumentConfig, newApiKey, newAutoSave) => {
        const fullConfig = {
            ...hardware.instrumentConfig, // Keep existing instrument settings
            ...newInstrumentConfig,
            appSettings: { autoSave: newAutoSave }
        };
        hardware.handleSaveConfig(fullConfig);
        setApiKey(newApiKey);
        setAutoSave(newAutoSave);

        if (hardware.isElectron) {
            window.electronAPI.saveApiKey(newApiKey);
            window.electronAPI.saveConfig(fullConfig); // Save the full config
        }
        showNotification('Settings saved successfully!', 'success');
    };

    const handlePointsSave = (newPoints) => {
        board.setPoints(newPoints);
    };

    const handleNewProject = () => {
        setNewProjectModalOpen(true);
    };

    const handleCreateProject = async (projectData) => {
        if (projectData && window.electronAPI) {
            try {
                const newProject = await window.electronAPI.createProject(projectData);
                setCurrentProject(newProject);
                
                // Convert Uint8Array to Blob URL to display the image
                const blob = new Blob([projectData.image_data], { type: 'image/png' }); // Adjust type if necessary
                const imageUrl = URL.createObjectURL(blob);
                board.setImage(imageUrl);
                board.setPoints([]); // Clear points for the new project

                showNotification(`Project '${projectData.board_model}' created!`, 'success');
            } catch (error) {
                console.error("Error creating project:", error);
                showNotification("Failed to create project.", 'error');
            }
        }
    };

    const handleSaveProject = async () => {
        if (!currentProject) {
            showNotification("No active project to save. Create one first.", 'warning');
            return; // Devuelve undefined si no hay proyecto
        }
        if (!window.electronAPI) return; // Devuelve undefined si no es electron

        try {
            const savedPoints = await window.electronAPI.savePoints({
                projectId: currentProject.id,
                points: board.points
            });
            
            board.setPoints(savedPoints);
            showNotification('Project saved successfully!', 'success');
            return savedPoints; // <-- Devolver los puntos guardados
        } catch (error) {
            console.error("Error saving project:", error);
            showNotification("Failed to save project.", 'error');
            return; // Devuelve undefined en caso de error
        }
    };

    const handleOpenProject = async () => {
        if (!window.electronAPI) return;
        try {
            const projects = await window.electronAPI.getProjects();
            setProjectList(projects || []);
            setProjectManagerOpen(true);
        } catch (error) {
            console.error("Error fetching projects:", error);
            showNotification("Failed to fetch projects.", 'error');
        }
    };

    const handleLoadProject = async (project) => {
        if (!project || !window.electronAPI) return;
        try {
            // Fetch the full project data including the image
            const fullProject = await window.electronAPI.getProjectWithImage(project.id);
            const points = await window.electronAPI.getPoints(project.id);
            
            setCurrentProject(fullProject);

            if (fullProject.image_data) {
                // Correctly create the Blob directly from the Uint8Array
                const blob = new Blob([fullProject.image_data], { type: 'image/png' });
                const imageUrl = URL.createObjectURL(blob);
                board.setImage(imageUrl);
            } else {
                board.resetBoard();
            }
            
            board.setPoints(points);
            setProjectManagerOpen(false);
            showNotification(`Project '${fullProject.board_model}' loaded!`, 'success');
        } catch (error) {
            console.error("Error loading project:", error);
            showNotification("Failed to load project.", 'error');
        }
    };

    const handleDeleteProject = async (projectId) => {
        if (!projectId || !window.electronAPI) return;

        const confirmDelete = window.confirm('Are you sure you want to delete this project? This action cannot be undone.');
        if (!confirmDelete) return;

        try {
            const result = await window.electronAPI.deleteProject(projectId);
            if (result && result.status === 'success') {
                setProjectList(prev => prev.filter(p => p.id !== projectId));
                // If the deleted project is currently loaded, clear it
                if (currentProject && currentProject.id === projectId) {
                    setCurrentProject(null);
                    board.resetBoard();
                }
                showNotification('Project deleted successfully.', 'success');
            } else {
                console.error('Failed to delete project:', result);
                showNotification(`Failed to delete project: ${result?.message || 'unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            showNotification('Error deleting project.', 'error');
        }
    };

    const handleDeletePoint = async (pointIdToDelete) => {
        if (!window.electronAPI) return;

        // Si es un punto temporal, solo borrarlo del estado local
        if (typeof pointIdToDelete === 'string' && pointIdToDelete.startsWith('temp-')) {
            board.setPoints(prevPoints => prevPoints.filter(p => p.id !== pointIdToDelete));
            showNotification('Temporary point removed.', 'success');
            if (board.selectedPointId === pointIdToDelete) {
                board.setSelectedPointId(null);
            }
            return;
        }

        // Si es un punto guardado, confirmar y borrar de la DB
        if (!window.confirm('Are you sure you want to delete this point and its history?')) return;

        try {
            const result = await window.electronAPI.deletePoint(pointIdToDelete);
            if (result.status === 'success') {
                board.setPoints(prevPoints => prevPoints.filter(p => p.id !== pointIdToDelete));
                showNotification('Point deleted successfully.', 'success');
                if (board.selectedPointId === pointIdToDelete) {
                    board.setSelectedPointId(null);
                }
            } else {
                showNotification(`Failed to delete point: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting point:', error);
            showNotification('An error occurred while deleting the point.', 'error');
        }
    };

    const handleExportPdf = async () => {
        if (!currentProject) {
            showNotification("Please save the project before exporting.", 'warning');
            return;
        }
        if (!window.electronAPI) return;

        const result = await window.electronAPI.exportPdf(currentProject.id);
        if (result.status === 'success') {
            showNotification(`Report saved to ${result.filePath}`, 'success');
        } else if (result.status === 'cancelled') {
            showNotification('Export cancelled.', 'info');
        } else {
            showNotification(`Error exporting PDF: ${result.message}`, 'error');
        }
    };


    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
            <Toolbar
                mode={mode}
                setMode={setMode}
                onUpload={() => board.fileInputRef.current.click()}
                onOpenSettings={() => hardware.setConfigOpen(true)}
                onOpenPointsTable={() => setPointsTableOpen(true)}
                onNewProject={handleNewProject}
                onOpenProject={handleOpenProject}
                onSaveProject={handleSaveProject}
                onExportPdf={handleExportPdf}
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
                onLoadProject={handleLoadProject}
                onDeleteProject={handleDeleteProject}
            />

            <NewProjectModal
                isOpen={isNewProjectModalOpen}
                onClose={() => setNewProjectModalOpen(false)}
                onCreate={handleCreateProject}
                knownAttributes={knownAttributes}
            />

            <div className="flex-1 flex flex-col relative">
                <StatusBar
                    scale={board.scale}
                    setScale={board.setScale}
                    isElectron={hardware.isElectron}
                />
                <BoardView
                    {...board}
                    mode={mode}
                    currentProjectId={currentProject?.id}
                />
            </div>

            <AIPanel
                selectedPoint={board.selectedPoint}
                points={board.points}
                setPoints={board.setPoints}
                setSelectedPointId={board.setSelectedPointId}
                askAboutPoint={gemini.askAboutPoint}
                captureValue={hardware.captureValue}
                isCapturing={hardware.isCapturing}
                analyzeBoard={gemini.analyzeBoard}
                instrumentConfig={hardware.instrumentConfig}
                autoSave={autoSave}
                handleSaveProject={handleSaveProject}
                onDeletePoint={handleDeletePoint}
            />

            {/* Modals */}
            {hardware.configOpen && (
                <Settings
                    instruments={hardware.instrumentConfig}
                    apiKey={apiKey}
                    setApiKey={setApiKey}
                    autoSave={autoSave}
                    onAutoSaveChange={setAutoSave}
                    onSave={handleSave}
                    onClose={() => hardware.setConfigOpen(false)}
                />
            )}

            {pointsTableOpen && (
                <PointsTableModal
                    points={board.points}
                    onSave={handlePointsSave}
                    onClose={() => setPointsTableOpen(false)}
                    selectedPointId={board.selectedPointId}
                    onSelectPoint={board.setSelectedPointId}
                    onDeletePoint={handleDeletePoint}
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
