/**
 * ORBITAL VISUALIZATION UI
 * Real-time 3D celestial mechanics visualization
 * Path: /home/asdfghj/openjaws/orbital-ui/index.ts
 */

import { TypedRheoCell } from "../protocols/example1/typed-mesh";

const PORT = 5141;
const cell = new TypedRheoCell(`ORBITAL_UI_${process.pid}`, 0);

const UI_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orbital Mechanics Simulator</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        
        body {
            margin: 0;
            overflow: hidden;
            background: #000;
            font-family: 'Space Mono', monospace;
            color: #00ff88;
        }

        #canvas-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }

        .panel {
            position: fixed;
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #00ff88;
            border-radius: 4px;
            padding: 16px;
            backdrop-filter: blur(10px);
        }

        .top-panel {
            top: 20px;
            left: 20px;
            right: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .control-panel {
            bottom: 20px;
            left: 20px;
            right: 20px;
        }

        .btn {
            background: #001a0f;
            border: 1px solid #00ff88;
            color: #00ff88;
            padding: 8px 16px;
            cursor: pointer;
            font-family: 'Space Mono', monospace;
            font-size: 12px;
            transition: all 0.2s;
        }

        .btn:hover {
            background: #00ff88;
            color: #000;
        }

        .btn.active {
            background: #00ff88;
            color: #000;
        }

        .stat {
            font-size: 11px;
            margin: 4px 0;
        }

        .stat-label {
            color: #00aa66;
            display: inline-block;
            width: 120px;
        }

        .slider-container {
            margin: 10px 0;
        }

        .slider {
            width: 100%;
            height: 4px;
            background: #001a0f;
            outline: none;
            border: 1px solid #00ff88;
        }

        .slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            background: #00ff88;
            cursor: pointer;
        }

        .trajectory-line {
            stroke: #00ff88;
            stroke-width: 1;
            fill: none;
            opacity: 0.5;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .loading {
            animation: pulse 1.5s infinite;
        }
    </style>
</head>
<body>
    <div id="canvas-container">
        <canvas id="canvas"></canvas>
    </div>

    <div class="panel top-panel">
        <div>
            <h1 class="text-lg font-bold mb-2">🌌 ORBITAL MECHANICS</h1>
            <div id="stats" class="text-xs">
                <div class="stat"><span class="stat-label">Bodies:</span><span id="stat-bodies">0</span></div>
                <div class="stat"><span class="stat-label">Sim Time:</span><span id="stat-time">0.0s</span></div>
                <div class="stat"><span class="stat-label">Total Energy:</span><span id="stat-energy">0.0 J</span></div>
                <div class="stat"><span class="stat-label">Center of Mass:</span><span id="stat-com">(0, 0, 0)</span></div>
            </div>
        </div>
        
        <div>
            <select id="preset-select" class="btn mb-2 w-48">
                <option value="">Select Preset</option>
                <option value="solar_system">Solar System</option>
                <option value="earth_moon">Earth-Moon</option>
                <option value="binary_star">Binary Star</option>
            </select>
            <button id="create-btn" class="btn w-48 block">Create Simulation</button>
        </div>
    </div>

    <div class="panel control-panel">
        <div class="flex gap-4 items-center flex-wrap">
            <button id="play-btn" class="btn">▶ Play</button>
            <button id="pause-btn" class="btn">⏸ Pause</button>
            <button id="step-btn" class="btn">⏭ Step</button>
            <button id="reset-view-btn" class="btn">🔄 Reset View</button>
            
            <div class="flex-grow"></div>
            
            <div class="slider-container flex items-center gap-2">
                <label class="text-xs">Speed:</label>
                <input type="range" id="speed-slider" class="slider w-32" min="1" max="100" value="10">
                <span id="speed-display" class="text-xs w-16">10x</span>
            </div>
            
            <div class="slider-container flex items-center gap-2">
                <label class="text-xs">Zoom:</label>
                <input type="range" id="zoom-slider" class="slider w-32" min="1" max="100" value="50">
            </div>
        </div>
    </div>

    <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
        let simulation = null;
        let animationId = null;
        let isPlaying = false;
        let viewOffset = { x: 0, y: 0 };
        let zoom = 1.0;
        let rotation = 0;
        let isDragging = false;
        let lastMouse = { x: 0, y: 0 };
        
        // Canvas setup
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Mouse controls
        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastMouse = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                viewOffset.x += (e.clientX - lastMouse.x);
                viewOffset.y += (e.clientY - lastMouse.y);
                lastMouse = { x: e.clientX, y: e.clientY };
            }
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            zoom *= delta;
            zoom = Math.max(0.01, Math.min(10, zoom));
            document.getElementById('zoom-slider').value = zoom * 50;
        });

        // Create simulation
        document.getElementById('create-btn').addEventListener('click', async () => {
            const preset = document.getElementById('preset-select').value;
            if (!preset) {
                alert('Please select a preset');
                return;
            }

            try {
                const response = await fetch('/api/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        name: preset + ' simulation',
                        preset: preset,
                        dt: 3600 // 1 hour time step
                    })
                });

                simulation = await response.json();
                console.log('Simulation created:', simulation);
                
                // Reset view
                viewOffset = { x: canvas.width / 2, y: canvas.height / 2 };
                zoom = 1.0;
                
                updateStats();
            } catch (e) {
                console.error('Failed to create simulation:', e);
                alert('Failed to create simulation');
            }
        });

        // Controls
        document.getElementById('play-btn').addEventListener('click', () => {
            isPlaying = true;
            document.getElementById('play-btn').classList.add('active');
            document.getElementById('pause-btn').classList.remove('active');
            animate();
        });

        document.getElementById('pause-btn').addEventListener('click', () => {
            isPlaying = false;
            document.getElementById('pause-btn').classList.add('active');
            document.getElementById('play-btn').classList.remove('active');
        });

        document.getElementById('step-btn').addEventListener('click', async () => {
            if (!simulation) return;
            await stepSimulation(10);
        });

        document.getElementById('reset-view-btn').addEventListener('click', () => {
            viewOffset = { x: canvas.width / 2, y: canvas.height / 2 };
            zoom = 1.0;
            rotation = 0;
            document.getElementById('zoom-slider').value = 50;
        });

        document.getElementById('speed-slider').addEventListener('input', (e) => {
            document.getElementById('speed-display').textContent = e.target.value + 'x';
        });

        document.getElementById('zoom-slider').addEventListener('input', (e) => {
            zoom = e.target.value / 50;
        });

        // Step simulation
        async function stepSimulation(steps = 1) {
            if (!simulation) return;

            try {
                const response = await fetch('/api/step', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        simulation_id: simulation.id,
                        steps: steps
                    })
                });

                simulation = await response.json();
                updateStats();
            } catch (e) {
                console.error('Step failed:', e);
            }
        }

        // Update stats display
        async function updateStats() {
            if (!simulation) return;

            try {
                const response = await fetch('/api/stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ simulation_id: simulation.id })
                });

                const stats = await response.json();
                
                document.getElementById('stat-bodies').textContent = stats.body_count;
                document.getElementById('stat-time').textContent = formatTime(stats.time_elapsed);
                document.getElementById('stat-energy').textContent = stats.total_energy.toExponential(2) + ' J';
                document.getElementById('stat-com').textContent = 
                    \`(\${(stats.center_of_mass.x / 1e9).toFixed(1)}, \${(stats.center_of_mass.y / 1e9).toFixed(1)}, \${(stats.center_of_mass.z / 1e9).toFixed(1)}) Gm\`;
            } catch (e) {
                console.error('Stats update failed:', e);
            }
        }

        function formatTime(seconds) {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            if (days > 0) return \`\${days}d \${hours}h\`;
            if (hours > 0) return \`\${hours}h\`;
            return \`\${Math.floor(seconds / 60)}m\`;
        }

        // Rendering
        function worldToScreen(pos) {
            // Simple 2D projection (X-Y plane)
            const scale = zoom * Math.min(canvas.width, canvas.height) / 4e11; // Scale to fit ~2 AU
            
            return {
                x: viewOffset.x + pos.x * scale,
                y: viewOffset.y + pos.y * scale
            };
        }

        function draw() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (!simulation) {
                ctx.fillStyle = '#00ff88';
                ctx.font = '14px Space Mono';
                ctx.textAlign = 'center';
                ctx.fillText('Select a preset and click Create Simulation', canvas.width / 2, canvas.height / 2);
                return;
            }

            // Draw grid
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
            ctx.lineWidth = 1;
            const gridSize = 50;
            for (let x = 0; x < canvas.width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            // Draw bodies
            simulation.bodies.forEach(body => {
                const screen = worldToScreen(body.position);
                
                // Draw body
                const radius = Math.max(3, Math.log10(body.mass) * 2 * zoom);
                ctx.fillStyle = body.color || '#00ff88';
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
                ctx.fill();

                // Draw glow
                const gradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius * 3);
                gradient.addColorStop(0, body.color || '#00ff88');
                gradient.addColorStop(1, 'transparent');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, radius * 3, 0, Math.PI * 2);
                ctx.fill();

                // Draw label
                ctx.fillStyle = '#00ff88';
                ctx.font = '10px Space Mono';
                ctx.textAlign = 'center';
                ctx.fillText(body.name, screen.x, screen.y - radius - 5);

                // Draw velocity vector
                const velScreen = worldToScreen({
                    x: body.position.x + body.velocity.x * 1e5,
                    y: body.position.y + body.velocity.y * 1e5,
                    z: 0
                });
                ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(screen.x, screen.y);
                ctx.lineTo(velScreen.x, velScreen.y);
                ctx.stroke();
            });
        }

        // Animation loop
        async function animate() {
            if (!isPlaying) return;

            const speed = parseInt(document.getElementById('speed-slider').value);
            await stepSimulation(speed);
            
            draw();
            
            animationId = requestAnimationFrame(animate);
        }

        // Render loop (always running for smooth interaction)
        function render() {
            draw();
            requestAnimationFrame(render);
        }
        render();
    </script>
</body>
</html>
`;

Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/") {
            return new Response(UI_HTML, { headers: { "Content-Type": "text/html" } });
        }

        if (url.pathname === "/api/create") {
            const body = await req.json();

            try {
                const result = await cell.mesh.orbital.create(body);
                return Response.json(result);
            } catch (e: any) {
                return Response.json({ error: e.message }, { status: 500 });
            }
        }

        if (url.pathname === "/api/step") {
            const body = await req.json();

            try {
                const result = await cell.mesh.orbital.step(body);
                return Response.json(result);
            } catch (e: any) {
                return Response.json({ error: e.message }, { status: 500 });
            }
        }

        if (url.pathname === "/api/state") {
            const body = await req.json();

            try {
                const result = await cell.mesh.orbital.state(body);
                return Response.json(result);
            } catch (e: any) {
                return Response.json({ error: e.message }, { status: 500 });
            }
        }

        if (url.pathname === "/api/stats") {
            const body = await req.json();

            try {
                const result = await cell.mesh.orbital.stats(body);
                return Response.json(result);
            } catch (e: any) {
                return Response.json({ error: e.message }, { status: 500 });
            }
        }

        if (url.pathname === "/api/predict") {
            const body = await req.json();

            try {
                const result = await cell.mesh.orbital.predict(body);
                return Response.json(result);
            } catch (e: any) {
                return Response.json({ error: e.message }, { status: 500 });
            }
        }

        return new Response("Not Found", { status: 404 });
    }
});

cell.log("INFO", `🌌 Orbital Visualization UI online at http://localhost:${PORT}`);
cell.listen();