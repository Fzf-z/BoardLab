import { useState } from 'react';
import { useNotifier } from '../contexts/NotifierContext';
import { Point } from '../types';

export const useGemini = (apiKey: string) => {
    const { showNotification } = useNotifier();
    const [aiModalOpen, setAiModalOpen] = useState<boolean>(false);
    const [aiResponse, setAiResponse] = useState<string>("");
    const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
    const [aiTitle, setAiTitle] = useState<string>("");

    const callGemini = async (prompt: string, title: string) => {
        setAiTitle(title);
        setAiModalOpen(true);
        setIsAiLoading(true);
        setAiResponse("");

        if (!apiKey) {
            setAiResponse("⚠️ Error: Missing Gemini API Key. Please configure it in the settings.");
            setIsAiLoading(false);
            return;
        }

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
            setAiResponse(text);
        } catch (error) {
            setAiResponse("Connection error with AI.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const analyzeBoard = (points: Point[]) => {
        if (points.length === 0) {
            showNotification("Add measurement points first.", 'warning');
            return;
        }
        const measurementsText = points.map(p => {
            if (!p.measurements) return `- ${p.label}: No measurements`;
            const measuredValues = Object.entries(p.measurements)
                .map(([type, meas]) => {
                    if (type === 'oscilloscope' && meas.value) {
                        return `oscilloscope: Vpp=${meas.vpp}, Freq=${meas.freq}`;
                    }
                    return meas.value ? `${type}: ${meas.value}` : null;
                })
                .filter(Boolean)
                .join(', ');
            return `- ${p.label}: ${measuredValues || 'N/A'}. Notes: ${p.notes}`;
        }).join('\n');
    
        callGemini(`Analyze these motherboard measurements and provide a possible diagnosis:\n${measurementsText}`, "Intelligent Diagnosis");
    };

    const askAboutPoint = (selectedPoint: Point) => {
        if (!selectedPoint) return;
        
        let measuredValues = 'none';
        if (selectedPoint.measurements) {
            measuredValues = Object.entries(selectedPoint.measurements)
                .map(([type, meas]) => {
                    if (type === 'oscilloscope' && meas.value) {
                        return `oscilloscope: Vpp=${meas.vpp}, Freq=${meas.freq}`;
                    }
                    return meas.value ? `${type}: ${meas.value}` : null;
                })
                .filter(Boolean)
                .join(', ') || 'none';
        }
        
        callGemini(`Analyze this test point on a motherboard: "${selectedPoint.label}" of type ${selectedPoint.type}. Current measurements: ${measuredValues}. What is its typical function and what values would be expected?`, `Inquiry about: ${selectedPoint.label}`);
    };

    return {
        aiModalOpen,
        setAiModalOpen,
        aiResponse,
        isAiLoading,
        aiTitle,
        callGemini,
        analyzeBoard,
        askAboutPoint,
    };
};
