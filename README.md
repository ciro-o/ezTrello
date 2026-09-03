# ezTrello

Panel de tareas estilo Trello, con:

- 4 estados con color propio: **Por iniciar, En Proceso, Test, Completado**
- Campos editables por tarea: **Nombre Trello, Nombre, Link, Descripción, Estado, Fecha inicio, Fecha fin**
- Responsable en **dos desplegables**: **PM** y **AI Agent Dev**
- Barra lateral con **buscador** + **filtro por estado**
- **Almacenamiento compartido**: si lo desplegás en Vercel con una base Redis, todas las
  personas que entren ven y editan las mismas tareas (con sincronización automática cada 6 s).

Si abrís `index.html` suelto (sin backend), funciona igual pero guarda solo en el navegador local.

---

## Desplegar en Vercel (tareas compartidas)

### 1. Subir el proyecto
Opción A — con Git: subí esta carpeta a un repo de GitHub y en Vercel hacé **Add New → Project → Import**.
Opción B — con la CLI:
```bash
npm i -g vercel
vercel        # seguí los pasos; luego "vercel --prod"
```

### 2. Conectar la base Redis (esto es lo que hace que se comparta)
Vercel KV ya no existe: ahora se usa **Redis desde el Marketplace** (Upstash o Redis Cloud).

1. En el proyecto en Vercel → pestaña **Storage** → **Create Database**.
2. Elegí **Redis** (Upstash) → **Continue** → creá la base y **conectala a este proyecto**.
3. Vercel inyecta solo las variables de entorno **`KV_REST_API_URL`** y **`KV_REST_API_TOKEN`**.
   (El backend también acepta `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` por si el
   proveedor usa esos nombres.)

### 3. Redeploy
Volvé a desplegar (**Deployments → Redeploy**, o `vercel --prod`).
Listo: al entrar a la URL, arriba a la izquierda debería decir **"Compartido — todos ven lo mismo"**.

---

## Estructura

```
eztrello/
├─ index.html      # toda la app (UI + lógica)
├─ api/
│  └─ tasks.js     # función serverless: GET/PUT de las tareas en Redis
├─ package.json
└─ README.md
```

## Personalizar el equipo
En `index.html`, cerca del inicio del `<script>`:
```js
const PMS  = ["Guido Rocha"];
const DEVS = ["Ciro Fernandez", "Martin Sebastian"];
```
Agregá o quitá nombres ahí.

## Notas
- Concurrencia: **último que guarda gana**. Para un equipo chico alcanza; no está pensado para
  edición simultánea intensiva sobre la misma tarea.
- La sincronización no pisa lo que estás escribiendo: mientras tenés un campo en foco, no refresca.
