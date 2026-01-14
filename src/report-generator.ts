import { Project, Point, MeasurementValue } from './types';

// Helper for buffer handling if environment differs
const bufferToBase64 = (buffer: Uint8Array | number[] | any): string => {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(buffer as any).toString('base64');
    } else {
        let binary = '';
        const bytes = new Uint8Array(buffer as any);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
};

function generateWaveformSvg(measurement: MeasurementValue): string {
    if (!measurement || !measurement.waveform || !Array.isArray(measurement.waveform)) return 'No waveform data';
    
    const waveform = measurement.waveform || [];
    const voltageScale = measurement.voltageScale || 1;
    const voltageOffset = measurement.voltageOffset || 0;
    const timeScale = measurement.timeScale || 1;
    const vpp = measurement.vpp;
    const freq = measurement.freq;

    const svgWidth = 500, svgHeight = 300;
    const numDivX = 10, numDivY = 8;
    const stepX = svgWidth / numDivX, stepY = svgHeight / numDivY;

    // --- Grid Construction ---
    let gridLines = '';
    // Vertical grid lines
    for (let i = 1; i < numDivX; i++) gridLines += `<line x1="${i * stepX}" y1="0" x2="${i * stepX}" y2="${svgHeight}" stroke="#e5e7eb" stroke-width="1" />`;
    // Horizontal grid lines
    for (let i = 1; i < numDivY; i++) gridLines += `<line x1="0" y1="${i * stepY}" x2="${svgWidth}" y2="${i * stepY}" stroke="#e5e7eb" stroke-width="1" />`;
    
    // Central Axes
    gridLines += `<line x1="${svgWidth/2}" y1="0" x2="${svgWidth/2}" y2="${svgHeight}" stroke="#9ca3af" stroke-width="1" />`;
    gridLines += `<line x1="0" y1="${svgHeight/2}" x2="${svgWidth}" y2="${svgHeight/2}" stroke="#9ca3af" stroke-width="1" />`;

    // --- Waveform Path ---
    const vRange = numDivY * voltageScale;
    const vBottom = voltageOffset - (vRange / 2);

    const pointsStr = waveform
        .map((val, i) => {
            const x = (i / (waveform.length - 1)) * svgWidth;
            const yPercent = vRange === 0 ? 0.5 : (val - vBottom) / vRange;
            const y = Math.max(0, Math.min(svgHeight, svgHeight - (yPercent * svgHeight)));
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    return `
        <div style="font-family: monospace; background: #fff; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; display: inline-block;">
            <div style="background: #f3f4f6; padding: 5px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #374151; display: flex; justify-content: space-between;">
                <span><strong>Scale:</strong> ${voltageScale} V/div | ${timeScale} s/div</span>
                <span><strong>Vpp:</strong> ${vpp ? vpp.toFixed(2) + ' V' : '--'} | <strong>Freq:</strong> ${freq ? freq.toFixed(2) + ' Hz' : '--'}</span>
            </div>
            <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="display: block;">
                <rect width="100%" height="100%" fill="#ffffff" />
                ${gridLines}
                <polyline points="${pointsStr}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round" />
            </svg>
        </div>
    `;
}

function renderMeasurementValue(measurement: MeasurementValue): string {
    if (measurement.type === 'oscilloscope') {
        return generateWaveformSvg(measurement); 
    }
    if (typeof measurement.value === 'object' && measurement.value !== null) {
        return `<pre>${JSON.stringify(measurement.value, null, 2)}</pre>`;
    }
    return String(measurement.value ?? '');
}

export function generateReportHtml(project: Project, points: Point[], dims?: { widthA: number, heightA: number, widthB?: number, heightB?: number }): string {
    const imageA = project.image_data 
        ? `data:image/png;base64,${bufferToBase64(project.image_data)}` 
        : null;
    const imageB = project.image_data_b 
        ? `data:image/png;base64,${bufferToBase64(project.image_data_b)}` 
        : null;
    
    // Attributes processing
    let attributesHtml = '<li>No attributes defined.</li>';
    if (project.attributes) {
        let attrs: Record<string, any> = {};
        if (typeof project.attributes === 'string') {
            try { attrs = JSON.parse(project.attributes); } catch (e) {}
        } else {
            // @ts-ignore
            attrs = project.attributes;
        }
        if (Object.keys(attrs).length > 0) {
            attributesHtml = Object.entries(attrs).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('');
        }
    }

    // Notes processing
    const notesHtml = project.notes 
        ? `<div class="notes-section"><h3>Notas del Proyecto</h3><p>${project.notes.replace(/\n/g, '<br>')}</p></div>` 
        : '';

    // Split points by Side
    const pointsA = points.filter(p => !p.side || p.side === 'A');
    const pointsB = points.filter(p => p.side === 'B');

    const renderBoardWithOverlays = (imgSrc: string | null, pts: Point[], width?: number, height?: number, side: 'A' | 'B' = 'A') => {
        if (!imgSrc) return '<p>No hay imagen disponible.</p>';
        
        // Calculate offset for Side B points based on Side A width
        // If Side B, the X coordinate in DB includes (WidthA + 48px gap)
        const gap = 48;
        const offset = (side === 'B' && dims?.widthA) ? (dims.widthA + gap) : 0;

        const overlays = pts.map(p => {
            // Calculate position server-side if dimensions are available
            let style = 'left: 0; top: 0; z-index: 10;';
            if (width && height && width > 0 && height > 0) {
                 const adjustedX = p.x - offset;
                 const left = (adjustedX / width) * 100;
                 const top = (p.y / height) * 100;
                 style = `left: ${left}%; top: ${top}%; z-index: 10;`;
            }
            
            return `<div class="board-overlay-point" data-x="${p.x}" data-y="${p.y}" style="${style}">${p.label}</div>`;
        }).join('');

        return `
            <div class="board-container" style="position: relative;" data-side="${side}">
                <img src="${imgSrc}" class="board-image" onload="positionOverlays(this)" style="max-width: 100%;" data-side="${side}" />
                ${overlays}
            </div>
        `;
    };

    const renderPointsList = (pts: Point[], sideLabel: string) => {
        if (pts.length === 0) return `<p>No hay puntos registrados en el ${sideLabel}.</p>`;

        return pts.map((p, index) => {
            let measurementsHtml = '<p><em>No measurements recorded.</em></p>';
            if (p.measurements && Object.keys(p.measurements).length > 0) {
                measurementsHtml = Object.entries(p.measurements).map(([type, data]) => `
                    <div style="margin-bottom: 15px; border-left: 3px solid #ddd; padding-left: 10px;">
                        <div style="font-weight: bold; text-transform: capitalize; color: #555;">${type}</div>
                        <div style="margin-top: 5px;">${renderMeasurementValue(data)}</div>
                        <div style="font-size: 10px; color: #888; margin-top: 2px;">Captured: ${data.capturedAt ? new Date(data.capturedAt).toLocaleString() : 'N/A'}</div>
                    </div>
                `).join('');
            }

            const pointX = (p.x * 1).toFixed(0); 
            const pointY = (p.y * 1).toFixed(0);

            return `
                <div class="point-section">
                    <h3>Punto ${p.label} <span style="font-size: 12px; font-weight: normal; color: #666;">(X:${pointX}, Y:${pointY})</span></h3>
                    ${p.notes ? `<p style="background: #fff3cd; padding: 10px; border-radius: 4px; font-style: italic;"><strong>Nota:</strong> ${p.notes}</p>` : ''}
                    <div style="margin-top: 10px;">
                        ${measurementsHtml}
                    </div>
                    <hr style="border: 0; border-top: 1px dashed #ddd; margin: 20px 0;">
                </div>
            `;
        }).join('');
    };

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Reporte de Diagnóstico: ${project.board_model}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #333; }
                h1, h2, h3 { color: #000; }
                h1 { font-size: 28px; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
                h2 { font-size: 22px; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 40px; background-color: #f0f0f0; padding: 10px; border-radius: 5px; }
                h3 { font-size: 18px; color: #444; }
                .project-details { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
                .project-details ul { list-style: none; padding: 0; }
                .notes-section { background-color: #fff8e1; padding: 15px; border-radius: 5px; border: 1px solid #ffeeba; margin-top: 15px; }
                .point-section { margin-bottom: 30px; page-break-inside: avoid; }
                
                /* Board Overlay Styles */
                .board-container { position: relative; display: inline-block; width: 100%; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 8px; }
                .board-image { width: 100%; height: auto; display: block; }
                .board-overlay-point { 
                    position: absolute; 
                    transform: translate(-50%, -50%); 
                    width: 24px; height: 24px; 
                    border: 2px solid #ef4444; 
                    border-radius: 50%; 
                    background: rgba(255, 255, 255, 0.8); 
                    display: flex; align-items: center; justify-content: center; 
                    font-size: 11px; font-weight: bold; color: #ef4444; 
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }

                .side-section { margin-bottom: 50px; page-break-after: always; }
                .side-section:last-child { page-break-after: auto; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; vertical-align: top; }
                th { background-color: #f2f2f2; }
                pre { margin: 0; padding: 0; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; }
            </style>
            <script>
                function positionOverlays(imgElement) {
                    const container = imgElement.parentElement;
                    const side = imgElement.getAttribute('data-side');
                    
                    const updatePositions = () => {
                        const w = imgElement.naturalWidth;
                        const h = imgElement.naturalHeight;
                        
                        // Need width of Side A to calculate offset for Side B
                        let offset = 0;
                        if (side === 'B') {
                            const imgA = document.querySelector('img[data-side="A"]');
                            if (imgA) {
                                // Critical: If Image A exists but hasn't loaded dimensions yet, we must wait.
                                if (imgA.naturalWidth === 0) return false;
                                offset = imgA.naturalWidth + 48; // 48px gap
                            }
                        }

                        if (w && h && w > 0 && h > 0) {
                            const points = container.querySelectorAll('.board-overlay-point');
                            points.forEach(pt => {
                                const rawX = parseFloat(pt.getAttribute('data-x'));
                                const y = parseFloat(pt.getAttribute('data-y'));
                                
                                const x = rawX - offset;

                                // Ensure valid coordinates
                                if (!isNaN(x) && !isNaN(y)) {
                                    pt.style.left = (x / w * 100) + '%';
                                    pt.style.top = (y / h * 100) + '%';
                                }
                            });
                            return true; 
                        }
                        return false;
                    };

                    // Try immediately
                    if (!updatePositions()) {
                        // Retry loop if dimensions not ready
                        let attempts = 0;
                        const interval = setInterval(() => {
                            attempts++;
                            if (updatePositions() || attempts > 20) {
                                clearInterval(interval);
                            }
                        }, 100);
                    }
                }

                // Also run on load just in case
                window.onload = function() {
                    document.querySelectorAll('img.board-image').forEach(img => {
                         positionOverlays(img);
                    });
                };
            </script>
        </head>
        <body>
            <h1>Reporte de Diagnóstico</h1>
            <div class="project-details">
                <h2>Información del Proyecto</h2>
                <ul>
                    <li><strong>Modelo:</strong> ${project.board_model}</li>
                    <li><strong>Tipo:</strong> ${project.board_type}</li>
                    ${attributesHtml}
                </ul>
                ${notesHtml}
                <p><i>Generado el: ${new Date().toLocaleString()}</i></p>
            </div>

            <!-- SIDE A -->
            <div class="side-section">
                <h2>Lado A (Top)</h2>
                ${renderBoardWithOverlays(imageA, pointsA, dims?.widthA, dims?.heightA, 'A')}
                ${renderPointsList(pointsA, 'Lado A')}
            </div>

            <!-- SIDE B -->
            ${ (imageB || pointsB.length > 0) ? `
            <div class="side-section">
                <h2>Lado B (Bottom)</h2>
                ${renderBoardWithOverlays(imageB, pointsB, dims?.widthB, dims?.heightB, 'B')}
                ${renderPointsList(pointsB, 'Lado B')}
            </div>
            ` : ''}
        </body>
        </html>
    `;
}
