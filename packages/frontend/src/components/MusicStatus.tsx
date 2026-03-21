import type { DeviceState } from "@/lib/api";

interface Props {
  devices: DeviceState[];
}

export default function MusicStatus({ devices }: Props) {
  const onlineDevices = devices.filter((d) => d.is_online === 1);

  const active = onlineDevices.sort((a, b) => {
    const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return tb - ta;
  })[0];

  const music = active?.extra?.music;
  const hasMusic = !!music?.title;
  const isPlaying = !!music?.playing;

  return (
    <div className="vn-bubble mb-6">
      <div className="px-5 py-4">
        <p className="text-xs text-[var(--color-text-muted)] mb-2 text-center">
          ♪ 音乐状态
        </p>

        {!hasMusic ? (
          <div className="text-center py-1">
            <p className="text-lg mb-1">(-.-) zzZ</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              音乐喵睡眠中
            </p>
          </div>
        ) : isPlaying ? (
          <div className="text-center">
            <p className="text-lg mb-1">(◕‿◕)♪</p>
            <p className="text-sm text-[var(--color-primary)] font-semibold leading-relaxed">
              音乐喵在听：{music.title} - {music.artist || "未知歌手"}
            </p>
            {music.album && (
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                专辑：{music.album}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-lg mb-1">(´-ω-`)♪</p>
            <p className="text-sm text-[var(--color-primary)] font-semibold leading-relaxed">
              音乐喵暂停ing：{music.title} - {music.artist || "未知歌手"}
            </p>
            {music.album && (
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                专辑：{music.album}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
