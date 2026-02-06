/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{html,js,svelte,ts}'],
    theme: {
        extend: {
            colors: {
                system: {
                    950: '#050505',
                    900: '#0a0a0a',
                    800: '#111111',
                    accent: '#00ffaa',
                }
            }
        },
    },
    plugins: [],
}