// File: ui/vite.config.ts (Updated with mesh plugin)
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { meshTypesPlugin } from './vite-plugin-mesh-types';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		meshTypesPlugin({
			outputPath: './src/lib/generated-mesh-types.ts',
			pollInterval: 5000
		})
	],
	server: {
		fs: { allow: ['..'] }
	},
	ssr: {
		external: [
			'bun', 'node:crypto', 'node:fs', 'node:path',
			'node:os', 'node:child_process', 'node:url'
		]
	}
});