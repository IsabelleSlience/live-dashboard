import subprocess
import json

def get_qqmusic_info():
    result = subprocess.run(
        ["media-control", "get"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print("ERR:", result.stderr.strip())
        return None

    raw = result.stdout.strip()
    if not raw:
        return None

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print("JSON_ERR:", raw)
        return None

    if data.get("bundleIdentifier") != "com.tencent.QQMusicMac":
        return {
            "ok": False,
            "reason": "current player is not QQMusic",
            "bundleIdentifier": data.get("bundleIdentifier"),
            "title": data.get("title"),
            "artist": data.get("artist"),
            "playing": data.get("playing"),
        }

    return {
        "ok": True,
        "bundleIdentifier": data.get("bundleIdentifier"),
        "title": data.get("title"),
        "artist": data.get("artist"),
        "album": data.get("album"),
        "playing": data.get("playing"),
        "duration": data.get("duration"),
        "elapsedTime": data.get("elapsedTime"),
    }

print(get_qqmusic_info())
