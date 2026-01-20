import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useBoard } from '../hooks/useBoard';
import { useNotifier } from './NotifierContext';
import { useSequencer, useBoardTypes, useProjectOperations, usePointOperations } from './project';
import type { Project, Point, MeasurementValue, AppSettings, CreateProjectData } from '../types';
import type { ExternalTriggerData } from '../types/electron';

// Re-export for backwards compatibility
export type { ExternalTriggerData };

interface ProjectContextValue {
    currentProject: Project | null;
    points: Point[];
    projectList: Project[];
    appSettings: AppSettings;
    setAppSettings: (settings: AppSettings) => void;
    createProject: (data: CreateProjectData) => Promise<void>;
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
    sequence: {
        active: boolean;
        currentIndex: number;
        order: (number | string)[];
    };
    startSequence: () => void;
    stopSequence: () => void;
    nextInSequence: () => void;
    prevInSequence: () => void;
    boardTypes: string[];
    addBoardType: (type: string) => Promise<void>;
    addPoint: (point: Point) => void;
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

const DEFAULT_CATEGORIES = [
    { id: 'power', label: 'Power', color: '#ef4444' },
    { id: 'ground', label: 'Ground', color: '#1f2937' },
    { id: 'signal', label: 'Signal', color: '#3b82f6' },
    { id: 'clock', label: 'Clock', color: '#10b981' },
    { id: 'data', label: 'Data', color: '#8b5cf6' },
    { id: 'component', label: 'Comp', color: '#f59e0b' },
];

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
    const [appSettings, setAppSettings] = useState<AppSettings>({
        autoSave: false,
        pointSize: 24,
        pointColor: '#4b5563',
        categories: DEFAULT_CATEGORIES
    });

    const board = useBoard();
    const { showNotification } = useNotifier();

    // Specialized hooks
    const { boardTypes, addBoardType } = useBoardTypes();

    const {
        sequence,
        startSequence,
        stopSequence,
        nextInSequence,
        prevInSequence
    } = useSequencer({
        points: board.points,
        selectPoint: board.selectPoint,
        showNotification
    });

    const {
        currentProject,
        projectList,
        createProject,
        saveProject,
        fetchProjectList,
        loadProject,
        deleteProject,
        updateProject
    } = useProjectOperations({
        board,
        showNotification
    });

    const { deletePoint, addMeasurement } = usePointOperations({
        board,
        showNotification,
        saveProject
    });

    // Auto-save when a new temporary point is added
    useEffect(() => {
        const hasTempPoint = board.points.some(p => typeof p.id === 'string' && p.id.startsWith('temp-'));
        if (hasTempPoint && appSettings.autoSave && currentProject) {
            saveProject();
        }
    }, [board.points, appSettings.autoSave, currentProject, saveProject]);

    const { undo, redo, canUndo, canRedo } = board;

    return (
        <ProjectContext.Provider value={{
            currentProject,
            points: board.points,
            projectList,
            appSettings,
            setAppSettings,
            createProject,
            saveProject,
            loadProject,
            deleteProject,
            boardTypes,
            addBoardType,
            updateProject,
            deletePoint,
            addMeasurement,
            fetchProjectList,
            board,
            addPoint: board.addPoint,
            undo,
            redo,
            canUndo,
            canRedo,
            sequence,
            startSequence,
            stopSequence,
            nextInSequence,
            prevInSequence
        }}>
            {children}
        </ProjectContext.Provider>
    );
};
