// Helper for buffer handling if environment differs
const bufferToBase64 = (buffer) => {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(buffer).toString('base64');
    } else {
        let binary = '';
        const len = buffer.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(buffer[i]);
        }
        return window.btoa(binary);
    }
};

function generateWaveformSvg(measurement) {
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
    const vRange = numDivY * (voltageScale || 1);
    const vBottom = (voltageOffset || 0) - (vRange / 2);

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

function renderMeasurementValue(measurement) {
    if (measurement.type === 'oscilloscope') {
        return generateWaveformSvg(measurement); 
    }
    if (typeof measurement.value === 'object' && measurement.value !== null) {
        return `<pre>${JSON.stringify(measurement.value, null, 2)}</pre>`;
    }
    return measurement.value;
}

function generateReportHtml(project, points) {
    const imageAsBase64 = project.image_data 
        ? `data:image/png;base64,${bufferToBase64(project.image_data)}` 
        : '';
    
    let attributesHtml = '<li>No attributes defined.</li>';
    if (project.attributes) {
        let attrs = {};
        if (typeof project.attributes === 'string') {
            try { attrs = JSON.parse(project.attributes); } catch (e) {}
        } else {
            attrs = project.attributes;
        }
        attributesHtml = Object.entries(attrs).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('');
    }

    const pointsHtml = points.map((p, index) => {
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
                <h3>Point ${index + 1}: ${p.label} <span style="font-size: 12px; font-weight: normal; color: #666;">(X:${pointX}, Y:${pointY})</span></h3>
                ${p.notes ? `<p style="background: #fff3cd; padding: 10px; border-radius: 4px; font-style: italic;"><strong>Note:</strong> ${p.notes}</p>` : ''}
                <div style="margin-top: 10px;">
                    ${measurementsHtml}
                </div>
                <hr style="border: 0; border-top: 1px dashed #ddd; margin: 20px 0;">
            </div>
        `;
    }).join('');

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

            <h2>Imagen de la Placa</h2>
            ${imageAsBase64 ? `<img src="${imageAsBase64}" class="board-image" />` : '<p>No image available.</p>'}

            <h2>Puntos de Medición</h2>
            ${pointsHtml || '<p>No measurement points recorded.</p>'}
        </body>
        </html>
    `;
}

module.exports = { generateReportHtml };

