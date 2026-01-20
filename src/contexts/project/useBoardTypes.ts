import { useState, useEffect, useCallback } from 'react';

export function useBoardTypes() {
    const [boardTypes, setBoardTypes] = useState<string[]>([]);

    useEffect(() => {
        if (window.electronAPI?.getBoardTypes) {
            window.electronAPI.getBoardTypes().then(setBoardTypes);
        }
    }, []);

    const addBoardType = useCallback(async (type: string) => {
        if (window.electronAPI?.addBoardType) {
            await window.electronAPI.addBoardType(type);
            const types = await window.electronAPI.getBoardTypes();
            setBoardTypes(types);
        }
    }, []);

    return {
        boardTypes,
        addBoardType
    };
}
