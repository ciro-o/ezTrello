// api/tasks.js — Backend compartido para ezTrello (Vercel + Redis/Upstash REST)
//
// GET  /api/tasks         -> { tasks: [...] | null, backend: "redis" }
// PUT  /api/tasks  body:{tasks:[...]}  -> { ok:true }
//
// Requiere una base Redis conectada desde el Marketplace de Vercel.
// Se aceptan varios nombres de variable segun el proveedor (Upstash / Redis Cloud).

const REDIS_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_API_URL ||
  "";

const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_API_TOKEN ||
  "";

const KEY = "eztrello:tasks";

async function redis(command) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Redis ${res.status}: ${t}`);
  }
  return res.json(); // { result: ... }
}

export default async function handler(req, res) {
  // Sin credenciales no hay backend compartido: el front cae a modo local.
  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(501).json({
      error:
        "Falta conectar una base Redis en Vercel (Storage -> Marketplace -> Redis/Upstash). " +
        "Se esperan las variables KV_REST_API_URL y KV_REST_API_TOKEN.",
    });
  }

  try {
    if (req.method === "GET") {
      const { result } = await redis(["GET", KEY]);
      const tasks = result ? JSON.parse(result) : null;
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
      await redis(["SET", KEY, JSON.stringify(tasks)]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Metodo no permitido" });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
