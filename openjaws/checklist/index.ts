import { RheoCell } from "../protocols/example1";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const seed = process.argv[2];
const cell = new RheoCell(`Checklist_${process.pid}`, 0, seed);

// Inställningar
const MAX_ITEMS = 5;
const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR);

interface ListItem {
    id: string;
    text: string;
    completed: boolean;
    type: 'task' | 'idea';
    createdAt: number;
}

// Ladda dagens fil eller skapa ny
function getTodayPath() {
    const date = new Date().toISOString().split('T')[0];
    return join(DATA_DIR, `${date}.json`);
}

function loadDailyData(): ListItem[] {
    const path = getTodayPath();
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
    return [];
}

function saveDailyData(data: ListItem[]) {
    writeFileSync(getTodayPath(), JSON.stringify(data, null, 2));
}

// --- CAPABILITIES ---

// 1. Lägg till (Check för MAX_ITEMS)
cell.provide("list/add", async (args: { text: string, type: 'task' | 'idea' }) => {
    const items = loadDailyData();
    const activeTasks = items.filter(i => i.type === 'task' && !i.completed);

    if (args.type === 'task' && activeTasks.length >= MAX_ITEMS) {
        throw new Error(`KAPACITET_NÅDD: Du har redan ${MAX_ITEMS} aktiva uppgifter. Slutför något för att skapa momentum!`);
    }

    const newItem: ListItem = {
        id: Math.random().toString(36).substring(7),
        text: args.text,
        completed: false,
        type: args.type,
        createdAt: Date.now()
    };

    items.push(newItem);
    saveDailyData(items);

    cell.log("INFO", `➕ Lagt till ${args.type}: ${args.text}`);
    return { ok: true, item: newItem };
});

// 2. Bocka av (Skapar momentum)
cell.provide("list/complete", async (args: { id: string }) => {
    const items = loadDailyData();
    const item = items.find(i => i.id === args.id);

    if (!item) throw new Error("Hittade inte objektet.");

    item.completed = true;
    saveDailyData(items);

    cell.log("INFO", `✅ Slutfört: ${item.text}. Slot frigjord!`);
    return { ok: true, momentum: "plus_one" };
});

// 3. Hämta listor
cell.provide("list/get", async () => {
    return {
        items: loadDailyData(),
        capacity: MAX_ITEMS,
        date: new Date().toISOString().split('T')[0]
    };
});

// 4. Automatisk Sammanfattning (Anropar AI-cellen!)
cell.provide("list/summarize", async () => {
    const items = loadDailyData();
    const completed = items.filter(i => i.completed).map(i => i.text);
    const pending = items.filter(i => !i.completed && i.type === 'task').map(i => i.text);
    const ideas = items.filter(i => i.type === 'idea').map(i => i.text);

    const prompt = `Sammanfatta min dag kortfattat. 
    Klarade av: ${completed.join(", ")}. 
    Missade: ${pending.join(", ")}. 
    Nya idéer: ${ideas.join(", ")}.
    Ge mig feedback för att bibehålla momentum imorgon.`;

    try {
        // Här anropar vi AI-cellen via nätverket!
        const aiRes = await cell.askMesh("ai/generate", { prompt });
        return { summary: aiRes.value.response };
    } catch (e) {
        return { summary: "Kunde inte nå AI för sammanfattning, men bra jobbat idag!" };
    }
});

cell.listen();