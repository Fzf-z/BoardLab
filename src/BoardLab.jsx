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

const BoardLab = () => {
    const [mode, setMode] = useState('view'); // 'view' or 'measure'
    const [apiKey, setApiKey] = useState('');
    const [pointsTableOpen, setPointsTableOpen] = useState(false);
    const [currentProject, setCurrentProject] = useState(null);
    const [isProjectManagerOpen, setProjectManagerOpen] = useState(false);
    const [projectList, setProjectList] = useState([]);
    const [autoSave, setAutoSave] = useState(false);

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
        }
    }, [hardware.isElectron]);

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

    const handleNewProject = async () => {
        const projectName = prompt("Enter new project name:", "New Project");
        if (projectName && window.electronAPI) {
            try {
                const newProject = await window.electronAPI.createProject(projectName);
                setCurrentProject(newProject);
                board.resetBoard(); // Clear image and points for the new project
                showNotification(`Project '${projectName}' created!`, 'success');
            } catch (error) {
                console.error("Error creating project:", error);
                showNotification("Failed to create project.", 'error');
            }
        }
    };

    const handleSaveProject = async () => {
        if (!currentProject) {
            showNotification("No active project to save. Create one first.", 'warning');
            return;
        }
        if (!window.electronAPI) return;

        try {
            // Save the points associated with the current project
            await window.electronAPI.savePoints({
                projectId: currentProject.id,
                points: board.points
            });
            showNotification('Project saved successfully!', 'success');
        } catch (error) {
            console.error("Error saving project:", error);
            showNotification("Failed to save project.", 'error');
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
            const points = await window.electronAPI.getPoints(project.id);
            setCurrentProject(project);
            // Assuming image_path is stored. For now, we reset.
            // A more complete implementation would save/load the image path.
            board.resetBoard(); 
            board.setPoints(points);
            setProjectManagerOpen(false);
            showNotification(`Project '${project.name}' loaded!`, 'success');
        } catch (error) {
            console.error("Error loading project:", error);
            showNotification("Failed to load project.", 'error');
        }
    };

    const handleDeleteProject = async (projectId) => {
        // Note: 'db:delete-project' IPC handler would need to be implemented in main.js
        showNotification("Delete functionality not yet implemented.", 'info');
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

            <div className="flex-1 flex flex-col relative">
                <StatusBar
                    scale={board.scale}
                    setScale={board.setScale}
                    isElectron={hardware.isElectron}
                />
                <BoardView
                    {...board}
                    mode={mode}
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
