import { useState, useCallback } from 'react';
import type { Point } from '../../types';

interface UndoableState<T> {
    past: T[];
    present: T;
    future: T[];
}

export function useUndoRedo(initialValue: Point[] = []) {
    const [state, setState] = useState<UndoableState<Point[]>>({
        past: [],
        present: initialValue,
        future: [],
    });

    const present = state.present;
    const canUndo = state.past.length > 0;
    const canRedo = state.future.length > 0;

    const setPresent = useCallback((newPoints: Point[] | ((prevState: Point[]) => Point[])) => {
        setState(currentState => {
            const newPresent = newPoints instanceof Function ? newPoints(currentState.present) : newPoints;

            if (JSON.stringify(currentState.present) === JSON.stringify(newPresent)) {
                return currentState;
            }

            return {
                past: [...currentState.past, currentState.present],
                present: newPresent,
                future: [],
            };
        });
    }, []);

    const setPresentOnly = useCallback((newPoints: Point[] | ((prevState: Point[]) => Point[])) => {
        setState(currentState => ({
            ...currentState,
            present: newPoints instanceof Function ? newPoints(currentState.present) : newPoints,
        }));
    }, []);

    const addToHistory = useCallback((previousState: Point[]) => {
        setState(prev => ({
            past: [...prev.past, previousState],
            present: prev.present,
            future: []
        }));
    }, []);

    const undo = useCallback(() => {
        setState(currentState => {
            const { past, present, future } = currentState;
            if (past.length === 0) return currentState;

            const previous = past[past.length - 1];
            const newPast = past.slice(0, past.length - 1);

            return {
                past: newPast,
                present: previous,
                future: [present, ...future],
            };
        });
    }, []);

    const redo = useCallback(() => {
        setState(currentState => {
            const { past, present, future } = currentState;
            if (future.length === 0) return currentState;

            const next = future[0];
            const newFuture = future.slice(1);

            return {
                past: [...past, present],
                present: next,
                future: newFuture,
            };
        });
    }, []);

    const reset = useCallback(() => {
        setState({ past: [], present: [], future: [] });
    }, []);

    return {
        present,
        setPresent,
        setPresentOnly,
        addToHistory,
        undo,
        redo,
        canUndo,
        canRedo,
        reset
    };
}
