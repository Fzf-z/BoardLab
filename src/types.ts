export interface Project {
    id: number;
    board_type: string;
    board_model: string;
    attributes: string; // JSON string in DB, parsed object in app? Usually kept as string until needed or handled in worker.
    notes?: string;
    image_data?: Uint8Array | number[]; // Buffer comes as Uint8Array usually
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
    tolerance?: number;
    expected_value?: string;
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
}

export interface AppSettings {
    autoSave: boolean;
    pointSize: number; // in pixels
    pointColor: string; // hex
}
