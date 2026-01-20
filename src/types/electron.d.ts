/**
 * Electron API Type Definitions
 * 
 * This file centralizes all Electron IPC API type declarations.
 * Import this in files that need to access window.electronAPI
 */

import type {
    Project,
    Point,
    Instrument,
    CreateProjectData,
    MeasurementValue,
    MeasurementHistoryItem,
    CaptureResult,
    PersistedConfig
} from '../types';

/**
 * External trigger data from hardware (e.g., monitor mode)
 */
export interface ExternalTriggerData {
    type: string;
    value?: string | number;
    timestamp?: string;
}

/**
 * Generic status response from IPC calls
 */
export interface StatusResponse {
    status: string;
    message?: string;
}

/**
 * Export response with file path
 */
export interface ExportStatusResponse extends StatusResponse {
    filePath?: string;
}

/**
 * ID response from creation operations
 */
export interface IdResponse {
    id: number;
}

/**
 * The complete Electron API interface exposed via preload
 */
export interface ElectronAPI {
    // --- Project Operations ---
    createProject: (data: CreateProjectData) => Promise<Project>;
    getProjects: () => Promise<Project[]>;
    getProjectWithImage: (id: number) => Promise<Project>;
    deleteProject: (id: number) => Promise<StatusResponse>;
    updateProject: (data: Partial<Project>) => Promise<StatusResponse>;
    searchProjectsByPoint: (searchTerm: string) => Promise<number[]>;

    // --- Point Operations ---
    savePoints: (data: { projectId: number; points: Point[] }) => Promise<Point[]>;
    getPoints: (projectId: number) => Promise<Point[]>;
    deletePoint: (id: number | string) => Promise<StatusResponse>;
    createMeasurement: (data: {
        pointId: number | string;
        type: string;
        value: string | number | MeasurementValue;
    }) => Promise<IdResponse & StatusResponse>;
    getMeasurementHistory: (pointId: number | string) => Promise<MeasurementHistoryItem[]>;

    // --- Monitor Mode ---
    startMonitor: (ip: string, port: number) => Promise<StatusResponse>;
    stopMonitor: () => Promise<StatusResponse>;
    onMonitorStatus: (callback: (status: string) => void) => () => void;
    onExternalTrigger: (callback: (data: ExternalTriggerData) => void) => () => void;

    // --- Board Types ---
    getBoardTypes: () => Promise<string[]>;
    addBoardType: (type: string) => Promise<boolean>;

    // --- Export Operations ---
    exportPdf: (projectId: number) => Promise<ExportStatusResponse>;
    exportImage: (projectId: number) => Promise<ExportStatusResponse>;

    // --- Instrument Operations ---
    getAllInstruments: () => Promise<Instrument[]>;
    saveInstrument: (data: Instrument) => Promise<IdResponse>;
    deleteInstrument: (id: number) => Promise<StatusResponse>;
    instrumentExecute: (
        type: 'multimeter' | 'oscilloscope',
        actionKey: string
    ) => Promise<CaptureResult>;
    instrumentTestConnection: (config: Instrument) => Promise<StatusResponse>;
    /**
     * @deprecated Legacy oscilloscope measurement - use instrumentExecute('oscilloscope', actionKey) instead
     */
    measureScope: (config: { ip: string; port: number; timeout?: number }) => Promise<CaptureResult>;

    // --- Config & Settings ---
    loadConfig: () => Promise<PersistedConfig>;
    saveConfig: (config: PersistedConfig) => Promise<void>;
    loadApiKey: () => Promise<string>;
    saveApiKey: (key: string) => Promise<void>;
    getAllAttributes: (boardType?: string) => Promise<{ keys: string[]; values: string[] }>;

    // --- Serial Ports ---
    getSerialPorts: () => Promise<{ path: string; manufacturer?: string }[]>;

    // --- Utility ---
    isElectron?: boolean;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export { };
