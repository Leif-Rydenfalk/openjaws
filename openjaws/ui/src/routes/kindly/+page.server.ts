import { TypedRheoCell } from '../../../../protocols/typed-mesh';

let serverCell: TypedRheoCell;
if (!(globalThis as any)._serverCell) {
    serverCell = new TypedRheoCell(`Kindly_Proxy`, 0);
    serverCell.listen();
    (globalThis as any)._serverCell = serverCell;
} else {
    serverCell = (globalThis as any)._serverCell;
}

export const actions = {
    send: async ({ request }) => {
        const data = await request.formData();
        const message = data.get('message') as string;
        const historyRaw = data.get('history') as string;

        try {
            // We pass history so Kindly can maintain context
            const history = historyRaw ? JSON.parse(historyRaw) : [];

            const res = await serverCell.mesh.kindly.chat({
                message,
                history: history
            });

            return {
                ok: true,
                reply: res.reply
            };
        } catch (e: any) {
            console.error("Kindly Mesh Failure:", e.message);
            return {
                ok: false,
                error: e.message
            };
        }
    }
};