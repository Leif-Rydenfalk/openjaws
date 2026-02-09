import { json } from '@sveltejs/kit';
import { TypedRheoCell } from '../../../../../protocols/example1/typed-mesh';

let serverCell: TypedRheoCell;
if (!(globalThis as any)._serverCell) {
    serverCell = new TypedRheoCell(`API_Server_${process.pid}`, 0);
    serverCell.listen();
    (globalThis as any)._serverCell = serverCell;
} else {
    serverCell = (globalThis as any)._serverCell;
}

export async function POST({ request }) {
    try {
        const { username, password } = await request.json();

        const result = await serverCell.askMesh("identity/login" as any, {
            username,
            password
        });

        if (result.ok && result.value) {
            return json({
                ok: true,
                token: result.value.token,
                user: result.value.user,
                expiresAt: result.value.expiresAt
            });
        } else {
            return json({
                ok: false,
                error: result.error?.msg || "Authentication failed"
            }, { status: 401 });
        }
    } catch (e: any) {
        return json({
            ok: false,
            error: "Internal server error"
        }, { status: 500 });
    }
}