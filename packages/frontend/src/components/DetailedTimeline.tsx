"use client";

import { useMemo, useState } from "react";
import type { DeviceState, TimelineSegment } from "@/lib/api";
import { getAppDescription } from "@/lib/app-descriptions";
import {
  getNormalizedDisplayTitle,
  formatClockTime,
  formatDuration,
  formatMinutesAgo,
  getGapMinutes,
  getSegmentEnd,
  sortSegmentsAsc,
} from "@/lib/timeline-utils";

const APP_COLORS = [
  "#D79AA8", "#8FB7B4", "#D9B77A", "#B99D88", "#C8ABC3",
  "#9FBC9B", "#D5A997", "#94AFC2", "#C7B57E", "#B6A4CC",
  "#C98F95", "#8FA8A0",
];

const SLOT_MINUTES = 10;
const TOTAL_SLOTS = 24 * 6;

interface Props {
  segments: TimelineSegment[];
  devices: DeviceState[];
}

interface TaskGroup {
  appName: string;
  displayTitle: string;
  startTime: string;
  endTime: string;
  activeMinutes: number;
  segments: TimelineSegment[];
}

interface CurrentTaskGroup {
  appName: string;
  displayTitle: string;
  startTime: string;
  endTime: string;
  activeMinutes: number;
  segments: TimelineSegment[];
}

interface TimelineSlot {
  index: number;
  appName: string | null;
  color: string | null;
  active: boolean;
}

interface RangeModalState {
  deviceName: string;
  startSlot: number;
  endSlot: number;
  segments: TimelineSegment[];
}

interface RankedItem {
  label: string;
  count: number;
}

interface RankedPage {
  label: string;
  url: string;
  minutes: number;
}

interface MergedDetailSegment {
  appName: string;
  displayTitle: string;
  pageUrl: string;
  startTime: string;
  endTime: string;
  activeMinutes: number;
  count: number;
}

function formatLinkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

function getLatestPageUrl(segments: TimelineSegment[]): string {
  const latestWithUrl = [...segments]
    .filter((seg) => !!seg.page_url)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];
  return latestWithUrl?.page_url || "";
}

function getTaskKey(seg: TimelineSegment): string {
  return `${seg.app_name}::${getNormalizedDisplayTitle(seg)}`;
}

function getAppColor(appName: string, colorMap: Map<string, string>): string {
  const existing = colorMap.get(appName);
  if (existing) return existing;
  const color = APP_COLORS[colorMap.size % APP_COLORS.length]!;
  colorMap.set(appName, color);
  return color;
}

function getSlotStyle(slot: TimelineSlot, isSelected: boolean) {
  if (!slot.active) {
    return {
      backgroundColor: "rgba(255, 255, 255, 0.28)",
      borderColor: "color-mix(in srgb, var(--color-border) 88%, white)",
      boxShadow: isSelected ? "inset 0 0 0 1px rgba(132, 94, 111, 0.16)" : "inset 0 1px 0 rgba(255, 255, 255, 0.45)",
      opacity: 1,
    };
  }

  const baseColor = slot.color || "var(--color-primary)";
  return {
    backgroundColor: `color-mix(in srgb, ${baseColor} 78%, white)`,
    borderColor: isSelected
      ? `color-mix(in srgb, ${baseColor} 88%, var(--color-primary))`
      : `color-mix(in srgb, ${baseColor} 58%, var(--color-border))`,
    boxShadow: isSelected
      ? `0 0 0 1px color-mix(in srgb, ${baseColor} 52%, white), inset 0 1px 0 rgba(255, 255, 255, 0.5)`
      : `inset 0 1px 0 rgba(255, 255, 255, 0.42), 0 1px 2px rgba(73, 55, 63, 0.08)`,
    opacity: 1,
  };
}

function openRangeDetails(
  deviceName: string,
  historySegments: TimelineSegment[],
  startSlot: number,
  endSlot: number,
  setSelectedRange: (value: RangeModalState | null) => void,
) {
  const state = normalizeSlotRange(startSlot, endSlot);
  setSelectedRange({
    deviceName,
    startSlot: state.startSlot,
    endSlot: state.endSlot,
    segments: getSegmentsForRange(historySegments, state.startSlot, state.endSlot),
  });
}

function getMinutesSinceMidnight(dateStr: string): number {
  const date = new Date(dateStr);
  return date.getHours() * 60 + date.getMinutes();
}

function getSegmentWindow(seg: TimelineSegment): { start: number; end: number } {
  const start = getMinutesSinceMidnight(seg.started_at);
  const endDate = new Date(getSegmentEnd(seg));
  const end = endDate.getHours() * 60 + endDate.getMinutes();
  return {
    start,
    end: Math.max(start + 1, end),
  };
}

function getSlotTimeLabel(slot: number): string {
  const totalMinutes = slot * SLOT_MINUTES;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function normalizeSlotRange(startSlot: number, endSlot: number): { startSlot: number; endSlot: number } {
  return {
    startSlot: Math.max(0, Math.min(startSlot, endSlot)),
    endSlot: Math.min(TOTAL_SLOTS - 1, Math.max(startSlot, endSlot)),
  };
}

function buildTaskGroups(segments: TimelineSegment[]): TaskGroup[] {
  const sorted = sortSegmentsAsc(segments);
  const groups: TaskGroup[] = [];

  for (const seg of sorted) {
    const prev = groups[groups.length - 1];
    const segEnd = getSegmentEnd(seg);
    const canMerge =
      prev &&
      getTaskKey(seg) === `${prev.appName}::${prev.displayTitle}` &&
      getGapMinutes(prev.endTime, seg.started_at) <= 15;

    if (canMerge) {
      prev.endTime = segEnd;
      prev.activeMinutes += seg.duration_minutes || 0;
      prev.segments.push(seg);
      continue;
    }

    groups.push({
      appName: seg.app_name,
      displayTitle: getNormalizedDisplayTitle(seg),
      startTime: seg.started_at,
      endTime: segEnd,
      activeMinutes: seg.duration_minutes || 0,
      segments: [seg],
    });
  }

  return groups;
}

function buildCurrentTaskGroups(segments: TimelineSegment[]): CurrentTaskGroup[] {
  const cutoff = Date.now() - 15 * 60 * 1000;
  const recentSegments = sortSegmentsAsc(segments).filter(
    (seg) => new Date(getSegmentEnd(seg)).getTime() >= cutoff
  );
  const byApp = new Map<string, CurrentTaskGroup>();

  for (const seg of recentSegments) {
    const existing = byApp.get(seg.app_name);
    const segEnd = getSegmentEnd(seg);
    if (existing) {
      existing.startTime =
        new Date(seg.started_at).getTime() < new Date(existing.startTime).getTime()
          ? seg.started_at
          : existing.startTime;
      existing.endTime =
        new Date(segEnd).getTime() > new Date(existing.endTime).getTime()
          ? segEnd
          : existing.endTime;
      existing.activeMinutes += seg.duration_minutes || 0;
      existing.segments.push(seg);
      const normalizedTitle = getNormalizedDisplayTitle(seg);
      if (normalizedTitle && new Date(segEnd).getTime() >= new Date(existing.endTime).getTime()) {
        existing.displayTitle = normalizedTitle;
      }
      continue;
    }

    byApp.set(seg.app_name, {
      appName: seg.app_name,
      displayTitle: getNormalizedDisplayTitle(seg),
      startTime: seg.started_at,
      endTime: segEnd,
      activeMinutes: seg.duration_minutes || 0,
      segments: [seg],
    });
  }

  return Array.from(byApp.values()).sort(
    (a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
  );
}

function buildTimelineSlots(segments: TimelineSegment[], colorMap: Map<string, string>): TimelineSlot[] {
  return Array.from({ length: TOTAL_SLOTS }, (_, index) => {
    const slotStart = index * SLOT_MINUTES;
    const slotEnd = slotStart + SLOT_MINUTES;
    let bestApp: string | null = null;
    let bestOverlap = 0;

    for (const seg of segments) {
      const window = getSegmentWindow(seg);
      const overlap = Math.max(0, Math.min(window.end, slotEnd) - Math.max(window.start, slotStart));
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestApp = seg.app_name;
      }
    }

    return {
      index,
      appName: bestApp,
      color: bestApp ? getAppColor(bestApp, colorMap) : null,
      active: bestOverlap > 0,
    };
  });
}

function getTaskLabel(group: TaskGroup): string {
  return getAppDescription(group.appName, group.displayTitle || undefined);
}

function getSegmentsForRange(segments: TimelineSegment[], startSlot: number, endSlot: number): TimelineSegment[] {
  const rangeStart = startSlot * SLOT_MINUTES;
  const rangeEnd = (endSlot + 1) * SLOT_MINUTES;
  return sortSegmentsAsc(segments).filter((seg) => {
    const window = getSegmentWindow(seg);
    return window.end > rangeStart && window.start < rangeEnd;
  });
}

function parseTimeToSlot(value: string, isEnd = false): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hh, mm] = value.split(":").map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const totalMinutes = hh * 60 + mm;
  const rawSlot = Math.floor(totalMinutes / SLOT_MINUTES);
  if (isEnd) {
    return Math.min(TOTAL_SLOTS - 1, Math.max(0, Math.ceil(totalMinutes / SLOT_MINUTES) - 1));
  }
  return Math.min(TOTAL_SLOTS - 1, Math.max(0, rawSlot));
}

function buildTopEvents(segments: TimelineSegment[]): RankedItem[] {
  const counts = new Map<string, number>();
  for (const seg of segments) {
    const label = getAppDescription(seg.app_name, getNormalizedDisplayTitle(seg) || undefined);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function buildTopApps(segments: TimelineSegment[]): RankedItem[] {
  const counts = new Map<string, number>();
  for (const seg of segments) {
    counts.set(seg.app_name, (counts.get(seg.app_name) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function buildTopPages(segments: TimelineSegment[]): RankedPage[] {
  const pages = new Map<string, RankedPage>();

  for (const seg of segments) {
    if (!seg.page_url) continue;
    const existing = pages.get(seg.page_url);
    const minutes = seg.duration_minutes || 0;

    if (existing) {
      existing.minutes += minutes;
      continue;
    }

    pages.set(seg.page_url, {
      label: formatLinkLabel(seg.page_url),
      url: seg.page_url,
      minutes,
    });
  }

  return Array.from(pages.values())
    .filter((item) => item.minutes >= 1)
    .sort((a, b) => b.minutes - a.minutes);
}

function buildMergedDetailSegments(segments: TimelineSegment[]): MergedDetailSegment[] {
  const merged: MergedDetailSegment[] = [];

  for (const seg of sortSegmentsAsc(segments)) {
    const displayTitle = getNormalizedDisplayTitle(seg);
    const pageUrl = seg.page_url || "";
    const prev = merged[merged.length - 1];
    const segEnd = getSegmentEnd(seg);

    const canMerge =
      prev &&
      prev.appName === seg.app_name &&
      prev.displayTitle === displayTitle &&
      prev.pageUrl === pageUrl &&
      getGapMinutes(prev.endTime, seg.started_at) <= 1;

    if (canMerge) {
      prev.endTime = segEnd;
      prev.activeMinutes += seg.duration_minutes || 0;
      prev.count += 1;
      continue;
    }

    merged.push({
      appName: seg.app_name,
      displayTitle,
      pageUrl,
      startTime: seg.started_at,
      endTime: segEnd,
      activeMinutes: seg.duration_minutes || 0,
      count: 1,
    });
  }

  return merged;
}

function TaskDetails({ group }: { group: TaskGroup }) {
  const groupPageUrl = getLatestPageUrl(group.segments);
  const mergedSegments = buildMergedDetailSegments(group.segments);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[var(--color-cream-light)] px-4 py-4">
        <p className="text-sm font-semibold text-[var(--color-primary)] break-words">
          {getTaskLabel(group)}
        </p>
        {groupPageUrl && (
          <a
            href={groupPageUrl}
            target="_blank"
            rel="noreferrer"
            className="meta-link mt-2"
          >
            <span className="meta-link-label">{formatLinkLabel(groupPageUrl)}</span>
          </a>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
          <span>{formatClockTime(group.startTime, true)} - {formatClockTime(group.endTime, true)}</span>
          <span>活跃 {formatDuration(group.activeMinutes)}</span>
          <span>{mergedSegments.length} 条合并后记录</span>
        </div>
      </div>

      <div className="space-y-2">
        {mergedSegments.map((seg, index) => (
          <div
            key={`${seg.startTime}-${index}`}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-xs text-[var(--color-text-muted)]">
                {formatClockTime(seg.startTime, true)}
                {seg.endTime ? ` - ${formatClockTime(seg.endTime, true)}` : ""}
              </p>
              <p className="text-sm text-[var(--color-primary)] truncate">
                {getAppDescription(seg.appName, seg.displayTitle || undefined)}
              </p>
              {seg.pageUrl && (
                <a
                  href={seg.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="meta-link mt-2"
                >
                  <span className="meta-link-label">{formatLinkLabel(seg.pageUrl)}</span>
                </a>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <span className="block text-xs font-mono text-[var(--color-text-muted)]">
                {formatDuration(seg.activeMinutes)}
              </span>
              {seg.count > 1 && (
                <span className="block mt-1 text-[11px] text-[var(--color-text-muted)]">
                  合并 {seg.count} 条
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RangeDetails({ state }: { state: RangeModalState }) {
  const topEvents = buildTopEvents(state.segments);
  const topApps = buildTopApps(state.segments);
  const topPages = buildTopPages(state.segments);
  const mergedSegments = buildMergedDetailSegments(state.segments);
  const primary = topEvents[0]?.label || "这段时间比较分散";

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[var(--color-cream-light)] px-4 py-4">
        <p className="text-sm font-semibold text-[var(--color-primary)]">
          {getSlotTimeLabel(state.startSlot)} - {getSlotTimeLabel(state.endSlot + 1)}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          共 {mergedSegments.length} 条合并后活动
        </p>
      </div>

      <div className="rounded-2xl bg-[var(--color-cream-light)] px-4 py-4">
        <p className="text-sm font-semibold text-[var(--color-primary)]">
          这段时间主要在干啥
        </p>
        <p className="text-sm text-[var(--color-text)] mt-2">
          {primary}
        </p>
        <div className="mt-3 grid gap-2">
          {topEvents.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="rounded-xl bg-[var(--color-card)] px-3 py-2 flex items-center justify-between gap-3"
            >
              <span className="text-sm text-[var(--color-primary)] truncate">
                {index + 1}. {item.label}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                {item.count} 条
              </span>
            </div>
          ))}
        </div>
        {topApps.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 text-[11px] text-[var(--color-text-muted)]">
            {topApps.map((item, index) => (
              <span key={`${item.label}-${index}`}>
                {index + 1}. {item.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {topPages.length > 0 && (
        <div className="rounded-2xl bg-[var(--color-cream-light)] px-4 py-4">
          <p className="text-sm font-semibold text-[var(--color-primary)]">
            相关网页
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            累计使用超过 1 分钟的网页都会列在这里
          </p>
          <div className="mt-3 grid gap-2">
            {topPages.map((item, index) => (
              <div
                key={`${item.url}-${index}`}
                className="rounded-xl bg-[var(--color-card)] px-3 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-primary)] break-words">
                    {index + 1}. {item.label}
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="meta-link mt-2"
                  >
                    <span className="meta-link-label">{item.url}</span>
                  </a>
                </div>
                <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                  {formatDuration(item.minutes)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {mergedSegments.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-5 text-sm text-[var(--color-text-muted)]">
            这段时间没有活动记录。
          </div>
        ) : (
          mergedSegments.map((seg, index) => (
            <div
              key={`${seg.startTime}-${index}`}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {formatClockTime(seg.startTime, true)}
                  {seg.endTime ? ` - ${formatClockTime(seg.endTime, true)}` : ""}
                </p>
                <p className="text-sm text-[var(--color-primary)] break-words">
                  {getAppDescription(seg.appName, seg.displayTitle || undefined)}
                </p>
                {seg.pageUrl && (
                  <a
                    href={seg.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="meta-link mt-2"
                  >
                    <span className="meta-link-label">{formatLinkLabel(seg.pageUrl)}</span>
                  </a>
                )}
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                  {seg.appName}
                  {seg.displayTitle ? ` · ${seg.displayTitle}` : ""}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="block text-xs font-mono text-[var(--color-text-muted)]">
                  {formatDuration(seg.activeMinutes)}
                </span>
                {seg.count > 1 && (
                  <span className="block mt-1 text-[11px] text-[var(--color-text-muted)]">
                    合并 {seg.count} 条
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function DetailedTimeline({ segments, devices }: Props) {
  const [selectedGroup, setSelectedGroup] = useState<{ deviceName: string; group: TaskGroup } | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeModalState | null>(null);
  const [dragState, setDragState] = useState<{ deviceId: string; anchor: number; current: number } | null>(null);
  const [manualRanges, setManualRanges] = useState<Record<string, { start: string; end: string }>>({});

  const colorMap = useMemo(() => new Map<string, string>(), []);

  const deviceGroups = useMemo(() => {
    const byDevice = new Map<string, { device: DeviceState | undefined; segs: TimelineSegment[] }>();
    for (const seg of segments) {
      const current = byDevice.get(seg.device_id);
      if (current) {
        current.segs.push(seg);
      } else {
        byDevice.set(seg.device_id, {
          device: devices.find((device) => device.device_id === seg.device_id),
          segs: [seg],
        });
      }
    }

    return Array.from(byDevice.entries()).map(([deviceId, entry]) => {
      const groups = buildTaskGroups(entry.segs);
      const currentTasks = buildCurrentTaskGroups(entry.segs);
      const cutoff = Date.now() - 15 * 60 * 1000;
      const historySegments = sortSegmentsAsc(entry.segs).filter(
        (seg) => new Date(getSegmentEnd(seg)).getTime() < cutoff
      );

      return {
        deviceId,
        deviceName: entry.device?.device_name || entry.segs[0]?.device_name || deviceId,
        currentTasks,
        historyGroups: groups.filter((group) => new Date(group.endTime).getTime() < cutoff),
        historySegments,
        slots: buildTimelineSlots(historySegments, colorMap),
      };
    });
  }, [devices, segments, colorMap]);

  if (segments.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-muted)]">
        <p className="text-2xl mb-2">(^-ω-^=)</p>
        <p className="text-sm">今天还没有活动记录呢~</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {deviceGroups.map(({ deviceId, deviceName, currentTasks, historySegments, slots }) => {
          const manualRange = manualRanges[deviceId] || { start: "09:00", end: "10:00" };
          const activeSelection =
            dragState?.deviceId === deviceId
              ? normalizeSlotRange(dragState.anchor, dragState.current)
              : null;

          return (
            <section key={deviceId} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  📱 {deviceName}
                </h3>
                {currentTasks[0] && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    最新使用 {formatMinutesAgo(currentTasks[0].endTime)}
                  </span>
                )}
              </div>

              {currentTasks.length > 0 && (
                <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                      当前任务
                    </p>
                    <p className="text-sm text-[var(--color-primary)] font-semibold mt-1">
                      最近 15 分钟内活跃，按应用归并
                    </p>
                  </div>

                  {currentTasks.map((task, index) => {
                    const taskPageUrl = getLatestPageUrl(task.segments);

                    return (
                      <div
                        key={`${task.appName}-${task.endTime}-${index}`}
                        className="rounded-2xl bg-[var(--color-cream-light)] px-4 py-4 flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-[var(--color-primary)] break-words">
                            {getAppDescription(task.appName, task.displayTitle || undefined)}
                          </p>
                          {taskPageUrl && (
                            <a
                              href={taskPageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="meta-link mt-2"
                            >
                              <span className="meta-link-label">{formatLinkLabel(taskPageUrl)}</span>
                            </a>
                          )}
                          <p className="text-xs text-[var(--color-text-muted)] mt-2">
                            {task.appName}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
                            <span>{formatClockTime(task.startTime, true)} - {formatClockTime(task.endTime, true)}</span>
                            <span>活跃 {formatDuration(task.activeMinutes)}</span>
                            <span>最近 {formatMinutesAgo(task.endTime)}</span>
                            {task.segments.length > 1 && <span>合并 {task.segments.length} 条</span>}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setSelectedGroup({
                              deviceName,
                              group: {
                                appName: task.appName,
                                displayTitle: task.displayTitle || task.appName,
                                startTime: task.startTime,
                                endTime: task.endTime,
                                activeMinutes: task.activeMinutes,
                                segments: task.segments,
                              },
                            })
                          }
                          className="flex-shrink-0 rounded-full bg-[var(--color-primary)]/12 px-3 py-1.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition"
                        >
                          查看明细
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {historySegments.length > 0 && (
                <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 space-y-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                      其他时段任务
                    </p>
                    <p className="text-sm text-[var(--color-primary)] font-semibold mt-1">
                      每格 10 分钟，拖选或输入时间段查看这段时间在做什么
                    </p>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs text-[var(--color-text-muted)]">
                      开始
                      <input
                        type="time"
                        step={600}
                        value={manualRange.start}
                        onChange={(e) =>
                          setManualRanges((prev) => ({
                            ...prev,
                            [deviceId]: { ...manualRange, start: e.target.value },
                          }))
                        }
                        className="mt-1 block rounded-xl border border-[var(--color-border)] bg-[var(--color-cream-light)] px-3 py-2 text-sm text-[var(--color-primary)]"
                      />
                    </label>
                    <label className="text-xs text-[var(--color-text-muted)]">
                      结束
                      <input
                        type="time"
                        step={600}
                        value={manualRange.end}
                        onChange={(e) =>
                          setManualRanges((prev) => ({
                            ...prev,
                            [deviceId]: { ...manualRange, end: e.target.value },
                          }))
                        }
                        className="mt-1 block rounded-xl border border-[var(--color-border)] bg-[var(--color-cream-light)] px-3 py-2 text-sm text-[var(--color-primary)]"
                      />
                    </label>
                    <button
                      onClick={() => {
                        const startSlot = parseTimeToSlot(manualRange.start);
                        const endSlot = parseTimeToSlot(manualRange.end, true);
                        if (startSlot == null || endSlot == null) return;
                        const normalized = normalizeSlotRange(startSlot, endSlot);
                        setSelectedRange({
                          deviceName,
                          startSlot: normalized.startSlot,
                          endSlot: normalized.endSlot,
                          segments: getSegmentsForRange(historySegments, normalized.startSlot, normalized.endSlot),
                        });
                      }}
                      className="rounded-full bg-[var(--color-primary)]/12 px-4 py-2 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition"
                    >
                      查看时间段
                    </button>
                    <button
                      onClick={() =>
                        setSelectedRange({
                          deviceName,
                          startSlot: 0,
                          endSlot: TOTAL_SLOTS - 1,
                          segments: sortSegmentsAsc(historySegments),
                        })
                      }
                      className="rounded-full bg-[var(--color-primary)]/12 px-4 py-2 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition"
                    >
                      查看今天全部
                    </button>
                  </div>

                  <div className="rounded-2xl bg-[var(--color-cream-light)] p-4">
                    <div
                      className="select-none"
                      onPointerLeave={() => setDragState((prev) => (prev?.deviceId === deviceId ? prev : prev))}
                    >
                      <div className="-mx-1 overflow-x-auto pb-2 md:overflow-visible">
                        <div
                          className="grid gap-x-1 gap-y-2 items-start min-w-[44rem] px-1 md:min-w-0"
                          style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
                        >
                        {Array.from({ length: 24 }, (_, hour) => (
                          <div key={hour} className="min-w-0">
                            <div className="text-[10px] text-[var(--color-text-muted)] font-mono text-center mb-1 h-3">
                              {hour % 3 === 0 ? hour : ""}
                            </div>
                            <div className="grid grid-rows-6 gap-1">
                              {Array.from({ length: 6 }, (_, offset) => {
                                const slotIndex = hour * 6 + offset;
                                const slot = slots[slotIndex]!;
                                const isSelected =
                                  activeSelection &&
                                  slot.index >= activeSelection.startSlot &&
                                  slot.index <= activeSelection.endSlot;

                                return (
                                  <button
                                    key={slot.index}
                                    type="button"
                                    title={`${getSlotTimeLabel(slot.index)}${slot.appName ? ` · ${slot.appName}` : ""}`}
                                    onPointerDown={(e) => {
                                      e.preventDefault();
                                      setDragState({ deviceId, anchor: slot.index, current: slot.index });
                                    }}
                                    onPointerEnter={() =>
                                      setDragState((prev) =>
                                        prev?.deviceId === deviceId ? { ...prev, current: slot.index } : prev
                                      )
                                    }
                                    onPointerUp={() => {
                                      const state = dragState?.deviceId === deviceId
                                        ? normalizeSlotRange(dragState.anchor, slot.index)
                                        : normalizeSlotRange(slot.index, slot.index);
                                      setDragState(null);
                                      openRangeDetails(
                                        deviceName,
                                        historySegments,
                                        state.startSlot,
                                        state.endSlot,
                                        setSelectedRange
                                      );
                                    }}
                                    className="w-full aspect-square min-h-[1.35rem] rounded-[6px] border transition hover:scale-[1.03] touch-none"
                                    style={getSlotStyle(slot, !!isSelected)}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-[var(--color-text-muted)]">
                      <span>空白格表示这 10 分钟没有活动</span>
                      <span>彩色格表示这 10 分钟内活跃最多的应用</span>
                      <span>拖选后松手可直接看这段时间详情</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {selectedGroup && (
        <div
          className="fixed inset-0 bg-black/45 z-40 flex items-center justify-center p-4"
          onClick={() => setSelectedGroup(null)}
        >
          <div
            className="bg-[var(--color-cream)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[78vh] overflow-hidden border border-[var(--color-border)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-primary)]">{selectedGroup.deviceName}</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">当前任务详情</p>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="text-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
              <TaskDetails group={selectedGroup.group} />
            </div>
          </div>
        </div>
      )}

      {selectedRange && (
        <div
          className="fixed inset-0 bg-black/45 z-40 flex items-center justify-center p-4"
          onClick={() => setSelectedRange(null)}
        >
          <div
            className="bg-[var(--color-cream)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[78vh] overflow-hidden border border-[var(--color-border)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-primary)]">{selectedRange.deviceName}</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">时段活动详情</p>
              </div>
              <button
                onClick={() => setSelectedRange(null)}
                className="text-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
              <RangeDetails state={selectedRange} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
