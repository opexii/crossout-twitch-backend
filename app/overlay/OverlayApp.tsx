"use client";

import { useEffect, useState } from "react";
import { fetchSession } from "./api";
import { onChannelIdReady } from "./twitch";
import type { SessionResponseDto, FightDto } from "./types";

export function OverlayApp() {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [data, setData] = useState<SessionResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Получаем channelId из Twitch или query-параметра
  useEffect(() => {
    onChannelIdReady((id) => {
      setChannelId(id);
    });
  }, []);

  // Периодически опрашиваем backend
  useEffect(() => {
    if (!channelId) return;

    const id = channelId; // локальная неизменяемая копия для TypeScript

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const session = await fetchSession(id);
        if (!cancelled) {
          setData(session);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Ошибка загрузки");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    const timer = setInterval(load, 10000); // раз в 10 секунд

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [channelId]);

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        background: "rgba(0,0,0,0.85)",
        color: "#eee",
        minHeight: "100vh",
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      {!channelId && (
        <p style={{ fontSize: 14 }}>Ожидание channelId от Twitch / URL…</p>
      )}

      {channelId && (
        <p style={{ fontSize: 12, opacity: 0.7 }}>Канал: {channelId}</p>
      )}

      {error && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: "#5a1f1f",
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          Ошибка: {error}
        </div>
      )}

      {loading && <p style={{ marginTop: 8 }}>Загрузка…</p>}

      {!loading && !error && channelId && !data && (
        <p style={{ marginTop: 8, fontSize: 14 }}>
          Для этого канала нет активной сессии.
        </p>
      )}

      {data && (
        <>
          <SessionHeader session={data} />
          <FightsTable fights={data.fights} />
        </>
      )}
    </div>
  );
}

function SessionHeader({ session }: { session: SessionResponseDto }) {
  const s = session.session;
  const winrate =
    s.wins + s.losses > 0 ? (s.wins / (s.wins + s.losses)) * 100 : 0;

  return (
    <div
      style={{
        marginTop: 8,
        padding: 8,
        borderRadius: 4,
        background: "#1c1c1c",
        border: "1px solid #333",
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 600 }}>{session.nickname}</div>
          <div style={{ opacity: 0.8 }}>
            Набор: <span>{s.weapon_set || "—"}</span>
          </div>
        </div>
        <div>
          <div>
            Бои:{" "}
            <strong>
              {s.total_fights} (W {s.wins} / L {s.losses})
            </strong>
          </div>
          <div>
            Winrate: <strong>{winrate.toFixed(1)}%</strong>
          </div>
        </div>
        <div>
          <div>
            Киллы / Смерти:{" "}
            <strong>
              {s.kills} / {s.deaths}
            </strong>
          </div>
          <div>
            Ср. урон: <strong>{s.avg_damage.toFixed(0)}</strong>
          </div>
        </div>
        <div>
          <div>
            Рейтинг: <strong>{Math.round(s.rating)}</strong>
          </div>
          <div style={{ opacity: 0.8 }}>
            Длительность: {formatDuration(s.duration_seconds)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FightsTable({ fights }: { fights: FightDto[] }) {
  if (!fights.length) {
    return (
      <p style={{ marginTop: 8, fontSize: 13 }}>В текущей сессии ещё нет боёв.</p>
    );
  }

  return (
    <div
      style={{
        marginTop: 8,
        borderRadius: 4,
        overflow: "hidden",
        border: "1px solid #333",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
        }}
      >
        <thead style={{ background: "#222" }}>
          <tr>
            <th style={thStyle}>#</th>
            <th style={thStyle}>Карта</th>
            <th style={thStyle}>Режим</th>
            <th style={thStyle}>Результат</th>
            <th style={thStyle}>Киллы</th>
            <th style={thStyle}>Смерти</th>
            <th style={thStyle}>Урон</th>
            <th style={thStyle}>Очки</th>
            <th style={thStyle}>Время</th>
          </tr>
        </thead>
        <tbody>
          {fights.map((f, idx) => {
            const isWin = f.is_win === true;
            const bg = isWin ? "rgba(46, 125, 50, 0.18)" : "rgba(211, 47, 47, 0.18)";
            const resultText =
              f.is_win === true ? "Победа" : f.is_win === false ? "Поражение" : "—";

            return (
              <tr key={idx} style={{ background: bg }}>
                <td style={tdStyle}>{idx + 1}</td>
                <td style={tdStyle}>{f.map || "—"}</td>
                <td style={tdStyle}>{f.mode || "—"}</td>
                <td style={tdStyle}>{resultText}</td>
                <td style={tdStyleCentered}>{f.kills}</td>
                <td style={tdStyleCentered}>{f.deaths}</td>
                <td style={tdStyleCentered}>{Math.round(f.damage)}</td>
                <td style={tdStyleCentered}>{f.score}</td>
                <td style={tdStyleCentered}>{f.duration.toFixed(1)} c</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "4px 6px",
  borderBottom: "1px solid #333",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "3px 6px",
  borderBottom: "1px solid #222",
  whiteSpace: "nowrap",
};

const tdStyleCentered: React.CSSProperties = {
  ...tdStyle,
  textAlign: "center",
};

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${rest.toString().padStart(2, "0")}`;
}

