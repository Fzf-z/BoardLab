import { z } from 'zod';

// ============================================
// Base Schemas
// ============================================

export const StatusResponseSchema = z.object({
    status: z.enum(['success', 'error', 'cancelled']),
    message: z.string().optional(),
});

export const IdResponseSchema = z.object({
    id: z.number(),
});

// ============================================
// Project Schemas
// ============================================

export const ProjectSchema = z.object({
    id: z.number(),
    board_type: z.string(),
    board_model: z.string(),
    attributes: z.string(), // JSON string
    notes: z.string().optional(),
    image_data: z.union([z.instanceof(Uint8Array), z.array(z.number())]).optional(),
    image_data_b: z.union([z.instanceof(Uint8Array), z.array(z.number())]).optional(),
    created_at: z.string().optional(),
});

export const ProjectListSchema = z.array(ProjectSchema);

// ============================================
// Point Schemas
// ============================================

export const MeasurementValueSchema = z.object({
    type: z.enum(['voltage', 'resistance', 'diode', 'ground', 'oscilloscope']).optional(),
    value: z.union([z.string(), z.number()]).optional(),
    vpp: z.number().optional(),
    freq: z.number().optional(),
    waveform: z.array(z.number()).optional(),
    timeScale: z.number().optional(),
    voltageScale: z.number().optional(),
    voltageOffset: z.number().optional(),
    capturedAt: z.string().optional(),
});

export const PointSchema = z.object({
    id: z.union([z.number(), z.string()]),
    project_id: z.number().optional(),
    x: z.number(),
    y: z.number(),
    label: z.string(),
    notes: z.string().optional(),
    type: z.enum(['voltage', 'resistance', 'diode', 'ground', 'oscilloscope']),
    category: z.string().optional(),
    tolerance: z.number().optional(),
    expected_value: z.string().optional(),
    side: z.enum(['A', 'B']).optional(),
    parentPointId: z.union([z.number(), z.string()]).optional(),
    measurements: z.record(z.string(), MeasurementValueSchema).optional(),
    temp_id: z.string().optional(),
});

export const PointListSchema = z.array(PointSchema);

// ============================================
// Instrument Schemas
// ============================================

export const InstrumentSchema = z.object({
    id: z.number().optional(),
    name: z.string(),
    type: z.enum(['multimeter', 'oscilloscope']),
    connection_type: z.enum(['tcp_raw', 'serial']),
    ip_address: z.string().nullable().optional(),
    port: z.number().nullable().optional(),
    serial_settings: z.string().nullable().optional(),
    command_map: z.string().nullable().optional(),
    is_active: z.union([z.number(), z.boolean()]).nullable().optional().transform(val => {
        // Normalize to number: SQLite returns 0/1, but could also be boolean
        if (val === null || val === undefined) return 0;
        if (typeof val === 'boolean') return val ? 1 : 0;
        return val;
    }),
});

export const InstrumentListSchema = z.array(InstrumentSchema);

// ============================================
// Capture Result Schema
// ============================================

export const CaptureResultSchema = z.object({
    status: z.enum(['success', 'error']),
    message: z.string().optional(),
    value: z.union([z.string(), z.number()]).optional(),
    waveform: z.array(z.number()).optional(),
    timeScale: z.number().optional(),
    voltageScale: z.number().optional(),
    voltageOffset: z.number().optional(),
    vpp: z.number().optional(),
    freq: z.number().optional(),
});

// ============================================
// Export Response Schema
// ============================================

export const ExportResponseSchema = z.object({
    status: z.enum(['success', 'error', 'cancelled']),
    filePath: z.string().optional(),
    message: z.string().optional(),
});

// ============================================
// Measurement History Schema
// ============================================

export const MeasurementHistoryItemSchema = z.object({
    id: z.number().optional(),
    type: z.enum(['voltage', 'resistance', 'diode', 'ground', 'oscilloscope']),
    value: z.union([z.string(), z.number(), MeasurementValueSchema]),
    created_at: z.string().optional(),
});

export const MeasurementHistorySchema = z.array(MeasurementHistoryItemSchema);

// ============================================
// Config Schemas
// ============================================

export const PointCategorySchema = z.object({
    id: z.string(),
    label: z.string(),
    color: z.string(),
    boardType: z.string().optional(),
});

export const AppSettingsSchema = z.object({
    autoSave: z.boolean(),
    pointSize: z.number(),
    pointColor: z.string(),
    categories: z.array(PointCategorySchema),
});

export const InstrumentConfigSchema = z.object({
    timeout: z.number().optional(),
    multimeter: z.object({
        ip: z.string(),
        port: z.number(),
        commands: z.record(z.string(), z.string()),
    }),
    oscilloscope: z.object({
        ip: z.string(),
        port: z.number(),
        commands: z.record(z.string(), z.string()),
    }),
    monitor: z.object({
        enabled: z.boolean(),
    }),
});

export const PersistedConfigSchema = InstrumentConfigSchema.partial().extend({
    appSettings: AppSettingsSchema.optional(),
});

// ============================================
// Attributes Schema
// ============================================

export const AttributesResponseSchema = z.object({
    keys: z.array(z.string()),
    values: z.array(z.string()),
});

// ============================================
// Board Types Schema
// ============================================

export const BoardTypesSchema = z.array(z.string());

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validates IPC response data against a Zod schema.
 * Logs validation errors and returns null if validation fails.
 */
export function validateIpcResponse<T>(
    data: unknown,
    schema: z.ZodType<T>,
    context: string
): T | null {
    const result = schema.safeParse(data);

    if (!result.success) {
        console.error(`[IPC Validation] ${context} failed:`, result.error.format());
        return null;
    }

    return result.data;
}

/**
 * Validates IPC response with a fallback value if validation fails.
 */
export function validateIpcWithFallback<T>(
    data: unknown,
    schema: z.ZodType<T>,
    fallback: T,
    context: string
): T {
    const result = validateIpcResponse(data, schema, context);
    return result ?? fallback;
}

/**
 * Creates a safe IPC caller that validates responses.
 * Returns null and logs error if validation fails.
 */
export function createSafeIpcCaller<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<unknown>,
    schema: z.ZodType<TResult>,
    context: string
): (...args: TArgs) => Promise<TResult | null> {
    return async (...args: TArgs): Promise<TResult | null> => {
        try {
            const result = await fn(...args);
            return validateIpcResponse(result, schema, context);
        } catch (error) {
            console.error(`[IPC Error] ${context}:`, error);
            return null;
        }
    };
}

// ============================================
// Type Exports (inferred from schemas)
// ============================================

export type ValidatedProject = z.infer<typeof ProjectSchema>;
export type ValidatedPoint = z.infer<typeof PointSchema>;
export type ValidatedInstrument = z.infer<typeof InstrumentSchema>;
export type ValidatedCaptureResult = z.infer<typeof CaptureResultSchema>;
export type ValidatedMeasurementHistoryItem = z.infer<typeof MeasurementHistoryItemSchema>;
