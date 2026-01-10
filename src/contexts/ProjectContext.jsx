import React, { createContext, useContext, useState, useEffect } from 'react';
import { useBoard } from '../hooks/useBoard';
import { useNotifier } from './NotifierContext';

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children }) => {
    const [currentProject, setCurrentProject] = useState(null);
    const [projectList, setProjectList] = useState([]);
    const [autoSave, setAutoSave] = useState(false); // We can move this here too
    const board = useBoard();
    const { showNotification } = useNotifier();

    // Auto-save when a new temporary point is added
    useEffect(() => {
        const hasTempPoint = board.points.some(p => typeof p.id === 'string' && p.id.startsWith('temp-'));
        if (hasTempPoint && autoSave && currentProject) {
            handleSaveProject();
        }
    }, [board.points, autoSave, currentProject]);

    // --- Project Data Logic ---
    
    const handleCreateProject = async (projectData) => {
        if (!projectData || !window.electronAPI) return;
        try {
            const newProject = await window.electronAPI.createProject(projectData);
            setCurrentProject(newProject);
            
            const blob = new Blob([projectData.image_data], { type: 'image/png' });
            const imageUrl = URL.createObjectURL(blob);
            board.setImage(imageUrl);
            board.setPoints([]);

            showNotification(`Project '${projectData.board_model}' created!`, 'success');
        } catch (error) {
            console.error("Error creating project:", error);
            showNotification("Failed to create project.", 'error');
        }
    };

    const handleSaveProject = async () => {
        if (!currentProject) {
            showNotification("No active project to save. Create one first.", 'warning');
            return;
        }
        if (!window.electronAPI) return;
        try {
            const savedPoints = await window.electronAPI.savePoints({
                projectId: currentProject.id,
                points: board.points
            });
            board.setPoints(savedPoints);
            showNotification('Project saved successfully!', 'success');
            return savedPoints;
        } catch (error) {
            console.error("Error saving project:", error);
            showNotification("Failed to save project.", 'error');
        }
    };

    const fetchProjectList = async () => {
        if (!window.electronAPI) return;
        try {
            const projects = await window.electronAPI.getProjects();
            setProjectList(projects || []);
            return projects;
        } catch (error) {
            console.error("Error fetching projects:", error);
            showNotification("Failed to fetch projects.", 'error');
        }
    };
    
    const handleLoadProject = async (project) => {
        if (!project || !window.electronAPI) return;
        try {
            const fullProject = await window.electronAPI.getProjectWithImage(project.id);
            const points = await window.electronAPI.getPoints(project.id);
            
            setCurrentProject(fullProject);

            if (fullProject.image_data) {
                const blob = new Blob([fullProject.image_data], { type: 'image/png' });
                const imageUrl = URL.createObjectURL(blob);
                board.setImage(imageUrl);
            } else {
                board.resetBoard();
            }
            
            board.setPoints(points);
            showNotification(`Project '${fullProject.board_model}' loaded!`, 'success');
        } catch (error) {
            console.error("Error loading project:", error);
            showNotification("Failed to load project.", 'error');
        }
    };

    const handleDeleteProject = async (projectId) => {
        if (!projectId || !window.electronAPI) return;
        try {
            const result = await window.electronAPI.deleteProject(projectId);
            if (result && result.status === 'success') {
                setProjectList(prev => prev.filter(p => p.id !== projectId));
                if (currentProject && currentProject.id === projectId) {
                    setCurrentProject(null);
                    board.resetBoard();
                }
                showNotification('Project deleted successfully.', 'success');
            } else {
                showNotification(`Failed to delete project: ${result?.message}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            showNotification('Error deleting project.', 'error');
        }
    };

    const handleUpdateProject = async (updatedProjectData) => {
        if (!window.electronAPI) return;
        try {
            const result = await window.electronAPI.updateProject(updatedProjectData);
            if (result && result.status === 'success') {
                setProjectList(prev => prev.map(p => p.id === updatedProjectData.id ? { ...p, ...updatedProjectData } : p));
                if (currentProject && currentProject.id === updatedProjectData.id) {
                    setCurrentProject(prev => ({ ...prev, ...updatedProjectData }));
                }
                showNotification('Project updated successfully.', 'success');
            } else {
                showNotification(`Failed to update project: ${result?.message}`, 'error');
            }
        } catch (error) {
            console.error('Error updating project:', error);
            showNotification('Error updating project.', 'error');
        }
    };

    const handleDeletePoint = async (pointIdToDelete) => {
        if (typeof pointIdToDelete === 'string' && pointIdToDelete.startsWith('temp-')) {
            board.setPoints(prevPoints => prevPoints.filter(p => p.id !== pointIdToDelete));
            showNotification('Temporary point removed.', 'success');
            if (board.selectedPointId === pointIdToDelete) {
                board.setSelectedPointId(null);
            }
            return;
        }

        if (!window.electronAPI) return;
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

    const value = {
        currentProject,
        points: board.points,
        projectList,
        autoSave,
        setAutoSave,
        
        // Functions
        createProject: handleCreateProject,
        saveProject: handleSaveProject,
        loadProject: handleLoadProject,
        deleteProject: handleDeleteProject,
        updateProject: handleUpdateProject,
        deletePoint: handleDeletePoint,
        fetchProjectList,
        
        // Board hook is also part of project state
        board,
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
};
