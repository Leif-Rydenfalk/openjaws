import { json } from '@sveltejs/kit';

export async function POST({ request, locals }) {
    const { capability, args } = await request.json();
    const result = await locals.cell.askMesh(capability, args);
    return json(result);
}