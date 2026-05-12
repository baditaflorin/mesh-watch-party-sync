import { useEffect, useMemo, useRef, useState } from "react";
import { createClockSync, type MeshConfig, type YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Playback = {
  videoId: string;
  /** mesh-time ms when playback was anchored. */
  anchorMs: number;
  /** Position in seconds at anchor. */
  anchorPosSec: number;
  playing: boolean;
};

function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Bare 11-char ID
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(/^https?:/.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.hostname === "youtu.be") return url.pathname.slice(1, 12);
    if (url.hostname.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const m = url.pathname.match(/\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function Feature({ room, config }: Props) {
  void config;
  const [draft, setDraft] = useState("");
  const [, rerender] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const clock = useMemo(() => (room ? createClockSync(room.provider) : null), [room]);
  useEffect(() => () => clock?.destroy(), [clock]);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<Playback>("playback");
    const onChange = () => rerender((n) => n + 1);
    m.observe(onChange);
    return () => m.unobserve(onChange);
  }, [room]);

  if (!room || !clock) {
    return (
      <div className="wp-screen">
        <h1>watch party</h1>
        <p className="wp-status">Connecting…</p>
      </div>
    );
  }

  const playback = room.doc.getMap<Playback>("playback").get("current");

  const setVideo = () => {
    const id = parseYouTubeId(draft);
    if (!id) return;
    room.doc.getMap<Playback>("playback").set("current", {
      videoId: id,
      anchorMs: clock.meshNow(),
      anchorPosSec: 0,
      playing: true,
    });
    setDraft("");
  };

  const togglePlay = () => {
    if (!playback) return;
    const now = clock.meshNow();
    const elapsed = playback.playing ? (now - playback.anchorMs) / 1000 : 0;
    const nextPos = playback.anchorPosSec + elapsed;
    room.doc.getMap<Playback>("playback").set("current", {
      ...playback,
      anchorMs: now,
      anchorPosSec: nextPos,
      playing: !playback.playing,
    });
  };

  const seek = (deltaSec: number) => {
    if (!playback) return;
    const now = clock.meshNow();
    const elapsed = playback.playing ? (now - playback.anchorMs) / 1000 : 0;
    const nextPos = Math.max(0, playback.anchorPosSec + elapsed + deltaSec);
    room.doc.getMap<Playback>("playback").set("current", {
      ...playback,
      anchorMs: now,
      anchorPosSec: nextPos,
    });
  };

  const restart = () => {
    if (!playback) return;
    room.doc.getMap<Playback>("playback").set("current", {
      ...playback,
      anchorMs: clock.meshNow(),
      anchorPosSec: 0,
      playing: true,
    });
  };

  const clear = () => room.doc.getMap<Playback>("playback").delete("current");

  // Compute current playhead.
  let playheadSec = 0;
  if (playback) {
    const elapsed = playback.playing ? (clock.meshNow() - playback.anchorMs) / 1000 : 0;
    playheadSec = Math.max(0, playback.anchorPosSec + elapsed);
  }

  const embedSrc = playback
    ? `https://www.youtube.com/embed/${playback.videoId}?start=${Math.floor(playheadSec)}&autoplay=${
        playback.playing ? 1 : 0
      }&playsinline=1&modestbranding=1`
    : "";

  return (
    <div className="wp-screen">
      <header className="wp-header">
        <h1>watch party</h1>
        <p className="wp-status">
          {room.peerCount + 1} viewer{room.peerCount === 0 ? "" : "s"} · playback shared via mesh
        </p>
      </header>

      {!playback && (
        <form
          className="wp-load"
          onSubmit={(e) => {
            e.preventDefault();
            setVideo();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="paste a YouTube URL or 11-char ID"
          />
          <button type="submit" disabled={!parseYouTubeId(draft)}>
            load
          </button>
        </form>
      )}

      {playback && (
        <>
          <div className="wp-frame">
            <iframe
              ref={iframeRef}
              key={`${playback.videoId}-${Math.floor(playheadSec / 30)}-${playback.playing}`}
              src={embedSrc}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              title="watch party"
            />
          </div>
          <div className="wp-controls">
            <button type="button" onClick={() => seek(-10)}>
              ⏪ 10s
            </button>
            <button type="button" onClick={togglePlay}>
              {playback.playing ? "⏸ pause" : "▶ play"}
            </button>
            <button type="button" onClick={() => seek(10)}>
              10s ⏩
            </button>
            <button type="button" onClick={restart}>
              ⟲ restart
            </button>
          </div>
          <p className="wp-pos">
            playhead: {Math.floor(playheadSec / 60)}:
            {Math.floor(playheadSec % 60)
              .toString()
              .padStart(2, "0")}
          </p>
          <button type="button" className="wp-clear" onClick={clear}>
            clear video
          </button>
          <p className="wp-help">
            Drift is corrected every ~30 s by re-mounting the iframe at the mesh-time playhead.
            YouTube&apos;s autoplay policy may require one tap on each device.
          </p>
        </>
      )}
    </div>
  );
}
