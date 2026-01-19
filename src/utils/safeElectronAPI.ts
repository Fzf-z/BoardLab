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
import { Logger } from './logger';
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

const log = Logger.SafeAPI;

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
            log.error('createProject failed', error);
            return null;
        }
    },

    async getProjects(): Promise<Project[]> {
        if (!window.electronAPI?.getProjects) return [];
        try {
            const result = await window.electronAPI.getProjects();
            return validateIpcWithFallback(result, ProjectListSchema, [], 'getProjects');
        } catch (error) {
            log.error('getProjects failed', error);
            return [];
        }
    },

    async getProjectWithImage(id: number): Promise<Project | null> {
        if (!window.electronAPI?.getProjectWithImage) return null;
        try {
            const result = await window.electronAPI.getProjectWithImage(id);
            return validateIpcResponse(result, ProjectSchema, 'getProjectWithImage');
        } catch (error) {
            log.error('getProjectWithImage failed', error);
            return null;
        }
    },

    async deleteProject(id: number): Promise<StatusResponse | null> {
        if (!window.electronAPI?.deleteProject) return null;
        try {
            const result = await window.electronAPI.deleteProject(id);
            return validateIpcResponse(result, StatusResponseSchema, 'deleteProject');
        } catch (error) {
            log.error('deleteProject failed', error);
            return null;
        }
    },

    async updateProject(data: Partial<Project>): Promise<StatusResponse | null> {
        if (!window.electronAPI?.updateProject) return null;
        try {
            const result = await window.electronAPI.updateProject(data);
            return validateIpcResponse(result, StatusResponseSchema, 'updateProject');
        } catch (error) {
            log.error('updateProject failed', error);
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
            log.warn('searchProjectsByPoint returned invalid data', result);
            return [];
        } catch (error) {
            log.error('searchProjectsByPoint failed', error);
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
            log.error('getPoints failed', error);
            return [];
        }
    },

    async savePoints(projectId: number, points: Point[]): Promise<Point[]> {
        if (!window.electronAPI?.savePoints) return [];
        try {
            const result = await window.electronAPI.savePoints({ projectId, points });
            return validateIpcWithFallback(result, PointListSchema, [], 'savePoints') as Point[];
        } catch (error) {
            log.error('savePoints failed', error);
            return [];
        }
    },

    async deletePoint(id: number | string): Promise<StatusResponse | null> {
        if (!window.electronAPI?.deletePoint) return null;
        try {
            const result = await window.electronAPI.deletePoint(id);
            return validateIpcResponse(result, StatusResponseSchema, 'deletePoint');
        } catch (error) {
            log.error('deletePoint failed', error);
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
            log.error('createMeasurement failed', error);
            return null;
        }
    },

    async getMeasurementHistory(pointId: number | string): Promise<MeasurementHistoryItem[]> {
        if (!window.electronAPI?.getMeasurementHistory) return [];
        try {
            const result = await window.electronAPI.getMeasurementHistory(pointId);
            return validateIpcWithFallback(result, MeasurementHistorySchema, [], 'getMeasurementHistory') as MeasurementHistoryItem[];
        } catch (error) {
            log.error('getMeasurementHistory failed', error);
            return [];
        }
    },
};

/**
 * Safe wrapper for instrument operations
 */
export const safeInstrumentAPI = {
    async getAllInstruments(): Promise<Instrument[]> {
        if (!window.electronAPI?.getAllInstruments) {
            log.warn('getAllInstruments: electronAPI not available');
            return [];
        }
        try {
            const result = await window.electronAPI.getAllInstruments();
            log.debug('getAllInstruments raw result', result);
            const validated = validateIpcWithFallback(result, InstrumentListSchema, [], 'getAllInstruments') as Instrument[];
            log.debug('getAllInstruments validated', validated);
            return validated;
        } catch (error) {
            log.error('getAllInstruments failed', error);
            return [];
        }
    },

    async saveInstrument(data: Instrument): Promise<IdResponse | null> {
        if (!window.electronAPI?.saveInstrument) return null;
        try {
            const result = await window.electronAPI.saveInstrument(data);
            return validateIpcResponse(result, IdResponseSchema, 'saveInstrument');
        } catch (error) {
            log.error('saveInstrument failed', error);
            return null;
        }
    },

    async deleteInstrument(id: number): Promise<StatusResponse | null> {
        if (!window.electronAPI?.deleteInstrument) return null;
        try {
            const result = await window.electronAPI.deleteInstrument(id);
            return validateIpcResponse(result, StatusResponseSchema, 'deleteInstrument');
        } catch (error) {
            log.error('deleteInstrument failed', error);
            return null;
        }
    },

    async instrumentExecute(type: 'multimeter' | 'oscilloscope', actionKey: string): Promise<CaptureResult | null> {
        if (!window.electronAPI?.instrumentExecute) return null;
        try {
            log.info(`Executing instrument action: ${type}/${actionKey}`);
            const result = await window.electronAPI.instrumentExecute(type, actionKey);
            return validateIpcResponse(result, CaptureResultSchema, 'instrumentExecute');
        } catch (error) {
            log.error('instrumentExecute failed', error);
            return null;
        }
    },

    async testConnection(config: Instrument): Promise<StatusResponse | null> {
        if (!window.electronAPI?.instrumentTestConnection) return null;
        try {
            log.info(`Testing connection to ${config.name}`);
            const result = await window.electronAPI.instrumentTestConnection(config);
            return validateIpcResponse(result, StatusResponseSchema, 'instrumentTestConnection');
        } catch (error) {
            log.error('instrumentTestConnection failed', error);
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
            log.info(`Exporting PDF for project ${projectId}`);
            const result = await window.electronAPI.exportPdf(projectId);
            return validateIpcResponse(result, ExportResponseSchema, 'exportPdf');
        } catch (error) {
            log.error('exportPdf failed', error);
            return null;
        }
    },

    async exportImage(projectId: number): Promise<{ status: string; filePath?: string; message?: string } | null> {
        if (!window.electronAPI?.exportImage) return null;
        try {
            log.info(`Exporting image for project ${projectId}`);
            const result = await window.electronAPI.exportImage(projectId);
            return validateIpcResponse(result, ExportResponseSchema, 'exportImage');
        } catch (error) {
            log.error('exportImage failed', error);
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
            log.error('loadConfig failed', error);
            return null;
        }
    },

    async saveConfig(config: PersistedConfig): Promise<void> {
        if (!window.electronAPI?.saveConfig) return;
        try {
            await window.electronAPI.saveConfig(config);
            log.debug('Config saved successfully');
        } catch (error) {
            log.error('saveConfig failed', error);
        }
    },

    async loadApiKey(): Promise<string> {
        if (!window.electronAPI?.loadApiKey) return '';
        try {
            const result = await window.electronAPI.loadApiKey();
            return typeof result === 'string' ? result : '';
        } catch (error) {
            log.error('loadApiKey failed', error);
            return '';
        }
    },

    async saveApiKey(key: string): Promise<void> {
        if (!window.electronAPI?.saveApiKey) return;
        try {
            await window.electronAPI.saveApiKey(key);
            log.debug('API key saved successfully');
        } catch (error) {
            log.error('saveApiKey failed', error);
        }
    },

    async getAllAttributes(boardType?: string): Promise<{ keys: string[]; values: string[] }> {
        if (!window.electronAPI?.getAllAttributes) return { keys: [], values: [] };
        try {
            const result = await window.electronAPI.getAllAttributes(boardType);
            return validateIpcWithFallback(result, AttributesResponseSchema, { keys: [], values: [] }, 'getAllAttributes');
        } catch (error) {
            log.error('getAllAttributes failed', error);
            return { keys: [], values: [] };
        }
    },

    async getBoardTypes(): Promise<string[]> {
        if (!window.electronAPI?.getBoardTypes) return [];
        try {
            const result = await window.electronAPI.getBoardTypes();
            return validateIpcWithFallback(result, BoardTypesSchema, [], 'getBoardTypes');
        } catch (error) {
            log.error('getBoardTypes failed', error);
            return [];
        }
    },

    async addBoardType(type: string): Promise<boolean> {
        if (!window.electronAPI?.addBoardType) return false;
        try {
            const result = await window.electronAPI.addBoardType(type);
            return typeof result === 'boolean' ? result : false;
        } catch (error) {
            log.error('addBoardType failed', error);
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
