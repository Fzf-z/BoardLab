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
    ip_address: string; // Made required as per schema usage
    port: number;
    serial_settings?: string; // JSON string
    command_map: string; // JSON string
    is_active: number; // 0 or 1
}
