import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useBoard } from '../hooks/useBoard';
import { useNotifier } from './NotifierContext';
import { Project, Point, MeasurementValue, AppSettings } from '../types';

// Extend global window interface for Electron API
declare global {
    interface Window {
        electronAPI?: {
            createProject: (data: any) => Promise<Project>;
            savePoints: (data: { projectId: number, points: Point[] }) => Promise<Point[]>;
            getProjects: () => Promise<Project[]>;
            getProjectWithImage: (id: number) => Promise<Project>;
            getPoints: (projectId: number) => Promise<Point[]>;
            deleteProject: (id: number) => Promise<{ status: string; message?: string }>;
            updateProject: (data: Partial<Project>) => Promise<{ status: string; message?: string }>;
            deletePoint: (id: number | string) => Promise<{ status: string; message?: string }>;
            createMeasurement: (data: { pointId: number | string, type: string, value: any }) => Promise<{ id?: number; status: string; message?: string }>;
            [key: string]: any;
        };
    }
}

interface ProjectContextValue {
    currentProject: Project | null;
    points: Point[];
    projectList: Project[];
    appSettings: AppSettings;
    setAppSettings: (settings: AppSettings) => void;
    createProject: (data: any) => Promise<void>;
    saveProject: (pointsToSave?: Point[]) => Promise<Point[] | undefined>;
    loadProject: (project: Project) => Promise<void>;
    deleteProject: (id: number) => Promise<void>;
    updateProject: (data: Partial<Project>) => Promise<void>;
    deletePoint: (id: number | string) => Promise<void>;
    addMeasurement: (point: Point, measurementData: MeasurementValue) => Promise<MeasurementValue | null>;
    fetchProjectList: () => Promise<Project[] | undefined>;
    board: ReturnType<typeof useBoard>;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error("useProject must be used within a ProjectProvider");
    }
    return context;
};

interface ProjectProviderProps {
    children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [projectList, setProjectList] = useState<Project[]>([]);
    const [appSettings, setAppSettings] = useState<AppSettings>({
        autoSave: false,
        pointSize: 24,
        pointColor: '#4b5563',
        categories: [
            { id: 'power', label: 'Power', color: '#ef4444' },
            { id: 'ground', label: 'Ground', color: '#1f2937' },
            { id: 'signal', label: 'Signal', color: '#3b82f6' },
            { id: 'clock', label: 'Clock', color: '#10b981' },
            { id: 'data', label: 'Data', color: '#8b5cf6' },
            { id: 'component', label: 'Comp', color: '#f59e0b' },
        ]
    });
    const board = useBoard();
    const { showNotification } = useNotifier();

    // --- Undo/Redo ---
    const { undo, redo, canUndo, canRedo } = board;

    // Auto-save when a new temporary point is added
    useEffect(() => {
        const hasTempPoint = board.points.some(p => typeof p.id === 'string' && p.id.startsWith('temp-'));
        if (hasTempPoint && appSettings.autoSave && currentProject) {
            handleSaveProject();
        }
    }, [board.points, appSettings.autoSave, currentProject]);

    // --- Project Data Logic ---
    
    const handleCreateProject = async (projectData: any) => {
        if (!projectData || !window.electronAPI) return;
        try {
            const newProject = await window.electronAPI.createProject(projectData);
            setCurrentProject(newProject);
            
            // Assuming image_data comes as buffer/array
            const blob = new Blob([newProject.image_data as any], { type: 'image/png' });
            const imageUrl = URL.createObjectURL(blob);
            board.setImage(imageUrl);
            board.setPoints([]);

            showNotification(`Project '${projectData.board_model}' created!`, 'success');
        } catch (error) {
            console.error("Error creating project:", error);
            showNotification("Failed to create project.", 'error');
        }
    };

    const handleSaveProject = async (pointsToSave?: Point[]) => {
        if (!currentProject) {
            showNotification("No active project to save. Create one first.", 'warning');
            return;
        }
        if (!window.electronAPI) return;
        try {
            // Deep clone/sanitize points to avoid "object could not be cloned" errors with IPC
            const pointsPayload = JSON.parse(JSON.stringify(pointsToSave || board.points));
            
            const savedPoints = await window.electronAPI.savePoints({
                projectId: currentProject.id,
                points: pointsPayload
            });
            board.setPoints(savedPoints);
            showNotification('Project saved successfully!', 'success');
            return savedPoints;
        } catch (error) {
            console.error("Error saving project:", error);
            showNotification("Failed to save project.", 'error');
        }
    };

    const handleFetchProjectList = async () => {
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
    
    const handleLoadProject = async (project: Project) => {
        if (!project || !window.electronAPI) return;
        try {
            const fullProject = await window.electronAPI.getProjectWithImage(project.id);
            const points = await window.electronAPI.getPoints(project.id);
            
            setCurrentProject(fullProject);

            if (fullProject.image_data) {
                const blob = new Blob([fullProject.image_data as any], { type: 'image/png' });
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

    const handleDeleteProject = async (projectId: number) => {
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

    const handleUpdateProject = async (updatedProjectData: Partial<Project>) => {
        if (!window.electronAPI) return;
        if (!updatedProjectData.id) return;

        try {
            const result = await window.electronAPI.updateProject(updatedProjectData);
            if (result && result.status === 'success') {
                setProjectList(prev => prev.map(p => p.id === updatedProjectData.id ? { ...p, ...updatedProjectData } as Project : p));
                if (currentProject && currentProject.id === updatedProjectData.id) {
                    setCurrentProject(prev => prev ? ({ ...prev, ...updatedProjectData }) as Project : null);
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

    const handleDeletePoint = async (pointIdToDelete: number | string) => {
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

    const handleAddMeasurement = async (point: Point, measurementData: MeasurementValue) => {
        if (!point || !measurementData) return null;

        let targetPoint = point;

        if (typeof targetPoint.id === 'string' && targetPoint.id.startsWith('temp-')) {
            const savedPoints = await handleSaveProject(); 
            
            if (savedPoints) {
                const newlySavedPoint = savedPoints.find(p => p.temp_id === targetPoint.id);
                
                if (newlySavedPoint) {
                    targetPoint = newlySavedPoint;
                    if (board.selectedPointId === point.id) {
                        board.setSelectedPointId(targetPoint.id);
                    }
                } else {
                    showNotification("Error: Could not save point before measuring.", 'error');
                    return null;
                }
            } else {
                 return null;
            }
        }

        board.setPoints(prevPoints => prevPoints.map(p => {
            if (p.id === targetPoint.id) {
                const type = measurementData.type || 'unknown';
                const newMeasurements = { 
                    ...p.measurements, 
                    [type]: { ...measurementData, capturedAt: new Date().toISOString() } 
                };
                return { ...p, measurements: newMeasurements };
            }
            return p;
        }));

        if (!window.electronAPI) return measurementData;

        try {
            const valueToSave = measurementData.type === 'oscilloscope' ? measurementData : measurementData.value;
            const result = await window.electronAPI.createMeasurement({
                pointId: targetPoint.id,
                type: targetPoint.type,
                value: valueToSave,
            });

            if (result.id) {
                showNotification('Measurement saved.', 'success');
                return { ...measurementData, capturedAt: new Date().toISOString() };
            } else {
                showNotification(`Failed to save measurement: ${result.message}`, 'error');
                return null;
            }
        } catch (error) {
            console.error('Error adding measurement:', error);
            showNotification('Error saving measurement.', 'error');
            return null;
        }
    };

    return (
        <ProjectContext.Provider value={{
            currentProject,
            points: board.points,
            projectList,
            appSettings,
            setAppSettings,
            createProject: handleCreateProject,
            saveProject: handleSaveProject,
            loadProject: handleLoadProject,
            deleteProject: handleDeleteProject,
            updateProject: handleUpdateProject,
            deletePoint: handleDeletePoint,
            addMeasurement: handleAddMeasurement,
            fetchProjectList: handleFetchProjectList,
            board,
            undo,
            redo,
            canUndo,
            canRedo,
        }}>
            {children}
        </ProjectContext.Provider>
    );
};
