"use client";

import { useEffect, useState } from "react";
import { fetchMoodNote, updateMoodNote, type MoodNoteResponse } from "@/lib/api";

function formatUpdatedAt(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MoodNote() {
  const [data, setData] = useState<MoodNoteResponse | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchMoodNote(controller.signal)
      .then((result) => {
        setError("");
        setData(result);
        setDraft(result.content || "");
      })
      .catch(() => {
        setError("心情便签加载失败了喵~");
      });

    return () => controller.abort();
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await updateMoodNote(draft, password);
      setData(result);
      setDraft(result.content || "");
      setPassword("");
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-decorated rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
            Mood Note
          </p>
          <h3 className="text-sm font-semibold text-[var(--color-primary)]">
            今日心情
          </h3>
          {data?.updated_at && (
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              最近更新 {formatUpdatedAt(data.updated_at)}
            </p>
          )}
          {data && !data.editable && (
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              未配置编辑密码，当前只能查看
            </p>
          )}
        </div>
        {data?.editable && !isEditing && (
          <button
            onClick={() => {
              setDraft(data.content || "");
              setIsEditing(true);
              setError("");
            }}
            className="text-xs px-3 py-1.5 rounded-full bg-[var(--color-primary)]/12 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition"
          >
            编辑
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 1200))}
            rows={5}
            placeholder="写几句今天的心情、想说的话，或者想让她看到的话。"
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-cream-light)] px-3 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] resize-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入密码后才能保存"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-cream-light)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />
          {error && (
            <p className="text-xs text-[var(--color-primary)]">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-[var(--color-primary)]/12 px-4 py-2 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setPassword("");
                setDraft(data?.content || "");
                setError("");
              }}
              className="rounded-full bg-[var(--color-card)] px-4 py-2 text-xs text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-[var(--color-cream-light)] px-3 py-4">
          {data?.content ? (
            <p className="text-sm leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words">
              {data.content}
            </p>
          ) : (
            <div className="text-center py-2">
              <p className="text-lg mb-1">(˘ω˘)</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                这里还没有写心情喵~
              </p>
            </div>
          )}
          {error && (
            <p className="mt-3 text-xs text-[var(--color-primary)]">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
