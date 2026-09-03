// api/tasks.js — Backend compartido para ezTrello
//
// Soporta DOS formas de conexión (usa la que esté disponible):
//   1) REDIS_URL             -> cadena redis:// o rediss:// (Redis Cloud, integración de Vercel)
//   2) KV_REST_API_URL/TOKEN -> REST de Upstash
//
// GET  /api/tasks                -> { tasks: [...] | null, backend: "redis" }
// PUT  /api/tasks  {tasks:[...]} -> { ok: true }

import { createClient } from "redis";

const KEY = "eztrello:tasks";

const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.REDIS_URI ||
  "";

const REST_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  "";
const REST_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  "";

/* ---------- Cliente Redis (TCP) reutilizado entre invocaciones ---------- */
let clientPromise = null;
async function getClient() {
  if (clientPromise) {
    try {
      const c = await clientPromise;
      if (c.isOpen) return c;
    } catch (_) {}
    clientPromise = null;
  }
  const client = createClient({ url: REDIS_URL });
  client.on("error", () => {}); // evita que un error de socket tumbe la funcion
  clientPromise = client.connect().then(() => client);
  return clientPromise;
}

/* ---------- REST (Upstash) ---------- */
async function rest(command) {
  const res = await fetch(REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis REST ${res.status}: ${await res.text()}`);
  return res.json();
}

/* ---------- Lectura / escritura unificada ---------- */
async function getTasks() {
  if (REDIS_URL) {
    const c = await getClient();
    const v = await c.get(KEY);
    return v ? JSON.parse(v) : null;
  }
  const { result } = await rest(["GET", KEY]);
  return result ? JSON.parse(result) : null;
}
async function setTasks(tasks) {
  const str = JSON.stringify(tasks);
  if (REDIS_URL) {
    const c = await getClient();
    await c.set(KEY, str);
    return;
  }
  await rest(["SET", KEY, str]);
}

export default async function handler(req, res) {
  if (!REDIS_URL && !(REST_URL && REST_TOKEN)) {
    return res.status(501).json({
      error:
        "Falta conectar Redis. Se espera REDIS_URL (Redis Cloud) o " +
        "KV_REST_API_URL/KV_REST_API_TOKEN (Upstash).",
    });
  }
  try {
    if (req.method === "GET") {
      const tasks = await getTasks();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ tasks, backend: "redis" });
    }
    if (req.method === "PUT" || req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body || "{}");
      const tasks = Array.isArray(body) ? body : body?.tasks;
      if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: "Se esperaba { tasks: [...] }" });
      }
      await setTasks(tasks);
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Metodo no permitido" });
  } catch (err) {
    return res.status(500).json({ error: String((err && err.message) || err) });
  }
}
