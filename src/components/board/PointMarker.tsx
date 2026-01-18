import React from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { Point, AppSettings } from '../../types';

interface PointMarkerProps {
    point: Point;
    effectivePoint: Point;
    isSelected: boolean;
    isHovered: boolean;
    labelOffset: { x: number; y: number };
    appSettings: AppSettings;
    mode: 'view' | 'measure';
    onMouseDown: (e: React.MouseEvent) => void;
    onClick: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

const PointMarker: React.FC<PointMarkerProps> = ({
    point,
    effectivePoint,
    isSelected,
    isHovered,
    labelOffset,
    appSettings,
    mode,
    onMouseDown,
    onClick,
    onContextMenu,
    onMouseEnter,
    onMouseLeave
}) => {
    const isReplica = !!point.parentPointId;
    const hasMeas = effectivePoint.measurements && Object.keys(effectivePoint.measurements).length > 0;
    const size = appSettings.pointSize || 24;

    // Determine point color
    let defaultColor = appSettings.pointColor || '#4b5563';
    if (effectivePoint.category && appSettings.categories) {
        const cat = appSettings.categories.find(c => c.id === effectivePoint.category);
        if (cat) defaultColor = cat.color;
    }
    const finalColor = isSelected ? '#eab308' : defaultColor;

    // Label positioning
    const offset = labelOffset || { x: size / 2 + 5 + 10, y: 0 };
    const labelX = offset.x;
    const labelY = offset.y;

    // Determine if we need a leader line
    const dist = Math.hypot(labelX, labelY);
    const showLeader = dist > (size / 2 + 15);

    const pointStyle: React.CSSProperties = {
        left: point.x,
        top: point.y,
        width: `${size}px`,
        height: `${size}px`,
        marginLeft: `-${size / 2}px`,
        marginTop: `-${size / 2}px`,
        cursor: mode === 'measure' ? 'grab' : 'pointer',
        backgroundColor: finalColor,
        borderStyle: isReplica ? 'dashed' : 'solid',
        borderColor: isSelected || isHovered ? 'white' : (hasMeas ? '#60a5fa' : '#9ca3af'),
        borderWidth: hasMeas ? '3px' : '2px',
        transform: isSelected ? 'scale(1.25)' : 'scale(1)',
        zIndex: isSelected ? 20 : 10
    };

    return (
        <div
            className="absolute rounded-full border-2 flex items-center justify-center shadow-lg transition-transform"
            style={pointStyle}
            onMouseDown={onMouseDown}
            onClick={onClick}
            onContextMenu={onContextMenu}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Center dot */}
            <div className="bg-white rounded-full" style={{ width: size / 4, height: size / 4 }} />

            {/* Replica indicator */}
            {isReplica && (
                <div className="absolute -top-1 -right-1 bg-gray-800 rounded-full p-[1px] border border-gray-600">
                    <LinkIcon size={8} className="text-white" />
                </div>
            )}

            {/* Leader Line */}
            {showLeader && (
                <svg className="absolute overflow-visible pointer-events-none" style={{ left: '50%', top: '50%' }}>
                    <line
                        x1={0} y1={0}
                        x2={labelX} y2={labelY}
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth="1.5"
                    />
                </svg>
            )}

            {/* Label Tag */}
            <div
                className={`absolute px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap pointer-events-none ${isSelected ? 'bg-yellow-500 text-black' : 'bg-black/50 text-white'}`}
                style={{
                    transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                    left: '50%',
                    top: '50%'
                }}
            >
                {effectivePoint.label}
            </div>
        </div>
    );
};

export default PointMarker;
