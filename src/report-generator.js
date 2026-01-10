// src/report-generator.js

function generateWaveformSvg(measurement) {
    // Check if we have valid waveform data
    if (!measurement || !measurement.waveform || !Array.isArray(measurement.waveform)) return 'No waveform data';
    
    const { waveform, voltageScale, voltageOffset, timeScale, vpp, freq } = measurement;
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
    // Calculate vertical scaling based on voltage settings
    const vRange = numDivY * voltageScale;
    const vBottom = voltageOffset - (vRange / 2);

    const pointsStr = waveform
        .map((val, i) => {
            const x = (i / (waveform.length - 1)) * svgWidth;
            // Map voltage value to Y coordinate (0 at top, height at bottom)
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

function renderMeasurementValue(measurement) {
    if (measurement.type === 'oscilloscope') {
        // Pass the raw measurement object which contains the waveform array and metadata
        return generateWaveformSvg(measurement); 
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
                    <div style="position: relative; display: inline-block;">
                        <img src="${imageAsBase64}" class="board-image" style="max-width: 100%;">
                        ${points.map(p => `
                            <div style="position: absolute; left: ${p.x}px; top: ${p.y}px; transform: translate(-50%, -50%); background-color: rgba(255, 255, 0, 0.8); border: 2px solid black; border-radius: 4px; padding: 2px 5px; font-size: 10px; font-weight: bold; pointer-events: none;">
                                ${p.label || (typeof p.id === 'number' ? p.id : 'N')}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <h2>Puntos de Medición</h2>
            ${points.map(point => {
                // Filter and sort measurements based on fixed order
                const orderedTypes = ['voltage', 'resistance', 'diode', 'oscilloscope'];
                const measurementsToRender = orderedTypes
                    .map(type => ({ type, data: point.measurements && point.measurements[type] }))
                    .filter(item => item.data); // Only keep existing measurements

                return `
                <div class="point-section">
                    <h3>Punto: ${point.label}</h3>
                    ${measurementsToRender.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 25%;">Tipo de Medición</th>
                                    <th>Valor</th>
                                    <th style="width: 20%;">Capturado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${measurementsToRender.map(({ type, data }) => `
                                    <tr>
                                        <td style="text-transform: capitalize;">${type}</td>
                                        <td>${renderMeasurementValue(data)}</td>
                                        <td>${new Date(data.capturedAt).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                                ${point.notes ? `
                                    <tr>
                                        <td><strong>Notes</strong></td>
                                        <td colspan="2" style="font-style: italic; background-color: #fffbeb;">${point.notes}</td>
                                    </tr>
                                ` : ''}
                            </tbody>
                        </table>
                    ` : '<p>No hay mediciones para este punto.</p>'}
                </div>
            `;}).join('')}
        </body>
        </html>
    `;
}

module.exports = { generateReportHtml };

