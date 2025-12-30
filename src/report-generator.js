// src/report-generator.js

function generateWaveformSvg(measurement) {
    if (!measurement || !measurement.oscilograma) return '';
    
    const data = JSON.parse(measurement.oscilograma);
    const { waveform, voltageScale, voltageOffset } = data;

    if (!waveform) return '';

    const svgWidth = 400, svgHeight = 200;
    const numDivX = 10, numDivY = 8;
    const stepX = svgWidth / numDivX, stepY = svgHeight / numDivY;

    let gridLines = '';
    for (let i = 1; i < numDivX; i++) gridLines += `<line x1="${i * stepX}" y1="0" x2="${i * stepX}" y2="${svgHeight}" stroke="#e0e0e0" stroke-width="0.5" />`;
    for (let i = 1; i < numDivY; i++) gridLines += `<line x1="0" y1="${i * stepY}" x2="${svgWidth}" y2="${i * stepY}" stroke="#e0e0e0" stroke-width="0.5" />`;
    gridLines += `<line x1="0" y1="${svgHeight/2}" x2="${svgWidth}" y2="${svgHeight/2}" stroke="#a0a0a0" stroke-width="0.5" />`;

    const vRange = numDivY * voltageScale;
    const vBottom = voltageOffset - (vRange / 2);
    const pointsStr = waveform
        .map((val, i) => {
            const x = (i / (waveform.length - 1)) * svgWidth;
            const yPercent = vRange === 0 ? 0.5 : (val - vBottom) / vRange;
            const y = Math.max(0, Math.min(svgHeight, svgHeight - (yPercent * svgHeight)));
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');

    return `
        <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="background-color: #f9f9f9; border: 1px solid #ccc; border-radius: 4px;">
            ${gridLines}
            <polyline points="${pointsStr}" fill="none" stroke="#10b981" stroke-width="1.5" />
        </svg>
    `;
}

function generateReportHtml(project, points) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Reporte de Diagnóstico: ${project.nombre}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #333; }
                h1, h2, h3 { color: #000; }
                h1 { font-size: 28px; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
                h2 { font-size: 22px; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 40px; }
                h3 { font-size: 18px; }
                .project-details { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
                .point-section { margin-bottom: 30px; page-break-inside: avoid; }
                .board-image { max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                tr:nth-child(even) { background-color: #f9f9f9; }
            </style>
        </head>
        <body>
            <h1>Reporte de Diagnóstico</h1>
            <div class="project-details">
                <h2>${project.nombre}</h2>
                <p>${project.descripcion || 'Sin descripción.'}</p>
                <p><i>Generado el: ${new Date().toLocaleString()}</i></p>
            </div>

            ${project.imagenPlaca ? `
                <div>
                    <h2>Imagen de la Placa</h2>
                    <img src="${project.imagenPlaca}" class="board-image">
                </div>
            ` : ''}

            <h2>Puntos de Medición</h2>
            ${points.map(point => `
                <div class="point-section">
                    <h3>Punto: ${point.nombre}</h3>
                    ${point.measurements && point.measurements.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Tipo</th>
                                    <th>Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${point.measurements.map(m => `
                                    <tr>
                                        <td>${new Date(m.timestamp).toLocaleString()}</td>
                                        <td>${m.tipo}</td>
                                        <td>${m.tipo === 'oscilloscope' ? generateWaveformSvg(m) : m.valor}</td>
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
