import { useState, useCallback } from 'react';
import { Logger } from '../../utils/logger';
import { projectImagesToURLs } from '../../utils/bufferUtils';
import type { Project, Point, CreateProjectData } from '../../types';

const log = Logger.Project;

interface BoardActions {
    setImage: (url: string | null, urlB?: string | null) => void;
    setPoints: (points: Point[] | ((prev: Point[]) => Point[])) => void;
    resetBoard: () => void;
    points: Point[];
}

interface UseProjectOperationsOptions {
    board: BoardActions;
    showNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export function useProjectOperations({ board, showNotification }: UseProjectOperationsOptions) {
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [projectList, setProjectList] = useState<Project[]>([]);

    const createProject = useCallback(async (projectData: CreateProjectData) => {
        if (!projectData || !window.electronAPI) return;
        try {
            const newProject = await window.electronAPI.createProject(projectData);
            log.info('Project created', { id: newProject.id, model: newProject.board_model });
            setCurrentProject(newProject);

            const { imageUrl, imageUrlB } = projectImagesToURLs(
                newProject.image_data,
                newProject.image_data_b
            );

            if (!imageUrlB) {
                log.debug('No Image B found in new project');
            }

            board.setImage(imageUrl, imageUrlB);
            board.setPoints([]);

            showNotification(`Project '${projectData.board_model}' created!`, 'success');
        } catch (error) {
            log.error('Error creating project', error);
            showNotification("Failed to create project.", 'error');
        }
    }, [board, showNotification]);

    const saveProject = useCallback(async (pointsToSave?: Point[] | React.MouseEvent): Promise<Point[] | undefined> => {
        const validPointsToSave = Array.isArray(pointsToSave) ? pointsToSave : undefined;

        if (!currentProject) {
            showNotification("No active project to save. Create one first.", 'warning');
            return;
        }
        if (!window.electronAPI) return;
        try {
            const pointsPayload = JSON.parse(JSON.stringify(validPointsToSave || board.points));

            const savedPoints = await window.electronAPI.savePoints({
                projectId: currentProject.id,
                points: pointsPayload
            });
            board.setPoints(savedPoints);
            showNotification('Project saved successfully!', 'success');
            return savedPoints;
        } catch (error) {
            log.error('Error saving project', error);
            showNotification("Failed to save project.", 'error');
        }
    }, [currentProject, board, showNotification]);

    const fetchProjectList = useCallback(async () => {
        if (!window.electronAPI) return;
        try {
            const projects = await window.electronAPI.getProjects();
            setProjectList(projects || []);
            return projects;
        } catch (error) {
            log.error('Error fetching projects', error);
            showNotification("Failed to fetch projects.", 'error');
        }
    }, [showNotification]);

    const loadProject = useCallback(async (project: Project) => {
        if (!project || !window.electronAPI) return;
        try {
            const fullProject = await window.electronAPI.getProjectWithImage(project.id);
            const points = await window.electronAPI.getPoints(project.id);

            setCurrentProject(fullProject);

            if (fullProject.image_data) {
                const { imageUrl, imageUrlB } = projectImagesToURLs(
                    fullProject.image_data,
                    fullProject.image_data_b
                );
                board.setImage(imageUrl, imageUrlB);
            } else {
                board.resetBoard();
            }

            board.setPoints(points);
            showNotification(`Project '${fullProject.board_model}' loaded!`, 'success');
        } catch (error) {
            log.error('Error loading project', error);
            showNotification("Failed to load project.", 'error');
        }
    }, [board, showNotification]);

    const deleteProject = useCallback(async (projectId: number) => {
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
            log.error('Error deleting project', error);
            showNotification('Error deleting project.', 'error');
        }
    }, [currentProject, board, showNotification]);

    const updateProject = useCallback(async (updatedProjectData: Partial<Project>) => {
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
            log.error('Error updating project', error);
            showNotification('Error updating project.', 'error');
        }
    }, [currentProject, showNotification]);

    return {
        currentProject,
        projectList,
        createProject,
        saveProject,
        fetchProjectList,
        loadProject,
        deleteProject,
        updateProject
    };
}
