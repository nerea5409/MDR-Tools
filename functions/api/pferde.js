const STORE_KEY = "pferde";

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
        }
    });
}

async function readHorses(env) {
    const raw = await env.PFERDE.get(STORE_KEY);

    if (!raw) {
        return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
}

async function writeHorses(env, horses) {
    await env.PFERDE.put(STORE_KEY, JSON.stringify(horses));
}

export async function onRequest(context) {
    const { request, env } = context;

    if (!env || !env.PFERDE) {
        return jsonResponse({ error: "Missing PFERDE binding" }, 500);
    }

    if (request.method === "GET") {
        const horses = await readHorses(env);
        return jsonResponse(horses);
    }

    if (request.method === "PUT" || request.method === "POST") {
        let body;

        try {
            body = await request.json();
        } catch {
            body = [];
        }

        const horses = Array.isArray(body) ? body : [];
        await writeHorses(env, horses);
        return jsonResponse({ ok: true, count: horses.length });
    }

    if (request.method === "DELETE") {
        const url = new URL(request.url);
        const name = url.searchParams.get("name");
        const horses = await readHorses(env);

        if (!name) {
            return jsonResponse({ error: "Missing name parameter" }, 400);
        }

        const filtered = horses.filter((horse) => horse?.name !== name);
        await writeHorses(env, filtered);
        return jsonResponse({ ok: true, count: filtered.length });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
}
