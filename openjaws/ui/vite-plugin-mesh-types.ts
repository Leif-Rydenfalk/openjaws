// File: ui/vite-plugin-mesh-types.ts
// Vite plugin for auto-generating types from live mesh

import type { Plugin } from 'vite';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export function meshTypesPlugin(options: {
    meshUrl?: string;
    outputPath?: string;
    pollInterval?: number;
} = {}): Plugin {
    const {
        outputPath = './src/lib/generated-mesh-types.ts',
        pollInterval = 10000
    } = options;

    let meshCapabilities: Map<string, any> = new Map();

    return {
        name: 'mesh-types',
        configureServer(server) {
            // Poll mesh for type updates in dev mode
            const updateTypes = async () => {
                try {
                    const res = await fetch('http://localhost:5173/_mesh/types');
                    if (res.ok) {
                        const types = await res.text();
                        const fullPath = join(process.cwd(), outputPath);

                        // Ensure directory exists
                        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
                        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

                        writeFileSync(fullPath, types);
                        console.log('[MeshTypes] Updated generated types');
                    }
                } catch (e) {
                    // Mesh might not be ready yet
                }
            };

            setInterval(updateTypes, pollInterval);
            updateTypes(); // Initial update
        }
    };
}