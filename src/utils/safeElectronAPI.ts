/**
 * Safe Electron API Wrapper
 *
 * This module provides a validated wrapper around window.electronAPI calls.
 * All responses are validated using Zod schemas to ensure type safety
 * and protect against malformed data from the main process.
 */

import {
    validateIpcResponse,
    validateIpcWithFallback,
    ProjectSchema,
    ProjectListSchema,
    PointListSchema,
    StatusResponseSchema,
    IdResponseSchema,
    InstrumentListSchema,
    CaptureResultSchema,
    ExportResponseSchema,
    MeasurementHistorySchema,
    PersistedConfigSchema,
    AttributesResponseSchema,
    BoardTypesSchema,
} from './ipcValidation';
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

// Type for status response
interface StatusResponse {
    status: string;
    message?: string;
}

// Type for ID response
interface IdResponse {
    id: number;
}

/**
 * Checks if we're running in Electron environment
 */
export function isElectronEnvironment(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI;
}

/**
 * Safe wrapper for project operations
 */
export const safeProjectAPI = {
    async createProject(data: CreateProjectData): Promise<Project | null> {
        if (!window.electronAPI?.createProject) return null;
        try {
            const result = await window.electronAPI.createProject(data);
            return validateIpcResponse(result, ProjectSchema, 'createProject');
        } catch (error) {
            console.error('[SafeAPI] createProject error:', error);
            return null;
        }
    },

    async getProjects(): Promise<Project[]> {
        if (!window.electronAPI?.getProjects) return [];
        try {
            const result = await window.electronAPI.getProjects();
            return validateIpcWithFallback(result, ProjectListSchema, [], 'getProjects');
        } catch (error) {
            console.error('[SafeAPI] getProjects error:', error);
            return [];
        }
    },

    async getProjectWithImage(id: number): Promise<Project | null> {
        if (!window.electronAPI?.getProjectWithImage) return null;
        try {
            const result = await window.electronAPI.getProjectWithImage(id);
            return validateIpcResponse(result, ProjectSchema, 'getProjectWithImage');
        } catch (error) {
            console.error('[SafeAPI] getProjectWithImage error:', error);
            return null;
        }
    },

    async deleteProject(id: number): Promise<StatusResponse | null> {
        if (!window.electronAPI?.deleteProject) return null;
        try {
            const result = await window.electronAPI.deleteProject(id);
            return validateIpcResponse(result, StatusResponseSchema, 'deleteProject');
        } catch (error) {
            console.error('[SafeAPI] deleteProject error:', error);
            return null;
        }
    },

    async updateProject(data: Partial<Project>): Promise<StatusResponse | null> {
        if (!window.electronAPI?.updateProject) return null;
        try {
            const result = await window.electronAPI.updateProject(data);
            return validateIpcResponse(result, StatusResponseSchema, 'updateProject');
        } catch (error) {
            console.error('[SafeAPI] updateProject error:', error);
            return null;
        }
    },

    async searchProjectsByPoint(searchTerm: string): Promise<number[]> {
        if (!window.electronAPI?.searchProjectsByPoint) return [];
        try {
            const result = await window.electronAPI.searchProjectsByPoint(searchTerm);
            // Simple array of numbers validation
            if (Array.isArray(result) && result.every(id => typeof id === 'number')) {
                return result;
            }
            console.warn('[SafeAPI] searchProjectsByPoint returned invalid data');
            return [];
        } catch (error) {
            console.error('[SafeAPI] searchProjectsByPoint error:', error);
            return [];
        }
    },
};

/**
 * Safe wrapper for point operations
 */
export const safePointAPI = {
    async getPoints(projectId: number): Promise<Point[]> {
        if (!window.electronAPI?.getPoints) return [];
        try {
            const result = await window.electronAPI.getPoints(projectId);
            return validateIpcWithFallback(result, PointListSchema, [], 'getPoints') as Point[];
        } catch (error) {
            console.error('[SafeAPI] getPoints error:', error);
            return [];
        }
    },

    async savePoints(projectId: number, points: Point[]): Promise<Point[]> {
        if (!window.electronAPI?.savePoints) return [];
        try {
            const result = await window.electronAPI.savePoints({ projectId, points });
            return validateIpcWithFallback(result, PointListSchema, [], 'savePoints') as Point[];
        } catch (error) {
            console.error('[SafeAPI] savePoints error:', error);
            return [];
        }
    },

    async deletePoint(id: number | string): Promise<StatusResponse | null> {
        if (!window.electronAPI?.deletePoint) return null;
        try {
            const result = await window.electronAPI.deletePoint(id);
            return validateIpcResponse(result, StatusResponseSchema, 'deletePoint');
        } catch (error) {
            console.error('[SafeAPI] deletePoint error:', error);
            return null;
        }
    },

    async createMeasurement(data: { pointId: number | string; type: string; value: string | number | MeasurementValue }): Promise<IdResponse | null> {
        if (!window.electronAPI?.createMeasurement) return null;
        try {
            const result = await window.electronAPI.createMeasurement(data);
            // Allow both status response and id response
            if (result && typeof result === 'object' && 'id' in result) {
                return validateIpcResponse(result, IdResponseSchema, 'createMeasurement');
            }
            return null;
        } catch (error) {
            console.error('[SafeAPI] createMeasurement error:', error);
            return null;
        }
    },

    async getMeasurementHistory(pointId: number | string): Promise<MeasurementHistoryItem[]> {
        if (!window.electronAPI?.getMeasurementHistory) return [];
        try {
            const result = await window.electronAPI.getMeasurementHistory(pointId);
            return validateIpcWithFallback(result, MeasurementHistorySchema, [], 'getMeasurementHistory') as MeasurementHistoryItem[];
        } catch (error) {
            console.error('[SafeAPI] getMeasurementHistory error:', error);
            return [];
        }
    },
};

/**
 * Safe wrapper for instrument operations
 */
export const safeInstrumentAPI = {
    async getAllInstruments(): Promise<Instrument[]> {
        if (!window.electronAPI?.getAllInstruments) return [];
        try {
            const result = await window.electronAPI.getAllInstruments();
            return validateIpcWithFallback(result, InstrumentListSchema, [], 'getAllInstruments') as Instrument[];
        } catch (error) {
            console.error('[SafeAPI] getAllInstruments error:', error);
            return [];
        }
    },

    async saveInstrument(data: Instrument): Promise<IdResponse | null> {
        if (!window.electronAPI?.saveInstrument) return null;
        try {
            const result = await window.electronAPI.saveInstrument(data);
            return validateIpcResponse(result, IdResponseSchema, 'saveInstrument');
        } catch (error) {
            console.error('[SafeAPI] saveInstrument error:', error);
            return null;
        }
    },

    async deleteInstrument(id: number): Promise<StatusResponse | null> {
        if (!window.electronAPI?.deleteInstrument) return null;
        try {
            const result = await window.electronAPI.deleteInstrument(id);
            return validateIpcResponse(result, StatusResponseSchema, 'deleteInstrument');
        } catch (error) {
            console.error('[SafeAPI] deleteInstrument error:', error);
            return null;
        }
    },

    async instrumentExecute(type: 'multimeter' | 'oscilloscope', actionKey: string): Promise<CaptureResult | null> {
        if (!window.electronAPI?.instrumentExecute) return null;
        try {
            const result = await window.electronAPI.instrumentExecute(type, actionKey);
            return validateIpcResponse(result, CaptureResultSchema, 'instrumentExecute');
        } catch (error) {
            console.error('[SafeAPI] instrumentExecute error:', error);
            return null;
        }
    },

    async testConnection(config: Instrument): Promise<StatusResponse | null> {
        if (!window.electronAPI?.instrumentTestConnection) return null;
        try {
            const result = await window.electronAPI.instrumentTestConnection(config);
            return validateIpcResponse(result, StatusResponseSchema, 'instrumentTestConnection');
        } catch (error) {
            console.error('[SafeAPI] instrumentTestConnection error:', error);
            return null;
        }
    },
};

/**
 * Safe wrapper for export operations
 */
export const safeExportAPI = {
    async exportPdf(projectId: number): Promise<{ status: string; filePath?: string; message?: string } | null> {
        if (!window.electronAPI?.exportPdf) return null;
        try {
            const result = await window.electronAPI.exportPdf(projectId);
            return validateIpcResponse(result, ExportResponseSchema, 'exportPdf');
        } catch (error) {
            console.error('[SafeAPI] exportPdf error:', error);
            return null;
        }
    },

    async exportImage(projectId: number): Promise<{ status: string; filePath?: string; message?: string } | null> {
        if (!window.electronAPI?.exportImage) return null;
        try {
            const result = await window.electronAPI.exportImage(projectId);
            return validateIpcResponse(result, ExportResponseSchema, 'exportImage');
        } catch (error) {
            console.error('[SafeAPI] exportImage error:', error);
            return null;
        }
    },
};

/**
 * Safe wrapper for config operations
 */
export const safeConfigAPI = {
    async loadConfig(): Promise<PersistedConfig | null> {
        if (!window.electronAPI?.loadConfig) return null;
        try {
            const result = await window.electronAPI.loadConfig();
            return validateIpcResponse(result, PersistedConfigSchema, 'loadConfig');
        } catch (error) {
            console.error('[SafeAPI] loadConfig error:', error);
            return null;
        }
    },

    async saveConfig(config: PersistedConfig): Promise<void> {
        if (!window.electronAPI?.saveConfig) return;
        try {
            await window.electronAPI.saveConfig(config);
        } catch (error) {
            console.error('[SafeAPI] saveConfig error:', error);
        }
    },

    async loadApiKey(): Promise<string> {
        if (!window.electronAPI?.loadApiKey) return '';
        try {
            const result = await window.electronAPI.loadApiKey();
            return typeof result === 'string' ? result : '';
        } catch (error) {
            console.error('[SafeAPI] loadApiKey error:', error);
            return '';
        }
    },

    async saveApiKey(key: string): Promise<void> {
        if (!window.electronAPI?.saveApiKey) return;
        try {
            await window.electronAPI.saveApiKey(key);
        } catch (error) {
            console.error('[SafeAPI] saveApiKey error:', error);
        }
    },

    async getAllAttributes(boardType?: string): Promise<{ keys: string[]; values: string[] }> {
        if (!window.electronAPI?.getAllAttributes) return { keys: [], values: [] };
        try {
            const result = await window.electronAPI.getAllAttributes(boardType);
            return validateIpcWithFallback(result, AttributesResponseSchema, { keys: [], values: [] }, 'getAllAttributes');
        } catch (error) {
            console.error('[SafeAPI] getAllAttributes error:', error);
            return { keys: [], values: [] };
        }
    },

    async getBoardTypes(): Promise<string[]> {
        if (!window.electronAPI?.getBoardTypes) return [];
        try {
            const result = await window.electronAPI.getBoardTypes();
            return validateIpcWithFallback(result, BoardTypesSchema, [], 'getBoardTypes');
        } catch (error) {
            console.error('[SafeAPI] getBoardTypes error:', error);
            return [];
        }
    },

    async addBoardType(type: string): Promise<boolean> {
        if (!window.electronAPI?.addBoardType) return false;
        try {
            const result = await window.electronAPI.addBoardType(type);
            return typeof result === 'boolean' ? result : false;
        } catch (error) {
            console.error('[SafeAPI] addBoardType error:', error);
            return false;
        }
    },
};

/**
 * Combined safe API object for convenience
 */
export const safeElectronAPI = {
    ...safeProjectAPI,
    ...safePointAPI,
    ...safeInstrumentAPI,
    ...safeExportAPI,
    ...safeConfigAPI,
    isElectron: isElectronEnvironment,
};

export default safeElectronAPI;
