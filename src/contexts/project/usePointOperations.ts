import { useCallback } from 'react';
import { Logger } from '../../utils/logger';
import type { Point, MeasurementValue } from '../../types';

const log = Logger.Project;

interface BoardActions {
    setPoints: (points: Point[] | ((prev: Point[]) => Point[])) => void;
    selectedPointId: number | string | null;
    setSelectedPointId: (id: number | string | null) => void;
}

interface UsePointOperationsOptions {
    board: BoardActions;
    showNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
    saveProject: () => Promise<Point[] | undefined>;
}

export function usePointOperations({ board, showNotification, saveProject }: UsePointOperationsOptions) {

    const deletePoint = useCallback(async (pointIdToDelete: number | string) => {
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
            log.error('Error deleting point', error);
            showNotification('An error occurred while deleting the point.', 'error');
        }
    }, [board, showNotification]);

    const addMeasurement = useCallback(async (point: Point, measurementData: MeasurementValue): Promise<MeasurementValue | null> => {
        if (!point || !measurementData) return null;

        let targetPoint = point;

        if (typeof targetPoint.id === 'string' && targetPoint.id.startsWith('temp-')) {
            const savedPoints = await saveProject();

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
            const valueToSave = measurementData.type === 'oscilloscope'
                ? measurementData
                : (measurementData.value ?? '');
            const finalType = measurementData.type || targetPoint.type;

            const result = await window.electronAPI.createMeasurement({
                pointId: targetPoint.id,
                type: finalType,
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
            log.error('Error adding measurement', error);
            showNotification('Error saving measurement.', 'error');
            return null;
        }
    }, [board, showNotification, saveProject]);

    return {
        deletePoint,
        addMeasurement
    };
}
