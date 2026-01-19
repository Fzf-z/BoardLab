import React from 'react';
import { Copy } from 'lucide-react';

interface BoardContextMenuProps {
    x: number;
    y: number;
    onDuplicate: () => void;
    mode: 'view' | 'measure';
}

const BoardContextMenu: React.FC<BoardContextMenuProps> = ({ x, y, onDuplicate, mode }) => {
    if (mode !== 'measure') return null;

    return (
        <div
            className="fixed z-[100] bg-gray-800 border border-gray-600 rounded shadow-xl py-1 w-48 backdrop-blur-sm text-gray-200"
            style={{ left: x, top: y }}
        >
            <button
                className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2 text-sm"
                onClick={onDuplicate}
            >
                <Copy size={14} />
                <span>Duplicate / Link Point</span>
            </button>
        </div>
    );
};

export default BoardContextMenu;
