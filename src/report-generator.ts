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

function renderMiniWaveform(measurement: MeasurementValue): string {
    if (!measurement || !measurement.waveform || !Array.isArray(measurement.waveform) || measurement.waveform.length === 0) return '';
    const width = 120;
    const height = 40;
    const waveform = measurement.waveform;
    
    let min = Infinity, max = -Infinity;
    for (const v of waveform) {
        if (v < min) min = v;
        if (v > max) max = v;
    }
    const range = max - min || 1;
    
    const pointsStr = waveform.map((val, i) => {
        const x = (i / (waveform.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background: #111; border-radius: 2px; display:block; margin-top:2px;">
        <polyline points="${pointsStr}" fill="none" stroke="#4ade80" stroke-width="1" />
    </svg>`;
}

export function generateImageExportHtml(project: Project, points: Point[], dims?: { widthA: number, heightA: number, widthB?: number, heightB?: number }): string {
    const imageA = project.image_data ? `data:image/png;base64,${bufferToBase64(project.image_data)}` : null;
    const imageB = project.image_data_b ? `data:image/png;base64,${bufferToBase64(project.image_data_b)}` : null;

    const pointsA = points.filter(p => !p.side || p.side === 'A');
    const pointsB = points.filter(p => p.side === 'B');

    const renderMiniTable = (pts: Point[], title: string, side: 'A' | 'B') => {
        if (pts.length === 0) return `<div class="table-container empty"><h3>${title}</h3><p>No Data</p></div>`;
        
        const rows = pts.map((p, i) => {
             const idx = i + 1;
             const measurements = p.measurements ? Object.entries(p.measurements) : [];
             const rowId = `row-${side}-${idx}`;
             
             if (measurements.length === 0) {
                 return `<tr id="${rowId}" style="border-bottom: 1px solid #ccc;">
                    <td style="font-weight:bold; color:#333; padding: 4px 8px;">${idx}</td>
                    <td style="font-size:11px; padding: 4px 8px;">${p.label}</td>
                    <td style="color:#aaa; font-size:10px; padding: 4px 8px;">${p.type.substring(0,4)}</td>
                    <td style="color:#aaa; padding: 4px 8px;">-</td>
                 </tr>`;
             }

             return measurements.map((entry, index) => {
                 const [type, m] = entry;
                 let displayVal = '-';
                 
                 if (m.type === 'oscilloscope') {
                     const vpp = m.vpp ? `${Number(m.vpp).toFixed(2)}Vpp` : '';
                     const freq = m.freq ? `${Number(m.freq).toFixed(2)}Hz` : '';
                     const txt = [vpp, freq].filter(Boolean).join(' ') || 'Waveform';
                     displayVal = `<div>${txt}${renderMiniWaveform(m)}</div>`;
                 } else if (m.value) {
                     if (typeof m.value === 'object') {
                         displayVal = 'Data';
                     } else {
                         displayVal = String(m.value);
                     }
                 }

                 const isLast = index === measurements.length - 1;
                 const rowStyle = isLast ? 'border-bottom: 1px solid #999;' : 'border-bottom: 1px dotted #ddd;';
                 
                 let labelCell = '';
                 if (index === 0) {
                     labelCell = `<td rowspan="${measurements.length}" style="font-weight:bold; color:#2563eb; vertical-align:middle; background:#fff; padding: 4px 8px; border-right: 1px solid #eee;">${idx}</td>
                                  <td rowspan="${measurements.length}" style="font-size:11px; vertical-align:middle; padding: 4px 8px;">${p.label}</td>`;
                 }

                 return `<tr id="${index === 0 ? rowId : ''}" style="${rowStyle} background: #fff;">
                    ${labelCell}
                    <td style="font-size:10px; color:#555; text-transform:uppercase; padding: 4px 8px;">${type.substring(0,4)}</td>
                    <td style="font-family:monospace; font-weight:bold; font-size:11px; padding: 4px 8px;">${displayVal}</td>
                 </tr>`;
             }).join('');
        }).join('');

        return `
            <div class="table-container">
                <h3>${title}</h3>
                <table cellspacing="0" cellpadding="0">
                    <thead><tr><th style="width:25px;">#</th><th>Pt</th><th style="width:35px;">Type</th><th>Value</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    };

    const renderBoardOverlay = (imgSrc: string | null, pts: Point[], width?: number, height?: number, side: 'A' | 'B' = 'A') => {
        if (!imgSrc) return '';
        // Same offset logic as report
        const gap = 98;
        const offset = (side === 'B' && dims?.widthA) ? (dims.widthA + gap) : 0;

        const overlays = pts.map((p, i) => {
            let left = 0, top = 0;
            const idx = i + 1;
            if (width && height && width > 0 && height > 0) {
                 const adjustedX = p.x - offset;
                 left = (adjustedX / width) * 100;
                 top = (p.y / height) * 100;
            }
            // data-x-pct and data-y-pct used by physics engine
            return `
                <div class="point-marker" style="left: ${left}%; top: ${top}%;"></div>
                <div class="point-label" style="left: ${left}%; top: ${top}%;" data-x-pct="${left}" data-y-pct="${top}">${idx}</div>
            `;
        }).join('');

        return `
            <div class="board-wrapper">
                <div class="board-title">${side === 'A' ? 'TOP SIDE' : 'BOTTOM SIDE'}</div>
                <div class="board-img-container">
                    <img src="${imgSrc}" />
                    ${overlays}
                </div>
            </div>
        `;
    };

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { margin: 0; padding: 20px; font-family: sans-serif; background: #fff; width: fit-content; position: relative; }
                .layout-container { display: flex; gap: 20px; align-items: flex-start; }
                
                .side-tables { display: flex; flex-direction: column; gap: 20px; width: 300px; flex-shrink: 0; }
                /* Images side-by-side */
                .center-images { display: flex; flex-direction: row; gap: 20px; align-items: flex-start; }
                
                .table-container { border: 2px solid #333; border-radius: 8px; overflow: hidden; background: #f9fafb; }
                .table-container h3 { background: #333; color: #fff; margin: 0; padding: 10px; text-align: center; text-transform: uppercase; font-size: 14px; }
                .table-container table { width: 100%; border-collapse: collapse; font-size: 12px; }
                .table-container th { background: #e5e7eb; text-align: left; padding: 5px 8px; font-size: 10px; text-transform: uppercase; color: #555; }
                .table-container td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
                .table-container tr:last-child td { border-bottom: none; }
                .table-container.empty { border: 2px dashed #ccc; color: #888; text-align: center; padding: 20px; }

                .board-wrapper { position: relative; border: 4px solid #333; border-radius: 12px; padding: 10px; background: #eee; }
                .board-title { position: absolute; top: -12px; left: 20px; background: #333; color: white; padding: 2px 10px; font-weight: bold; font-size: 12px; border-radius: 4px; }
                .board-img-container { position: relative; display: inline-block; }
                .board-img-container img { display: block; max-height: 800px; width: auto; } /* Limit height */
                
                .overlay-point {
                    position: absolute; transform: translate(-50%, -50%);
                    min-width: 14px; height: 14px; padding: 1px 4px;
                    border: 2px solid #ef4444; border-radius: 10px;
                    background: rgba(255,255,255,0.95); color: #ef4444;
                    font-size: 9px; font-weight: bold;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.4);
                    white-space: nowrap;
                    z-index: 10;
                }

                .header { margin-bottom: 20px; border-bottom: 4px solid #333; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
                .header h1 { margin: 0; font-size: 32px; text-transform: uppercase; letter-spacing: 2px; }
                .header .meta { text-align: right; font-size: 14px; color: #666; }
                
                /* Marker: Fixed Dot */
                .point-marker {
                    position: absolute; transform: translate(-50%, -50%);
                    width: 5px; height: 5px;
                    background: #ef4444; border: 1px solid white;
                    border-radius: 50%;
                    z-index: 20;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.3);
                }
                
                /* Label: Floating Number */
                .point-label {
                    position: absolute; transform: translate(-50%, -50%);
                    padding: 0 2px;
                    height: 12px;
                    min-width: 12px;
                    border: 1px solid #ef4444; border-radius: 6px;
                    background: rgba(255,255,255,0.95); color: #ef4444;
                    font-size: 8px; font-weight: bold; font-family: monospace;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                    white-space: nowrap;
                    z-index: 30;
                    cursor: default;
                }

                #leader-lines { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 15; }
                .leader-line { stroke: #ef4444; stroke-width: 1px; opacity: 0.7; fill: none; }
            </style>
            <script>
            function resolveOverlaps() {
                const labels = Array.from(document.querySelectorAll('.point-label'));
                const markers = Array.from(document.querySelectorAll('.point-marker'));
                
                if (labels.length === 0) return;

                // Physics simulation settings
                const iterations = 400;
                const padding = 2; 

                // Create nodes for Labels (Dynamic)
                const dynamicNodes = labels.map(lbl => {
                    const rect = lbl.getBoundingClientRect();
                    const parentRect = lbl.parentElement.getBoundingClientRect();
                    const w = rect.width || 14; 
                    const h = rect.height || 14;
                    
                    const originX = parseFloat(lbl.getAttribute('data-x-pct')) / 100 * parentRect.width;
                    const originY = parseFloat(lbl.getAttribute('data-y-pct')) / 100 * parentRect.height;
                    
                    return {
                        element: lbl,
                        x: originX,
                        y: originY,
                        ox: originX, // Original Anchor X
                        oy: originY, // Original Anchor Y
                        width: w,
                        height: h,
                        isStatic: false
                    };
                });

                // Create nodes for Markers (Static obstacles)
                const staticNodes = markers.map(mk => {
                    const parentRect = mk.parentElement.getBoundingClientRect();
                    // Markers use inline style left/top %
                    const leftPct = parseFloat(mk.style.left);
                    const topPct = parseFloat(mk.style.top);
                    
                    return {
                        x: leftPct / 100 * parentRect.width,
                        y: topPct / 100 * parentRect.height,
                        width: 8, // Marker size + safety margin
                        height: 8,
                        isStatic: true
                    };
                });

                // Combine for collision checks
                const allNodes = [...dynamicNodes, ...staticNodes];

                for (let i = 0; i < iterations; i++) {
                    // 1. Pull dynamic nodes towards anchor (Gravity)
                    for (let node of dynamicNodes) {
                        node.x += (node.ox - node.x) * 0.03;
                        node.y += (node.oy - node.y) * 0.03;
                    }

                    // 2. Resolve Collisions
                    for (let a = 0; a < allNodes.length; a++) {
                        for (let b = a + 1; b < allNodes.length; b++) {
                            const nodeA = allNodes[a];
                            const nodeB = allNodes[b];

                            // Skip if both static (markers don't move each other)
                            if (nodeA.isStatic && nodeB.isStatic) continue;

                            const dx = nodeA.x - nodeB.x;
                            const dy = nodeA.y - nodeB.y;
                            
                            const spacingX = (nodeA.width + nodeB.width) / 2 + padding;
                            const spacingY = (nodeA.height + nodeB.height) / 2 + padding;

                            if (Math.abs(dx) < spacingX && Math.abs(dy) < spacingY) {
                                const overlapX = spacingX - Math.abs(dx);
                                const overlapY = spacingY - Math.abs(dy);

                                let moveX = 0, moveY = 0;

                                // Determine push vector
                                if (overlapX < overlapY) {
                                    const dir = (Math.abs(dx) < 0.1) ? (Math.random() > 0.5 ? 1 : -1) : (dx > 0 ? 1 : -1);
                                    moveX = overlapX * dir;
                                } else {
                                    const dir = (Math.abs(dy) < 0.1) ? (Math.random() > 0.5 ? 1 : -1) : (dy > 0 ? 1 : -1);
                                    moveY = overlapY * dir;
                                }

                                // Apply push
                                if (nodeA.isStatic) {
                                    // A is static, B moves full amount away
                                    nodeB.x -= moveX;
                                    nodeB.y -= moveY;
                                } else if (nodeB.isStatic) {
                                    // B is static, A moves full amount away
                                    nodeA.x += moveX;
                                    nodeA.y += moveY;
                                } else {
                                    // Both dynamic, share the move
                                    nodeA.x += moveX / 2;
                                    nodeA.y += moveY / 2;
                                    nodeB.x -= moveX / 2;
                                    nodeB.y -= moveY / 2;
                                }
                            }
                        }
                    }
                }

                // Apply positions and draw lines
                const svg = document.getElementById('leader-lines');
                if(!svg) return;
                
                const bodyW = Math.max(document.body.scrollWidth, document.body.offsetWidth, document.documentElement.offsetWidth);
                const bodyH = Math.max(document.body.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight);
                svg.style.width = bodyW + 'px';
                svg.style.height = bodyH + 'px';
                svg.setAttribute('width', bodyW);
                svg.setAttribute('height', bodyH);
                svg.innerHTML = '';

                dynamicNodes.forEach(node => {
                    node.element.style.left = node.x + 'px';
                    node.element.style.top = node.y + 'px';
                    
                    const dist = Math.hypot(node.x - node.ox, node.y - node.oy);
                    if (dist > 4) { // Draw line if moved noticeable amount
                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        const containerRect = node.element.parentElement.getBoundingClientRect();
                        
                        const absX1 = containerRect.left + node.ox + window.scrollX;
                        const absY1 = containerRect.top + node.oy + window.scrollY;
                        const absX2 = containerRect.left + node.x + window.scrollX;
                        const absY2 = containerRect.top + node.y + window.scrollY;

                        path.setAttribute('x1', absX1);
                        path.setAttribute('y1', absY1);
                        path.setAttribute('x2', absX2);
                        path.setAttribute('y2', absY2);
                        path.classList.add('leader-line');
                        svg.appendChild(path);
                    }
                });
            }

            window.onload = () => { 
                resolveOverlaps();
                setTimeout(resolveOverlaps, 100);
                setTimeout(resolveOverlaps, 500);
            };
            </script>
        </head>
        <body>
            <svg id="leader-lines"></svg>
            <div class="header">
                <h1>${project.board_model}</h1>
                <div class="meta">
                    <div>${project.board_type}</div>
                    <div>${new Date().toLocaleDateString()}</div>
                </div>
            </div>

            <div class="layout-container">
                <!-- Left: Side A Table -->
                <div class="side-tables">
                    ${renderMiniTable(pointsA, 'Top Side Points', 'A')}
                </div>

                <!-- Center: Images -->
                <div class="center-images">
                    ${renderBoardOverlay(imageA, pointsA, dims?.widthA, dims?.heightA, 'A')}
                    ${renderBoardOverlay(imageB, pointsB, dims?.widthB, dims?.heightB, 'B')}
                </div>

                <!-- Right: Side B Table -->
                <div class="side-tables">
                     ${renderMiniTable(pointsB, 'Bottom Side Points', 'B')}
                </div>
            </div>
        </body>
        </html>
    `;
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
        // If Side B, the X coordinate in DB includes (WidthA + 48px margin + 2px border + 48px padding) = 98px gap
        const gap = 98;
        const offset = (side === 'B' && dims?.widthA) ? (dims.widthA + gap) : 0;

        const overlays = pts.map((p, i) => {
            // Calculate position server-side if dimensions are available
            let style = 'left: 0; top: 0; z-index: 10;';
            if (width && height && width > 0 && height > 0) {
                 const adjustedX = p.x - offset;
                 const left = (adjustedX / width) * 100;
                 const top = (p.y / height) * 100;
                 style = `left: ${left}%; top: ${top}%; z-index: 10;`;
            }
            
            return `<div class="board-overlay-point" data-x="${p.x}" data-y="${p.y}" style="${style}">${i + 1}</div>`;
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

        return pts.map((p, i) => {
            const idx = i + 1;
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
                    <h3>#${idx} - ${p.label} <span style="font-size: 12px; font-weight: normal; color: #666;">(X:${pointX}, Y:${pointY})</span></h3>
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
                    min-width: 16px; height: 16px; 
                    padding: 1px 4px;
                    border: 2px solid #ef4444; 
                    border-radius: 10px; 
                    background: rgba(255, 255, 255, 0.95); 
                    display: flex; align-items: center; justify-content: center; 
                    font-size: 10px; font-weight: bold; color: #ef4444; 
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                    white-space: nowrap;
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
                                offset = imgA.naturalWidth + 98; // 98px gap (matches BoardView layout)
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
                                    // Sort z-index by Y to improve stacking (lower points on top)
                                    pt.style.zIndex = Math.floor(y);
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
