import { useState, useCallback } from 'react';
import type { Point } from '../../types';

interface SequenceState {
    active: boolean;
    currentIndex: number;
    order: (number | string)[];
}

interface UseSequencerOptions {
    points: Point[];
    selectPoint: (id: number | string) => void;
    showNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export function useSequencer({ points, selectPoint, showNotification }: UseSequencerOptions) {
    const [sequence, setSequence] = useState<SequenceState>({
        active: false,
        currentIndex: -1,
        order: []
    });

    const startSequence = useCallback(() => {
        // Filter out Ground points as they are references and don't need active measurement
        const actionablePoints = points.filter(p => {
            const isGroundType = p.type === 'ground';
            const isGroundCategory = p.category && p.category.toLowerCase().includes('ground');
            return !isGroundType && !isGroundCategory;
        });

        const order = actionablePoints.map(p => p.id);

        if (order.length === 0) {
            showNotification('No actionable points (non-ground) to sequence.', 'warning');
            return;
        }

        setSequence({
            active: true,
            currentIndex: 0,
            order
        });

        selectPoint(order[0]);
        showNotification('Sequence Mode Started', 'info');
    }, [points, selectPoint, showNotification]);

    const stopSequence = useCallback(() => {
        setSequence(prev => ({ ...prev, active: false }));
        showNotification('Sequence Mode Stopped', 'info');
    }, [showNotification]);

    const nextInSequence = useCallback(() => {
        setSequence(prev => {
            if (!prev.active) return prev;
            const nextIndex = prev.currentIndex + 1;
            if (nextIndex >= prev.order.length) {
                setTimeout(() => showNotification('Sequence Completed!', 'success'), 0);
                return { ...prev, active: false, currentIndex: 0 };
            }
            setTimeout(() => selectPoint(prev.order[nextIndex]), 0);
            return { ...prev, currentIndex: nextIndex };
        });
    }, [selectPoint, showNotification]);

    const prevInSequence = useCallback(() => {
        setSequence(prev => {
            if (!prev.active) return prev;
            const nextIndex = prev.currentIndex - 1;
            if (nextIndex < 0) return prev;
            setTimeout(() => selectPoint(prev.order[nextIndex]), 0);
            return { ...prev, currentIndex: nextIndex };
        });
    }, [selectPoint]);

    return {
        sequence,
        startSequence,
        stopSequence,
        nextInSequence,
        prevInSequence
    };
}
