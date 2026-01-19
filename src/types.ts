export interface Project {
    id: number;
    board_type: string;
    board_model: string;
    attributes: string; // JSON string in DB, parsed object in app? Usually kept as string until needed or handled in worker.
    notes?: string;
    image_data?: Uint8Array | number[]; // Buffer comes as Uint8Array usually
    image_data_b?: Uint8Array | number[]; // Second image (Side B)
    created_at?: string;
}

export interface OscilloscopeData {
    waveform: number[];
    timeScale: number;
    voltageScale: number;
    voltageOffset: number;
    vpp: number;
    freq: number;
    capturedAt?: string;
}

export type MeasurementType = 'voltage' | 'resistance' | 'diode' | 'ground' | 'oscilloscope';

export interface MeasurementValue {
    type?: MeasurementType;
    value?: string | number; // For multimeter
    // For oscilloscope
    vpp?: number;
    freq?: number;
    waveform?: number[];
    timeScale?: number;
    voltageScale?: number;
    voltageOffset?: number;
    
    capturedAt?: string;
}

export interface Point {
    id: number | string; // number for DB ids, string for 'temp-xxx'
    project_id?: number;
    x: number;
    y: number;
    label: string;
    notes?: string;
    type: MeasurementType;
    category?: string; // e.g., 'power', 'ground', 'signal', 'clock'
    tolerance?: number;
    expected_value?: string;
    side?: 'A' | 'B'; // Which side of the board the point belongs to
    parentPointId?: number | string; // For linked/duplicated points
    // In the frontend, we store latest measurements by type for quick access
    measurements?: Record<string, MeasurementValue>;
    temp_id?: string; // Used during saving to map temp IDs to real IDs
}

export interface InstrumentConfig {
    timeout?: number;
    multimeter: {
        ip: string;
        port: number;
        commands: Record<string, string>;
    };
    oscilloscope: {
        ip: string;
        port: number;
        commands: Record<string, string>;
    };
    monitor: {
        enabled: boolean;
    };
}

export interface PointCategory {
    id: string;
    label: string;
    color: string;
    boardType?: string;
}

export interface AppSettings {
    autoSave: boolean;
    pointSize: number; // in pixels
    pointColor: string; // hex
    categories: PointCategory[];
}

export interface Instrument {
    id?: number;
    name: string;
    type: 'multimeter' | 'oscilloscope';
    connection_type: 'tcp_raw' | 'serial';
    ip_address?: string | null;
    port?: number | null;
    serial_settings?: string | null;
    command_map?: string | null;
    is_active?: number; // 0 or 1, defaults to 0
}

// --- Project Creation Types ---
export interface CreateProjectData {
    board_type: string;
    board_model: string;
    attributes: Record<string, string>;
    notes?: string;
    image_data: Uint8Array;
    image_data_b?: Uint8Array;
}

// --- API Response Types ---
export interface ApiResponse<T = void> {
    status: 'success' | 'error' | 'cancelled';
    message?: string;
    data?: T;
}

export interface ExportResponse {
    status: 'success' | 'error' | 'cancelled';
    filePath?: string;
    message?: string;
}

export interface MeasurementHistoryItem {
    id?: number;
    type: MeasurementType;
    value: string | number | MeasurementValue;
    created_at?: string;
}

// --- Hardware Capture Result ---
export interface CaptureResult {
    status: 'success' | 'error';
    message?: string;
    value?: string | number;
    waveform?: number[];
    timeScale?: number;
    voltageScale?: number;
    voltageOffset?: number;
    vpp?: number;
    freq?: number;
}

// --- Persisted Config ---
export interface PersistedConfig extends Partial<InstrumentConfig> {
    appSettings?: AppSettings;
}

// --- Comparison Point (for cross-project comparison) ---
export interface ComparisonPoint extends Point {
    project_id: number;
    board_model?: string;
}
