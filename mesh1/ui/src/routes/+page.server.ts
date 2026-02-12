// ui/src/routes/kindly/+page.server.ts - Use Comms Cell
import { TypedRheoCell } from '../../../protocols/example1/typed-mesh';

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
        const sessionId = data.get('sessionId') as string;

        try {
            // If no session, start one
            let currentSessionId = sessionId;
            if (!currentSessionId || currentSessionId === 'new') {
                const session = await serverCell.mesh.comms['start-session']({
                    channel: 'web',
                    channelUserId: 'root-admin',
                    metadata: {
                        userAgent: request.headers.get('user-agent'),
                        ip: request.headers.get('x-forwarded-for') || 'localhost'
                    }
                });
                currentSessionId = session.sessionId;
            }

            // Send message via comms
            const response = await serverCell.mesh.comms.chat({
                sessionId: currentSessionId,
                message,
                metadata: {
                    timestamp: Date.now()
                }
            });

            return {
                ok: true,
                sessionId: currentSessionId,
                reply: response.reply,
                contextUsed: response.contextUsed
            };

        } catch (e: any) {
            console.error("Chat error:", e.message);
            return {
                ok: false,
                error: e.message
            };
        }
    }
};