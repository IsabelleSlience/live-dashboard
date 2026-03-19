import { authenticateToken } from "../middleware/auth";
import { resolveAppName } from "../services/app-mapper";
import { isNSFW } from "../services/nsfw-filter";
import { processDisplayTitle } from "../services/privacy-tiers";
import { insertActivity, upsertDeviceState, hmacTitle } from "../db";

const MAX_TITLE_LENGTH = 256;

export async function handleReport(req: Request): Promise<Response> {
  // Auth
  const device = authenticateToken(req.headers.get("authorization"));
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const appId = typeof body.app_id === "string" ? body.app_id.trim() : "";
  if (!appId) {
    return Response.json({ error: "app_id required" }, { status: 400 });
  }

  // Truncate window_title
  let windowTitle =
    typeof body.window_title === "string" ? body.window_title : "";
  if (windowTitle.length > MAX_TITLE_LENGTH) {
    windowTitle = windowTitle.slice(0, MAX_TITLE_LENGTH);
  }

  // Validate client timestamp (optional, used for display only)
  let startedAt: string;
  if (typeof body.timestamp === "string" && body.timestamp) {
    const ts = new Date(body.timestamp);
    const now = Date.now();
    if (!isNaN(ts.getTime()) && Math.abs(ts.getTime() - now) < 5 * 60 * 1000) {
      startedAt = ts.toISOString();
    } else {
      startedAt = new Date().toISOString();
    }
  } else {
    startedAt = new Date().toISOString();
  }

  // NSFW filter - silently discard
  if (isNSFW(appId, windowTitle)) {
    return Response.json({ ok: true });
  }

  // Resolve app name
  const appName = resolveAppName(appId, device.platform);

  // Privacy: generate display_title (safe for public), then discard raw window_title
  const displayTitle = processDisplayTitle(appName, windowTitle);

  // Dedup: HMAC hash of the original title (keyed, not reversible)
  const timeBucket = Math.floor(Date.now() / 10000);
  const titleHash = hmacTitle(windowTitle.toLowerCase().trim());

  // Parse extra (battery, music, etc.) — whitelist fields first, then serialize
  const extra: Record<string, unknown> = {};
  
  // Battery from body.extra
  if (body.extra && typeof body.extra === "object" && !Array.isArray(body.extra)) {
    if (typeof body.extra.battery_percent === "number" && Number.isFinite(body.extra.battery_percent)) {
      extra.battery_percent = Math.max(0, Math.min(100, Math.round(body.extra.battery_percent)));
    }
    if (typeof body.extra.battery_charging === "boolean") {
      extra.battery_charging = body.extra.battery_charging;
    }
  }
  
  // Music from body.music (top level)
  if (body.music && typeof body.music === "object" && !Array.isArray(body.music)) {
    const music: Record<string, unknown> = {};
    if (typeof body.music.title === "string") music.title = body.music.title;
    if (typeof body.music.artist === "string") music.artist = body.music.artist;
    if (typeof body.music.album === "string") music.album = body.music.album;
    if (typeof body.music.playing === "boolean") music.playing = body.music.playing;
    if (typeof body.music.duration === "number") music.duration = body.music.duration;
    if (typeof body.music.elapsedTime === "number") music.elapsedTime = body.music.elapsedTime;
    if (typeof body.music.bundleIdentifier === "string") music.bundleIdentifier = body.music.bundleIdentifier;
    extra.music = music;
  }
  
  const extraJson = JSON.stringify(extra);

  // Insert activity — window_title is NEVER stored (privacy: empty string)
  try {
    insertActivity.run(
      device.device_id,
      device.device_name,
      device.platform,
      appId,
      appName,
      "",
      displayTitle,
      titleHash,
      timeBucket,
      startedAt
    );
  } catch (e: any) {
    if (!e.message?.includes("UNIQUE constraint")) {
      console.error("[report] DB insert error:", e.message);
    }
  }

  // Always update device state
  try {
    upsertDeviceState.run(
      device.device_id,
      device.device_name,
      device.platform,
      appId,
      appName,
      "",
      displayTitle,
      new Date().toISOString(),
      extraJson
    );
  } catch (e: any) {
    console.error("[report] Device state update error:", e.message);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
