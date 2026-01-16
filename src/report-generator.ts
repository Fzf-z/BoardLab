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
                <div class="point-label" style="left: ${left}%; top: ${top}%;" data-x-pct="${left}" data-y-pct="${top}">${p.label}</div>
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
                @page { size: landscape; margin: 0; }
                html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
                body { 
                    padding: 20px; 
                    font-family: sans-serif; 
                    background: #fff; 
                    position: relative;
                    width: fit-content;
                    box-sizing: border-box;
                }
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
                    padding: 1px 4px;
                    height: auto;
                    min-width: 14px;
                    border: 1px solid #ef4444; border-radius: 4px;
                    background: rgba(255,255,255,0.95); color: #ef4444;
                    font-size: 9px; font-weight: bold; font-family: monospace;
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
                const iterations = 600; // Increased iterations
                const padding = 2; // Increased padding between labels

                // Create nodes for Labels (Dynamic)
                const dynamicNodes = labels.map(lbl => {
                    const rect = lbl.getBoundingClientRect();
                    const parentRect = lbl.parentElement.getBoundingClientRect();
                    
                    // Improved width estimation for hidden rendering contexts
                    let w = rect.width;
                    let h = rect.height;
                    if (!w || w === 0) {
                        const textLen = lbl.textContent.length;
                        // Estimate: base 10px + 6px per char approx for 9px bold monospace
                        w = Math.max(12, textLen * 6 + 8); 
                        h = 14;
                    }
                    
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
                        width: 10, // Increased protection radius around marker (visual is 5px)
                        height: 10,
                        isStatic: true
                    };
                });

                // Combine for collision checks
                const allNodes = [...dynamicNodes, ...staticNodes];

                for (let i = 0; i < iterations; i++) {
                    // 1. Pull dynamic nodes towards anchor (Gravity)
                    // Variable Elasticity: 
                    // Start weak to allow expansion/stretching away from center to find space.
                    // Increase slightly over time but keep it elastic so they don't snap back too hard.
                    const elasticity = 0.005 + (i / iterations) * 0.01; 
                    
                    for (let node of dynamicNodes) {
                        // Hooke's Law-ish: Force proportional to distance, but kept weak
                        node.x += (node.ox - node.x) * elasticity;
                        node.y += (node.oy - node.y) * elasticity;
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
                                // Overlap detected
                                // Use vector-based repulsion to allow movement in ANY direction (360 degrees)
                                // rather than just snapping to X or Y axes.
                                
                                let fx = dx;
                                let fy = dy;
                                
                                // Avoid division by zero / perfect overlap
                                if (Math.abs(fx) < 0.1 && Math.abs(fy) < 0.1) {
                                    const angle = Math.random() * Math.PI * 2;
                                    fx = Math.cos(angle);
                                    fy = Math.sin(angle);
                                }
                                
                                // Normalize vector
                                const len = Math.hypot(fx, fy);
                                const nx = fx / len;
                                const ny = fy / len;
                                
                                // Repulsion strength: stronger if deep overlap
                                // We use a "soft" resolution over many iterations for smoother results
                                const pushFactor = 0.5; 
                                
                                const moveX = nx * pushFactor;
                                const moveY = ny * pushFactor;

                                // Apply push
                                if (nodeA.isStatic) {
                                    nodeB.x -= moveX * 2;
                                    nodeB.y -= moveY * 2;
                                } else if (nodeB.isStatic) {
                                    nodeA.x += moveX * 2;
                                    nodeA.y += moveY * 2;
                                } else {
                                    nodeA.x += moveX;
                                    nodeA.y += moveY;
                                    nodeB.x -= moveX;
                                    nodeB.y -= moveY;
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
    return generateImageExportHtml(project, points, dims);
}
