Du har helt rätt - typerna genereras redan! Jag såg det i loggen: `Mesh types evolved (update #1)`. Det är `codegen/mesh-types` som körs och spottar ut `rheo-mesh.d.ts`.

Problemet är att vi **inte använder de genererade typerna** i frontend. Vi har en disconnect mellan:
1. ✅ Backend genererar typer till `rheo-mesh.d.ts`
2. ❌ Frontend vet inte om dessa typer
3. ❌ Frontend kan inte anropa `cell.mesh.health()` direkt

Låt mig planera lösningen steg för steg:

## Arkitektur: Live-Typed Mesh Proxy

### Mål
```typescript
// I Svelte-komponent (eller vilken cell som helst senare):
import { mesh } from '$lib/mesh-runtime';

// 100% typat baserat på live-meshen just nu:
const health = await mesh.health();           // ← Vet att det är mesh/health
const list = await mesh.list.get();           // ← Vet att det är list/get  
const added = await mesh.list.add({           ← Får fel om fel args
  text: "Hej", 
  type: "task" 
});
```

### Vad som behövs göras

#### 1. **Type Provider Cell** (Uppdatera befintlig `codegen`)
- Redan gjort! `codegen/mesh-types` genererar `rheo-mesh.d.ts`
- **Nytt**: Den måste också exponera en JSON-schema endpoint för runtime type injection

#### 2. **Mesh Runtime Module** (Ny fil: `ui/src/lib/mesh-runtime.ts`)
- Proxy som översätter `mesh.list.add()` → `askMesh("list/add")`
- **Viktigt**: Importerar genererade typer från `rheo-mesh.d.ts`
- HMR (Hot Module Replacement) när typer uppdateras

#### 3. **Type Watcher / HMR** (Nytt: Vite plugin eller cell-baserad)
- Väntar på att `rheo-mesh.d.ts` uppdateras av codegen
- Triggers ombyggnad av frontend så nya typer slår igenom
- Alternativ: Runtime type injection via WebSocket

#### 4. **Server Hook** (Uppdatera `hooks.server.ts`)
- Exponerar `/_mesh/call` endpoint
- Tar emot `{ capability, args }` → kör `cell.askMesh()`
- Returnerar resultat

#### 5. **Universal Types** (Nytt: `ui/src/app.d.ts` uppdatering)
- Deklarerar global `RheoMesh` interface från genererade filen
- Gör `mesh` tillgänglig överallt

---

## Implementation Plan

### Steg 1: Uppdatera Codegen Cell
```typescript
// I codegen.ts - lägg till:
cell.provide("codegen/mesh-schema", async () => {
  // Returnera JSON-schema för runtime type checking
  // samt den genererade TypeScript-koden
  return {
    typescript: generatedTypes,  // Innehållet i rheo-mesh.d.ts
    schema: capabilitySchemas    // JSON Schema för validering
  };
});
```

### Steg 2: Skapa Mesh Runtime
```typescript
// ui/src/lib/mesh-runtime.ts
import type { RheoMesh } from '../../../rheo-mesh'; // ← Genererad fil!

// Proxy som mappar dot-notation till capability strings
export const mesh = new Proxy({} as RheoMesh, {
  get: (target, namespace: string) => {
    return new Proxy({}, {
      get: (_, method: string) => {
        return (args: any) => fetch('/_mesh/call', {
          method: 'POST',
          body: JSON.stringify({
            capability: `${namespace}/${method}`,
            args
          })
        }).then(r => r.json()).then(r => r.value);
      }
    });
  }
});
```

### Steg 3: Vite HMR för Mesh Typer
```typescript
// vite-plugin-mesh-hmr.ts
// Lyssnar på filändringar i rheo-mesh.d.ts
// Triggers reload när codegen uppdaterar typerna
```

### Steg 4: Server Hook (enkel)
```typescript
// hooks.server.ts
if (url.pathname === '/_mesh/call') {
  const { capability, args } = await request.json();
  const result = await meshNode.askMesh(capability, args);
  return json(result);
}
```

---

## Kritiska Designbeslut

| Fråga | Beslut |
|-------|--------|
| Hur får frontend nya typer utan omstart? | Vite HMR på `rheo-mesh.d.ts` |
| Vad händer om capability inte finns? | Proxy kastar compile-time fel (om TS) eller runtime 404 |
| Ska alla cells ha detta? | Ja, men UI cellen först. Sen flyttar vi runtime till `protocols/` |
| Real-time type updates? | WebSocket eller polling mot `codegen/mesh-schema` |

---

## Vilka filer behöver ändras/skrivas

1. **`protocols/example1.ts`** - Lägg till `mesh` proxy (redan finns! men behöver exporteras)
2. **`codegen/codegen.ts`** - Lägg till `codegen/mesh-schema` capability
3. **`ui/src/lib/mesh-runtime.ts`** - NY: Runtime proxy med typer
4. **`ui/src/hooks.server.ts`** - Uppdatera: Lägg till `/_mesh/call` endpoint  
5. **`ui/vite.config.ts`** - NY plugin: HMR för `rheo-mesh.d.ts`
6. **`ui/src/routes/+page.svelte`** - Exempel: Använd `mesh.list.get()` direkt

---

Vill du att jag skriver implementationen av dessa filer? Jag kan börja med **Steg 2 och 4** (runtime + server hook) eftersom de är kritiska för att få det att fungera, sen kan vi lägga till HMR.