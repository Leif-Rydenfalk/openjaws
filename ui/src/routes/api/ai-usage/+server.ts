// ui/src/routes/api/ai-usage/+server.ts
import { json } from '@sveltejs/kit';
import { TypedRheoCell } from '../../../../../protocols/typed-mesh';

let serverCell: TypedRheoCell;
if (!(globalThis as any)._serverCell) {
    serverCell = new TypedRheoCell(`API_Server_${process.pid}`, 0);
    serverCell.listen();
    (globalThis as any)._serverCell = serverCell;
} else {
    serverCell = (globalThis as any)._serverCell;
}

export async function GET() {
    try {
        const result = await serverCell.askMesh("ai/usage" as any);

        if (result.ok && result.value) {
            return json(result.value);
        } else {
            return json({
                totalCalls: 0,
                totalTokens: 0,
                lastHourTokens: 0,
                avgTokensPerCall: 0
            });
        }
    } catch (e: any) {
        return json({
            totalCalls: 0,
            totalTokens: 0,
            lastHourTokens: 0,
            avgTokensPerCall: 0,
            error: e.message
        }, { status: 500 });
    }
}