import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { join } from "node:path";
import { existsSync, writeFileSync, readFileSync } from "node:fs";

// Simple JSON Store (in real prod, use a Vector DB like Chroma/Qdrant)
const DB_PATH = join(process.cwd(), "memory.json");
interface MemoryEntry { id: string; content: string; tags: string[]; timestamp: number; }

function loadDb(): MemoryEntry[] {
    if (!existsSync(DB_PATH)) return [];
    return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveDb(data: MemoryEntry[]) {
    writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const cell = new TypedRheoCell(`Memory_${process.pid}`, 0);

const memoryRouter = router({
    memory: router({
        store: procedure
            .input(z.object({
                content: z.string(),
                tags: z.array(z.string())
            }))
            .output(z.object({ id: z.string(), ok: z.boolean() }))
            .mutation(async (input) => {
                const db = loadDb();
                const id = Math.random().toString(36).substring(7);
                db.push({
                    id,
                    content: input.content,
                    tags: input.tags,
                    timestamp: Date.now()
                });
                saveDb(db);
                return { id, ok: true };
            }),

        search: procedure
            .input(z.object({
                query: z.string(),
                limit: z.optional(z.number())
            }))
            .output(z.array(z.object({
                content: z.string(),
                score: z.number()
            })))
            .query(async (input) => {
                const db = loadDb();
                // Naive keyword matching (replace with embeddings later)
                const keywords = input.query.toLowerCase().split(' ');

                return db.map(entry => {
                    let score = 0;
                    const text = entry.content.toLowerCase();
                    keywords.forEach(k => { if (text.includes(k)) score++; });
                    return { content: entry.content, score };
                })
                    .filter(r => r.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, input.limit || 3);
            })
    })
});

cell.useRouter(memoryRouter);
cell.listen();