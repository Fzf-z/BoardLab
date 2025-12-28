import { useState, useEffect } from 'react';

export const useGemini = () => {
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiResponse, setAiResponse] = useState("");
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiTitle, setAiTitle] = useState("");
    const [apiKey, setApiKey] = useState("");

    const isElectron = window.electronAPI?.isElectron || false;

    useEffect(() => {
        if (isElectron) {
            window.electronAPI.loadApiKey().then(key => {
                if (key) setApiKey(key);
            });
        }
    }, [isElectron]);

    const callGemini = async (prompt, title) => {
        setAiTitle(title);
        setAiModalOpen(true);
        setIsAiLoading(true);
        setAiResponse("");

        if (!apiKey) {
            setAiResponse("⚠️ Error: Falta la API Key de Gemini. Configúrala en los ajustes.");
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
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";
            setAiResponse(text);
        } catch (error) {
            setAiResponse("Error de conexión con IA.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const analyzeBoard = (points) => {
        if (points.length === 0) {
            alert("Agrega puntos de medición primero.");
            return;
        }
        const measurements = points.map(p => `- ${p.label} (${p.type}): ${p.value || 'N/A'}. Notas: ${p.notes}`).join('\n');
        callGemini(`Analiza estas mediciones de motherboard y da un posible diagnóstico:\n${measurements}`, "Diagnóstico Inteligente");
    };

    const askAboutPoint = (selectedPoint) => {
        if (!selectedPoint) return;
        callGemini(`Analiza este punto de prueba en una placa base: "${selectedPoint.label}" del tipo ${selectedPoint.type}. ¿Qué función típica tiene y qué valores se esperarían?`, `Consulta sobre: ${selectedPoint.label}`);
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
