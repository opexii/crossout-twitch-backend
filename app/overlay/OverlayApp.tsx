"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { fetchSession } from "./api";
import { onChannelIdReady } from "./twitch";
import type { SessionResponseDto, FightDto, PlayerDto } from "./types";

type TabId = "history" | "rating";

export function OverlayApp() {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [data, setData] = useState<SessionResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("history");
  const [selectedFightIndex, setSelectedFightIndex] = useState<number>(0);

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
        // Полный индикатор "Загрузка..." показываем только при первом запросе
        if (!hasLoadedOnce) {
          setLoading(true);
        }
        setError(null);
        const session = await fetchSession(id);
        if (!cancelled) {
          setData(session);
          setHasLoadedOnce(true);
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

      {loading && !hasLoadedOnce && (
        <p style={{ marginTop: 8 }}>Загрузка…</p>
      )}

      {!loading && !error && channelId && !data && (
        <p style={{ marginTop: 8, fontSize: 14 }}>
          Для этого канала нет активной сессии.
        </p>
      )}

      {data && (
        <>
          <SessionHeader session={data} />

          <Tabs active={activeTab} onChange={setActiveTab} />

          {activeTab === "history" && (
            <HistoryView
              fights={data.fights}
              selectedIndex={selectedFightIndex}
              onSelect={setSelectedFightIndex}
            />
          )}

          {activeTab === "rating" && <RatingView session={data} />}
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
            Оружие: <span>{s.weapon_set || "—"}</span>
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

function Tabs({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  const baseStyle: React.CSSProperties = {
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: 13,
  };
  const activeStyle: React.CSSProperties = {
    ...baseStyle,
    borderBottom: "2px solid #4caf50",
    color: "#fff",
  };
  const inactiveStyle: React.CSSProperties = {
    ...baseStyle,
    opacity: 0.7,
  };

  return (
    <div
      style={{
        marginTop: 8,
        borderBottom: "1px solid #333",
        display: "flex",
        gap: 8,
      }}
    >
      <div
        style={active === "history" ? activeStyle : inactiveStyle}
        onClick={() => onChange("history")}
      >
        История
      </div>
      <div
        style={active === "rating" ? activeStyle : inactiveStyle}
        onClick={() => onChange("rating")}
      >
        Рейтинг
      </div>
    </div>
  );
}

function HistoryView({
  fights,
  selectedIndex,
  onSelect,
}: {
  fights: FightDto[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  if (!fights.length) {
    return (
      <p style={{ marginTop: 8, fontSize: 13 }}>В текущей сессии ещё нет боёв.</p>
    );
  }

  // В fights порядок от старых к новым — разворачиваем, чтобы новые были сверху.
  const orderedFights = [...fights].reverse();

  const clampedIndex = Math.min(
    Math.max(selectedIndex, 0),
    orderedFights.length - 1,
  );
  const selectedFight = orderedFights[clampedIndex];

  return (
    <>
      <FightsTable
        fights={orderedFights}
        selectedIndex={clampedIndex}
        onSelect={onSelect}
      />
      <FightTeamsPanel fight={selectedFight} />
    </>
  );
}

function RatingView({ session }: { session: SessionResponseDto }) {
  const s = session.session;
  const fights = s.total_fights || 0;
  const kd = s.deaths > 0 ? s.kills / s.deaths : s.kills;
  const winrate =
    s.wins + s.losses > 0 ? (s.wins / (s.wins + s.losses)) * 100 : 0;

  return (
    <div
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 4,
        background: "#1c1c1c",
        border: "1px solid #333",
        fontSize: 13,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
      }}
    >
      <StatBlock label="Боев" value={fights} />
      <StatBlock label="Победы" value={s.wins} />
      <StatBlock label="Поражения" value={s.losses} />
      <StatBlock label="Winrate" value={`${winrate.toFixed(1)}%`} />
      <StatBlock label="Киллы" value={s.kills} />
      <StatBlock label="Смерти" value={s.deaths} />
      <StatBlock label="K/D" value={kd.toFixed(2)} />
      <StatBlock label="Ср. урон" value={s.avg_damage.toFixed(0)} />
      <StatBlock label="Рейтинг" value={Math.round(s.rating)} />
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div style={{ opacity: 0.7, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function FightsTable({
  fights,
  selectedIndex,
  onSelect,
}: {
  fights: FightDto[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
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
            const isSelected = idx === selectedIndex;
            const bgBase = isWin
              ? "rgba(46, 125, 50, 0.18)"
              : "rgba(211, 47, 47, 0.18)";
            const bg = isSelected ? "rgba(255,255,255,0.15)" : bgBase;
            const resultText =
              f.is_win === true ? "Победа" : f.is_win === false ? "Поражение" : "—";

            return (
              <tr
                key={idx}
                style={{ background: bg, cursor: "pointer" }}
                onClick={() => onSelect(idx)}
              >
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

function FightTeamsPanel({ fight }: { fight: FightDto }) {
  const players = fight.players || [];

  if (!players.length) {
    return null;
  }

  const isFfa = fight.is_ffa;

  // Определяем команду текущего игрока, чтобы его команда всегда была слева
  const selfPlayer = players.find((p) => p.is_self);
  const selfTeam = selfPlayer?.team ?? null;

  const team1: PlayerDto[] = [];
  const team2: PlayerDto[] = [];
  const unknown: PlayerDto[] = [];

  for (const p of players) {
    if (isFfa) {
      team1.push(p);
    } else if (p.team === 1 || p.team === "1") {
      team1.push(p);
    } else if (p.team === 2 || p.team === "2") {
      team2.push(p);
    } else {
      unknown.push(p);
    }
  }

  if (isFfa) {
    // Сортируем по месту, потом по урону
    team1.sort((a, b) => {
      const pa = a.placement ?? 999;
      const pb = b.placement ?? 999;
      if (pa !== pb) return pa - pb;
      return b.damage_dealt - a.damage_dealt;
    });
    return (
      <div
        style={{
          marginTop: 8,
          padding: 8,
          borderRadius: 4,
          background: "#1c1c1c",
          border: "1px solid #333",
        }}
      >
        <div style={{ marginBottom: 4, fontSize: 13, opacity: 0.8 }}>
          Режим FFA — результаты по игрокам
        </div>
        <PlayersTable fight={fight} players={team1} showPlacement />
      </div>
    );
  }

  // Обычный режим: две команды. Гарантируем, что команда текущего игрока (если есть) слева.
  let leftTeam = team1;
  let rightTeam = team2;

  if (selfTeam !== null) {
    const selfInTeam1 = team1.some((p) => p.team === selfTeam);
    const selfInTeam2 = team2.some((p) => p.team === selfTeam);
    if (!selfInTeam1 && selfInTeam2) {
      leftTeam = team2;
      rightTeam = team1;
    }
  }

  leftTeam.sort((a, b) => b.damage_dealt - a.damage_dealt);
  rightTeam.sort((a, b) => b.damage_dealt - a.damage_dealt);

  return (
    <div
      style={{
        marginTop: 8,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
      }}
    >
      <div
        style={{
          padding: 6,
          borderRadius: 4,
          background: "#1c1c1c",
          border: "1px solid #355a3a",
        }}
      >
        <div style={{ marginBottom: 4, fontSize: 13, color: "#a5d6a7" }}>
          Команда 1
        </div>
        <PlayersTable fight={fight} players={leftTeam} />
      </div>
      <div
        style={{
          padding: 6,
          borderRadius: 4,
          background: "#1c1c1c",
          border: "1px solid #5d4037",
        }}
      >
        <div style={{ marginBottom: 4, fontSize: 13, color: "#ef9a9a" }}>
          Команда 2
        </div>
        <PlayersTable fight={fight} players={rightTeam} />
      </div>
      {unknown.length > 0 && (
        <div
          style={{
            gridColumn: "1 / span 2",
            padding: 6,
            borderRadius: 4,
            background: "#1c1c1c",
            border: "1px solid #555",
          }}
        >
          <div style={{ marginBottom: 4, fontSize: 13, opacity: 0.8 }}>
            Без команды
          </div>
            <PlayersTable fight={fight} players={unknown} />
        </div>
      )}
    </div>
  );
}

function PlayersTable({
  players,
  showPlacement = false,
}: {
  fight: FightDto;
  players: PlayerDto[];
  showPlacement?: boolean;
}) {
  if (!players.length) {
    return <div style={{ fontSize: 12, opacity: 0.7 }}>Нет данных.</div>;
  }

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 11,
      }}
    >
      <thead>
        <tr>
          {showPlacement && <th style={thStyle}>#</th>}
          <th style={thStyle}>Игрок</th>
          <th style={thStyle}>Оружие</th>
          <th style={thStyle}>Урон</th>
          <th style={thStyle}>Получил</th>
          <th style={thStyle}>K</th>
          <th style={thStyle}>D</th>
          <th style={thStyle}>Очки</th>
          <th style={thStyle}>ОМ</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p, idx) => {
          const nameStyle: React.CSSProperties = {
            fontWeight: p.is_self ? 700 : 400,
            color: p.is_self ? "#4caf50" : p.is_bot ? "#9e9e9e" : "#fff",
          };
          const placeLabel =
            showPlacement && p.placement != null ? p.placement : idx + 1;

          const damageTargets = p.damage_to_players
            ? Object.entries(p.damage_to_players).sort((a, b) => b[1] - a[1])
            : [];

          return (
            <tr key={p.nickname + idx}>
              {showPlacement && <td style={tdStyleCentered}>{placeLabel}</td>}
              <td style={tdStyle}>
                <span style={nameStyle}>{p.nickname}</span>
                {p.is_bot && (
                  <span style={{ opacity: 0.6, marginLeft: 4 }}>(бот)</span>
                )}
                {damageTargets.length > 0 && (
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 10,
                      opacity: 0.85,
                      maxWidth: 260,
                    }}
                  >
                    Урон по:
                    {damageTargets.slice(0, 6).map(([nick, dmg]) => (
                      <div key={nick}>
                        • {nick}: {Math.round(dmg)}
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td style={tdStyle}>
                {p.weapons && p.weapons.length
                  ? p.weapons.join(", ")
                  : p.weapons_def.join(", ")}
              </td>
              <td style={tdStyleCentered}>{Math.round(p.damage_dealt)}</td>
              <td style={tdStyleCentered}>{Math.round(p.damage_received)}</td>
              <td style={tdStyleCentered}>{p.kills}</td>
              <td style={tdStyleCentered}>{p.deaths}</td>
              <td style={tdStyleCentered}>{p.score}</td>
              <td style={tdStyleCentered}>{p.power_score || ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${rest.toString().padStart(2, "0")}`;
}

