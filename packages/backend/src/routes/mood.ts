import { getMoodNote, upsertMoodNote } from "../db";

const MAX_MOOD_LENGTH = 1200;
const MOOD_NOTE_PASSWORD = process.env.MOOD_NOTE_PASSWORD || "";

export function handleGetMood(): Response {
  const row = getMoodNote.get() as { content: string; updated_at: string } | null;
  return Response.json({
    content: row?.content || "",
    updated_at: row?.updated_at || "",
    editable: !!MOOD_NOTE_PASSWORD,
  });
}

export async function handleUpdateMood(req: Request): Promise<Response> {
  if (!MOOD_NOTE_PASSWORD) {
    return Response.json({ error: "Mood note editing is not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const password = typeof (body as Record<string, unknown>).password === "string"
    ? (body as Record<string, string>).password
    : "";
  if (password !== MOOD_NOTE_PASSWORD) {
    return Response.json({ error: "Password incorrect" }, { status: 401 });
  }

  const contentValue = (body as Record<string, unknown>).content;
  const rawContent = typeof contentValue === "string" ? contentValue : "";
  const content = rawContent.trim().slice(0, MAX_MOOD_LENGTH);

  const updatedAt = new Date().toISOString();
  upsertMoodNote.run(content, updatedAt);

  return Response.json({
    ok: true,
    content,
    updated_at: updatedAt,
    editable: true,
  });
}
