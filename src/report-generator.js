// src/report-generator.js

function generateWaveformSvg(measurementValue) {
    // The entire oscilloscope measurement object is passed in measurementValue
    if (!measurementValue || !measurementValue.waveform) return '';
    
    const { waveform, voltageScale, timeScale, triggerLevel } = measurementValue;
    const svgWidth = 450, svgHeight = 225;
    const numDivX = 10, numDivY = 8;
    const stepX = svgWidth / numDivX, stepY = svgHeight / numDivY;

    // --- Grid ---
    let gridLines = '';
    // Vertical
    for (let i = 1; i < numDivX; i++) gridLines += `<line x1="${i * stepX}" y1="0" x2="${i * stepX}" y2="${svgHeight}" stroke="#e0e0e0" stroke-width="0.5" />`;
    // Horizontal
    for (let i = 1; i < numDivY; i++) gridLines += `<line x1="0" y1="${i * stepY}" x2="${svgWidth}" y2="${i * stepY}" stroke="#e0e0e0" stroke-width="0.5" />`;
    // Center axes
    gridLines += `<line x1="${svgWidth/2}" y1="0" x2="${svgWidth/2}" y2="${svgHeight}" stroke="#d0d0d0" stroke-width="0.5" stroke-dasharray="2,2" />`;
    gridLines += `<line x1="0" y1="${svgHeight/2}" x2="${svgWidth}" y2="${svgHeight/2}" stroke="#d0d0d0" stroke-width="0.5" stroke-dasharray="2,2" />`;
    
    // --- Trigger Level ---
    const triggerY = Math.max(0, Math.min(svgHeight, svgHeight / 2 - (triggerLevel / (voltageScale * numDivY)) * svgHeight));
    gridLines += `<line x1="0" y1="${triggerY}" x2="${svgWidth}" y2="${triggerY}" stroke="orange" stroke-width="1" stroke-dasharray="4,2" />`;

    // --- Waveform ---
    const vRange = numDivY * voltageScale; // Total voltage range displayed
    const pointsStr = waveform
        .map((val, i) => {
            const x = (i / (waveform.length - 1)) * svgWidth;
            // The middle of the screen is 0V. Y increases downwards.
            const yPercent = val / vRange; 
            const y = (svgHeight / 2) - (yPercent * svgHeight);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');

    return `
        <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="background-color: #f9f9f9; border: 1px solid #ccc; border-radius: 4px; display: block; margin-top: 5px;">
            ${gridLines}
            <polyline points="${pointsStr}" fill="none" stroke="#10b981" stroke-width="1.5" />
            <text x="5" y="15" font-size="10" fill="#777">V/div: ${voltageScale}V</text>
            <text x="5" y="30" font-size="10" fill="#777">T/div: ${timeScale}ms</text>
        </svg>
    `;
}

function renderMeasurementValue(measurement) {
    if (measurement.type === 'oscilloscope') {
        return generateWaveformSvg(measurement.value);
    }
    if (typeof measurement.value === 'object' && measurement.value !== null) {
        return `<pre>${JSON.stringify(measurement.value, null, 2)}</pre>`;
    }
    return measurement.value;
}

function generateReportHtml(project, points) {
    const imageAsBase64 = project.image_data ? `data:image/png;base64,${Buffer.from(project.image_data).toString('base64')}` : '';
    const attributesHtml = project.attributes 
        ? Object.entries(project.attributes).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')
        : '<li>No attributes defined.</li>';

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
                h2 { font-size: 22px; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 40px; }
                h3 { font-size: 18px; }
                .project-details { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
                .project-details ul { list-style: none; padding: 0; }
                .point-section { margin-bottom: 30px; page-break-inside: avoid; }
                .board-image { max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 8px; margin-top: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; vertical-align: top; }
                th { background-color: #f2f2f2; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                pre { margin: 0; padding: 0; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; }
            </style>
        </head>
        <body>
            <h1>Reporte de Diagnóstico</h1>
            <div class="project-details">
                <h2>${project.board_type} - ${project.board_model}</h2>
                <ul>${attributesHtml}</ul>
                <p><i>Generado el: ${new Date().toLocaleString()}</i></p>
            </div>

            ${imageAsBase64 ? `
                <div>
                    <h2>Imagen de la Placa</h2>
                    <img src="${imageAsBase64}" class="board-image">
                </div>
            ` : ''}

            <h2>Puntos de Medición</h2>
            ${points.map(point => `
                <div class="point-section">
                    <h3>Punto: ${point.label}</h3>
                    <p>${point.notes || ''}</p>
                    ${point.measurements && Object.keys(point.measurements).length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 25%;">Tipo de Medición</th>
                                    <th>Valor</th>
                                    <th style="width: 20%;">Capturado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(point.measurements).map(([type, m]) => `
                                    <tr>
                                        <td>${type}</td>
                                        <td>${renderMeasurementValue(m)}</td>
                                        <td>${new Date(m.capturedAt).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>No hay mediciones para este punto.</p>'}
                </div>
            `).join('')}
        </body>
        </html>
    `;
}

module.exports = { generateReportHtml };

