// kindly/+page.server.ts - UPDATED SERVER ACTIONS
import { TypedRheoCell } from '../../../../protocols/typed-mesh';

let serverCell: TypedRheoCell;
if (!(globalThis as any)._serverCell) {
    serverCell = new TypedRheoCell(`Kindly_Proxy`, 0);
    serverCell.listen();
    (globalThis as any)._serverCell = serverCell;
} else {
    serverCell = (globalThis as any)._serverCell;
}

export const load = async () => {
    // Return initial temporal context for UI
    try {
        const sessionCtx = await serverCell.mesh.memory['get-session']({
            userId: "root-override",
            hoursBack: 8
        });

        const now = new Date();
        const timeOfDay = getTimeOfDay(now);

        const patterns = await serverCell.mesh.memory['suggest-from-patterns']({
            context: {
                timeOfDay,
                dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
                userId: "root-override"
            }
        });

        return {
            temporalContext: {
                sessionMemories: sessionCtx.memories.length,
                activeGoals: sessionCtx.activeGoals.length,
                learnedPatterns: patterns.length,
                timeOfDay
            }
        };
    } catch (e) {
        return {
            temporalContext: {
                sessionMemories: 0,
                activeGoals: 0,
                learnedPatterns: 0,
                timeOfDay: 'unknown'
            }
        };
    }
};

export const actions = {
    send: async ({ request }) => {
        const data = await request.formData();
        const message = data.get('message') as string;
        const historyRaw = data.get('history') as string;

        try {
            const history = historyRaw ? JSON.parse(historyRaw) : [];

            const res = await serverCell.mesh.kindly.chat({
                message,
                history: history,
                systemContext: {
                    userId: "root-override",
                    username: "ROOT_ADMIN",
                    role: "admin"
                }
            });

            return {
                ok: true,
                reply: res.reply,
                contextUsed: res.contextUsed
            };
        } catch (e: any) {
            console.error("Kindly Mesh Failure:", e.message);
            return {
                ok: false,
                error: e.message
            };
        }
    },

    getUserContext: async () => {
        try {
            const now = new Date();
            const timeOfDay = getTimeOfDay(now);

            const sessionCtx = await serverCell.mesh.memory['get-session']({
                userId: "root-override",
                hoursBack: 4
            });

            const patterns = await serverCell.mesh.memory['suggest-from-patterns']({
                context: {
                    timeOfDay,
                    userId: "root-override"
                }
            });

            return {
                ok: true,
                user: {
                    username: "ROOT_ADMIN",
                    role: "admin",
                    permissions: ["*"]
                },
                temporalSummary: {
                    sessionMemories: sessionCtx.memories.length,
                    activeGoals: sessionCtx.activeGoals.length,
                    learnedPatterns: patterns.length
                }
            };
        } catch (e) {
            return {
                ok: true,
                user: {
                    username: "ROOT_ADMIN",
                    role: "admin",
                    permissions: ["*"]
                }
            };
        }
    }
};

function getTimeOfDay(date: Date): string {
    const hour = date.getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
}