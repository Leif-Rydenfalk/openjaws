import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { join } from "node:path";
import { existsSync, writeFileSync, readFileSync } from "node:fs";

// --- PERSISTENCE LAYER ---
const DB_PATH = join(process.cwd(), "memory_store.json");

interface MemoryEntry {
    id: string;
    content: string;
    tags: string[];
    timestamp: number;
}

function loadDb(): MemoryEntry[] {
    try {
        if (!existsSync(DB_PATH)) return [];
        const data = readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveDb(data: MemoryEntry[]) {
    writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// --- CELL LOGIC ---
const cell = new TypedRheoCell(`Memory_${process.pid}`, 0);

const memoryRouter = router({
    memory: router({
        /**
         * Store a new fact or observation into the mesh's long-term memory.
         */
        store: procedure
            .input(z.object({
                content: z.string(),
                tags: z.array(z.string())
            }))
            .output(z.object({ id: z.string(), ok: z.boolean() }))
            .mutation(async (input) => {
                const db = loadDb();
                const id = Math.random().toString(36).substring(7);

                const newEntry: MemoryEntry = {
                    id,
                    content: input.content,
                    tags: input.tags,
                    timestamp: Date.now()
                };

                db.push(newEntry);
                saveDb(db);

                cell.log("INFO", `🧠 Memory Consumed: "${input.content.substring(0, 40)}..."`);
                return { id, ok: true };
            }),

        /**
         * Search for relevant memories using keyword overlap scoring.
         */
        search: procedure
            .input(z.object({
                query: z.string(),
                limit: z.optional(z.number())
            }))
            .output(z.array(z.object({
                content: z.string(),
                score: z.number(),
                tags: z.array(z.string()),
                timestamp: z.number()
            })))
            .query(async (input) => {
                const db = loadDb();
                const queryWords = input.query.toLowerCase()
                    .replace(/[?.!,]/g, '')
                    .split(/\s+/);

                if (queryWords.length === 0) return [];

                const results = db.map(entry => {
                    let score = 0;
                    const contentLower = entry.content.toLowerCase();

                    // Score based on keyword matches
                    queryWords.forEach(word => {
                        if (contentLower.includes(word)) score += 1;
                    });

                    // Bonus for tag matches
                    entry.tags.forEach(tag => {
                        if (input.query.toLowerCase().includes(tag.toLowerCase())) score += 2;
                    });

                    return { ...entry, score };
                })
                    .filter(r => r.score > 0)
                    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
                    .slice(0, input.limit || 5);

                cell.log("INFO", `🔍 Recall triggered for "${input.query}" - Found ${results.length} matches`);
                return results.map(({ id, ...rest }) => rest);
            })
    })
});

cell.useRouter(memoryRouter);
cell.listen();