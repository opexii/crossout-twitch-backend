"use client";

import React, { useEffect, useState } from "react";
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
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    setIsInIframe(typeof window !== "undefined" && window.self !== window.top);
  }, []);

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
        height: "100vh",
        padding: 12,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontSize: 15,
      }}
    >
      {!channelId && (
        <div style={{ fontSize: 14 }}>
          <p>Ожидание channelId от Twitch / URL…</p>
          {isInIframe && (
            <p style={{ fontSize: 15, opacity: 0.8, marginTop: 6 }}>
              На стриме подождите до 15 сек. Если не загрузится — откройте оверлей в браузере с <code style={{ fontSize: 11 }}>?channel=ВАШ_ID</code>.
            </p>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: "#5a1f1f",
            borderRadius: 4,
            fontSize: 15,
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
        <div
          className="overlay-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
          }}
        >
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
        </div>
      )}
    </div>
  );
}

function SessionHeader({ session }: { session: SessionResponseDto }) {
  const s = session.session;
  const winrate =
    s.wins + s.losses > 0 ? (s.wins / (s.wins + s.losses)) * 100 : 0;

  const ratingTabs = session.rating_tabs || [];
  const baseTab =
    ratingTabs.find((t) => t.id === "missions") || ratingTabs[0] || null;

  // Ср. урон именно с текущим оружием (из рейтинга по оружию), а не за всю сессию
  const avgDamageForWeapon = (() => {
    const raw = (s.weapon_set || "").trim();
    if (!raw || raw === "Неизвестно" || raw === "-" || !baseTab?.weapons?.length)
      return null;
    const weaponNames = raw
      .split(",")
      .map((p) => p.trim())
      .filter((v) => v && v !== "Неизвестно" && v !== "-" && !v.startsWith("CarPart_") && !v.startsWith("preset_") && !v.includes(":"));
    const firstWeaponName = weaponNames[0];
    if (!firstWeaponName) return null;
    const weaponRow = baseTab.weapons.find(
      (w) => w.name.trim() === firstWeaponName,
    );
    const playerRow = weaponRow?.player_rows?.find(
      (p) => p.nickname === session.nickname,
    );
    if (playerRow != null && typeof playerRow.avg_damage === "number")
      return playerRow.avg_damage;
    return null;
  })();

  const weaponLabel = (() => {
    const raw = (s.weapon_set || "").trim();
    if (!raw || raw === "Неизвестно" || raw === "-") return "—";
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const filtered = Array.from(
      new Set(
        parts.filter((p) => {
          const v = p.trim();
          if (!v || v === "Неизвестно" || v === "-") return false;
          if (v.startsWith("CarPart_")) return false;
          if (v.startsWith("preset_")) return false;
          if (v.includes(":")) return false;
          return true;
        }),
      ),
    );
    let name = filtered.length ? filtered.join(", ") : raw.includes("CarPart_") ? "—" : raw;
    const avgDmg = avgDamageForWeapon ?? (typeof s.avg_damage === "number" && s.avg_damage >= 0 ? s.avg_damage : null);
    if (name !== "—" && avgDmg != null) {
      name += ` (ср.урон: ${Math.round(avgDmg)})`;
    }
    return name;
  })();

  const ratingFromTable =
    baseTab?.players?.find((p) => p.nickname === session.nickname)?.rating ??
    null;
  const ratingToShow = ratingFromTable ?? s.rating;

  return (
    <div
      style={{
        marginTop: 8,
        padding: 8,
        borderRadius: 4,
        background: "#1c1c1c",
        border: "1px solid #333",
        fontSize: 15,
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
            Оружие: <span>{weaponLabel}</span>
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
            Рейтинг: <strong>{Math.round(ratingToShow)}</strong>
          </div>
          <div style={{ opacity: 0.8 }}>
            В игре: {formatDuration(s.duration_seconds)}
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
    fontSize: 15,
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
  const tabs = session.rating_tabs || [];

  // Fallback: если нет подробных данных рейтинга, показываем старый блок суммарной статистики.
  if (!tabs.length) {
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
          fontSize: 15,
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

  const [activeIdx, setActiveIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [weaponSearch, setWeaponSearch] = useState("");
  const [selectedNick, setSelectedNick] = useState<string | null>(null);
  const [selectedWeapon, setSelectedWeapon] = useState<string | null>(null);
  type SortDir = "asc" | "desc";
  type PlayerSortKey =
    | "place"
    | "nickname"
    | "rating"
    | "delta"
    | "games"
    | "kills"
    | "deaths"
    | "kd"
    | "avg_damage"
    | "avg_score"
    | "mvp"
    | "wr_percent";
  type WeaponSortKey =
    | "name"
    | "users"
    | "wr_percent"
    | "avg_damage"
    | "avg_kills";
  const [playerSort, setPlayerSort] = useState<{
    key: PlayerSortKey;
    dir: SortDir;
  }>({ key: "rating", dir: "desc" });
  const [weaponSort, setWeaponSort] = useState<{
    key: WeaponSortKey;
    dir: SortDir;
  }>({ key: "users", dir: "desc" }); // по умолчанию — по использованию
  const safeIdx = Math.min(Math.max(activeIdx, 0), tabs.length - 1);
  const active = tabs[safeIdx];

  useEffect(() => {
    setSelectedNick(null);
    setSelectedWeapon(null);
  }, [safeIdx]);

  const norm = search.trim().toLowerCase();
  const allPlayers = active.players || [];
  const allWeapons = active.weapons || [];
  const selectedWeaponRow = selectedWeapon
    ? allWeapons.find((w) => w.name === selectedWeapon) || null
    : null;

  let playersBase = allPlayers;
  if (selectedWeapon) {
    if (selectedWeaponRow?.player_rows?.length) {
      playersBase = selectedWeaponRow.player_rows;
    } else {
      // fallback для старых payload: только фильтр по списку оружия игрока
      playersBase = allPlayers.filter((p) =>
        (p.weapons || []).includes(selectedWeapon),
      );
    }
  }

  const filteredPlayersWithSearch = norm
    ? playersBase.filter((p) => p.nickname.toLowerCase().includes(norm))
    : playersBase;

  const filteredPlayers = [...filteredPlayersWithSearch].sort((a, b) => {
    const dir = playerSort.dir === "asc" ? 1 : -1;
    const k = playerSort.key;
    if (k === "nickname") {
      return (
        a.nickname.localeCompare(b.nickname, "ru", { sensitivity: "base" }) * dir
      );
    }
    const av =
      k === "delta"
        ? (a.delta ?? 0)
        : k === "place"
          ? a.place
          : (a as any)[k] ?? 0;
    const bv =
      k === "delta"
        ? (b.delta ?? 0)
        : k === "place"
          ? b.place
          : (b as any)[k] ?? 0;
    return (Number(av) - Number(bv)) * dir;
  });

  const weaponNorm = weaponSearch.trim().toLowerCase();
  const weaponsFilteredBySearch = weaponNorm
    ? allWeapons.filter((w) =>
        w.name.toLowerCase().includes(weaponNorm),
      )
    : allWeapons;
  const filteredWeaponsWithSelection = selectedNick
    ? weaponsFilteredBySearch.filter((w) =>
        (w.players || []).includes(selectedNick),
      )
    : weaponsFilteredBySearch;
  const filteredWeapons = [...filteredWeaponsWithSelection].sort((a, b) => {
    const dir = weaponSort.dir === "asc" ? 1 : -1;
    const k = weaponSort.key;
    if (k === "name") {
      return a.name.localeCompare(b.name, "ru", { sensitivity: "base" }) * dir;
    }
    const av = (a as any)[k] ?? 0;
    const bv = (b as any)[k] ?? 0;
    return (Number(av) - Number(bv)) * dir;
  });

  const selectedPlayer = selectedNick
    ? allPlayers.find((p) => p.nickname === selectedNick) || null
    : null;

  const arrow = (activeKey: string, activeDir: SortDir, key: string) =>
    activeKey === key ? (activeDir === "desc" ? " ↓" : " ↑") : "";
  const toggleSort = <T extends string>(
    cur: { key: T; dir: SortDir },
    key: T,
    defaultDir: SortDir = "desc",
  ): { key: T; dir: SortDir } => {
    if (cur.key !== key) return { key, dir: defaultDir };
    return { key, dir: cur.dir === "desc" ? "asc" : "desc" };
  };

  return (
    <div style={{ marginTop: 10 }}>
      {/* Вкладки режимов рейтинга */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 8,
          borderBottom: "1px solid #333",
          paddingBottom: 4,
        }}
      >
        {tabs.map((t, idx) => {
          const isActive = idx === safeIdx;
          return (
            <button
              key={t.id || idx}
              type="button"
              onClick={() => setActiveIdx(idx)}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 15,
                backgroundColor: isActive ? "#2e7d32" : "transparent",
                color: isActive ? "#fff" : "#ddd",
              }}
            >
              {t.name || t.id}
            </button>
          );
        })}
      </div>

      {/* Поиск по никнейму и по оружию */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          fontSize: 15,
        }}
      >
        <span>Поиск:</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="По нику..."
          style={{
            flex: "0 0 140px",
            background: "#111",
            border: "1px solid #444",
            borderRadius: 4,
            padding: "4px 8px",
            color: "#eee",
            fontSize: 15,
          }}
        />
        <input
          value={weaponSearch}
          onChange={(e) => setWeaponSearch(e.target.value)}
          placeholder="По оружию..."
          style={{
            flex: "0 0 140px",
            background: "#111",
            border: "1px solid #444",
            borderRadius: 4,
            padding: "4px 8px",
            color: "#eee",
            fontSize: 15,
          }}
        />
        <span style={{ opacity: 0.7 }}>
          Игроков: {filteredPlayers.length}/{allPlayers.length}
        </span>
        {weaponNorm && (
          <span style={{ opacity: 0.7 }}>
            Оружие: {filteredWeapons.length}/{allWeapons.length}
          </span>
        )}
        {(selectedNick || selectedWeapon) && (
          <button
            type="button"
            onClick={() => {
              setSelectedNick(null);
              setSelectedWeapon(null);
            }}
            style={{
              marginLeft: "auto",
              border: "1px solid #444",
              background: "transparent",
              color: "#ddd",
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            Сбросить выбор
          </button>
        )}
      </div>

      {/* Две таблицы: игроки слева, оружие справа */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "3fr 2fr",
          gap: 10,
        }}
      >
        {/* Игроки */}
        <div
          style={{
            borderRadius: 4,
            background: "#1c1c1c",
            border: "1px solid #333",
            padding: 6,
          }}
        >
          <div style={{ marginBottom: 4, fontSize: 15, opacity: 0.9 }}>
            Игроки — {active.name}
            {selectedWeapon ? (
              <span style={{ opacity: 0.75 }}>
                {" "}
                (фильтр: оружие “{selectedWeapon}”)
              </span>
            ) : null}
          </div>
          <div className="overlay-scroll-x" style={{ overflowX: "auto", minWidth: 0 }}>
            <table
              style={{
                width: "100%",
                minWidth: 480,
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(toggleSort(playerSort, "place", "asc"))
                    }
                  >
                    #{arrow(playerSort.key, playerSort.dir, "place")}
                  </th>
                  <th
                    style={{ ...thStyle, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(toggleSort(playerSort, "nickname", "asc"))
                    }
                  >
                    Никнейм{arrow(playerSort.key, playerSort.dir, "nickname")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(toggleSort(playerSort, "rating", "desc"))
                    }
                  >
                    Рейтинг{arrow(playerSort.key, playerSort.dir, "rating")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(toggleSort(playerSort, "delta", "desc"))
                    }
                  >
                    Δ{arrow(playerSort.key, playerSort.dir, "delta")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(toggleSort(playerSort, "games", "desc"))
                    }
                  >
                    Бои{arrow(playerSort.key, playerSort.dir, "games")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(toggleSort(playerSort, "kills", "desc"))
                    }
                  >
                    Убил{arrow(playerSort.key, playerSort.dir, "kills")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(toggleSort(playerSort, "deaths", "desc"))
                    }
                  >
                    Убит{arrow(playerSort.key, playerSort.dir, "deaths")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(toggleSort(playerSort, "kd", "desc"))
                    }
                  >
                    K/D{arrow(playerSort.key, playerSort.dir, "kd")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(toggleSort(playerSort, "avg_damage", "desc"))
                    }
                  >
                    Ср. урон{arrow(playerSort.key, playerSort.dir, "avg_damage")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(toggleSort(playerSort, "avg_score", "desc"))
                    }
                  >
                    Ср. очки{arrow(playerSort.key, playerSort.dir, "avg_score")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(toggleSort(playerSort, "mvp", "desc"))
                    }
                  >
                    MVP{arrow(playerSort.key, playerSort.dir, "mvp")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setPlayerSort(
                        toggleSort(playerSort, "wr_percent", "desc"),
                      )
                    }
                  >
                    W/R{arrow(playerSort.key, playerSort.dir, "wr_percent")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p, idx) => {
                  const delta = p.delta ?? 0;
                  const rowBg =
                    delta > 0
                      ? "#1e3d1e"
                      : delta < 0
                        ? "#3d1e1e"
                        : idx % 2 === 1
                          ? "rgba(255,255,255,0.02)"
                          : "transparent";
                  const deltaStr =
                    delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : "";
                  const isSelected = selectedNick === p.nickname;
                  return (
                    <tr
                      key={p.nickname + idx}
                      style={{
                        backgroundColor: isSelected
                          ? "rgba(255,255,255,0.08)"
                          : rowBg,
                        color:
                          delta > 0
                            ? "#90EE90"
                            : delta < 0
                              ? "#ffb3b3"
                              : undefined,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setSelectedWeapon(null);
                        setSelectedNick((prev) =>
                          prev === p.nickname ? null : p.nickname,
                        );
                      }}
                    >
                      <td style={tdStyleCentered}>{p.place}</td>
                      <td style={tdStyle}>{p.nickname}</td>
                      <td style={tdStyleCentered}>{Math.round(p.rating)}</td>
                      <td style={tdStyleCentered}>{deltaStr}</td>
                      <td style={tdStyleCentered}>{p.games}</td>
                      <td style={tdStyleCentered}>{p.kills}</td>
                      <td style={tdStyleCentered}>{p.deaths}</td>
                      <td style={tdStyleCentered}>{p.kd.toFixed(2)}</td>
                      <td style={tdStyleCentered}>
                        {Math.round(p.avg_damage)}
                      </td>
                      <td style={tdStyleCentered}>
                        {Math.round(p.avg_score)}
                      </td>
                      <td style={tdStyleCentered}>{p.mvp}</td>
                      <td style={tdStyleCentered}>
                        {p.wr_percent.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Оружие */}
        <div
          style={{
            borderRadius: 4,
            background: "#1c1c1c",
            border: "1px solid #333",
            padding: 6,
          }}
        >
          <div style={{ marginBottom: 4, fontSize: 15, opacity: 0.9 }}>
            Оружие — {active.name}
            {selectedNick ? (
              <span style={{ opacity: 0.75 }}>
                {" "}
                (игрок: {selectedNick}
                {selectedPlayer?.weapons?.length
                  ? ` — ${selectedPlayer.weapons.join(", ")}`
                  : ""}
                )
              </span>
            ) : null}
          </div>
          <div className="overlay-scroll-x" style={{ overflowX: "auto", minWidth: 0 }}>
            <table
              style={{
                width: "100%",
                minWidth: 320,
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{ ...thStyle, cursor: "pointer" }}
                    onClick={() =>
                      setWeaponSort(toggleSort(weaponSort, "name", "asc"))
                    }
                  >
                    Оружие{arrow(weaponSort.key, weaponSort.dir, "name")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setWeaponSort(toggleSort(weaponSort, "users", "desc"))
                    }
                  >
                    Исп.{arrow(weaponSort.key, weaponSort.dir, "users")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setWeaponSort(
                        toggleSort(weaponSort, "wr_percent", "desc"),
                      )
                    }
                  >
                    W/R%{arrow(weaponSort.key, weaponSort.dir, "wr_percent")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setWeaponSort(
                        toggleSort(weaponSort, "avg_damage", "desc"),
                      )
                    }
                  >
                    Ср. урон{arrow(weaponSort.key, weaponSort.dir, "avg_damage")}
                  </th>
                  <th
                    style={{ ...thStyleCentered, cursor: "pointer" }}
                    onClick={() =>
                      setWeaponSort(
                        toggleSort(weaponSort, "avg_kills", "desc"),
                      )
                    }
                  >
                    Ср. фраги{arrow(weaponSort.key, weaponSort.dir, "avg_kills")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredWeapons.map((w, idx) => {
                  const isSelected = selectedWeapon === w.name;
                  return (
                    <tr
                      key={w.name + idx}
                      style={{
                        backgroundColor: isSelected
                          ? "rgba(255,255,255,0.08)"
                          : idx % 2 === 1
                            ? "rgba(255,255,255,0.02)"
                            : "transparent",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setSelectedNick(null);
                        setSelectedWeapon((prev) =>
                          prev === w.name ? null : w.name,
                        );
                      }}
                    >
                      <td style={tdStyle}>{w.name}</td>
                      <td style={tdStyleCentered}>{w.users}</td>
                      <td style={tdStyleCentered}>
                        {w.wr_percent.toFixed(0)}%
                      </td>
                      <td style={tdStyleCentered}>
                        {Math.round(w.avg_damage)}
                      </td>
                      <td style={tdStyleCentered}>
                        {w.avg_kills.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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

  const rowH = 24;
  const headerH = 28;
  const maxVisibleRows = 10;
  const shouldScroll = fights.length > maxVisibleRows;

  const formatFightDuration = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        marginTop: 8,
        borderRadius: 4,
        border: "1px solid #333",
      }}
    >
      <div
        className="overlay-scroll overlay-scroll-x"
        style={{
          overflowY: shouldScroll ? "auto" : "visible",
          overflowX: "auto",
          maxHeight: shouldScroll ? headerH + rowH * maxVisibleRows : undefined,
          borderRadius: 4,
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 520,
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead
            style={{
              background: "#222",
              position: "sticky",
              top: 0,
              zIndex: 1,
            }}
          >
            <tr>
              <th style={thStyleCentered}>#</th>
              <th style={thStyle}>Карта</th>
              <th style={thStyle}>Режим</th>
              <th style={thStyle}>Результат</th>
              <th style={thStyleCentered}>Киллы</th>
              <th style={thStyleCentered}>Смерти</th>
              <th style={thStyleCentered}>Урон</th>
              <th style={thStyleCentered}>Очки</th>
              <th style={thStyleCentered}>Время</th>
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
                f.is_win === true
                  ? "Победа"
                  : f.is_win === false
                    ? "Поражение"
                    : "—";

              const fightNumber = fights.length - idx;
            const self = (f.players || []).find((p) => p.is_self);
            const fightKills = self ? self.kills : f.kills;
            const fightDeaths = self ? self.deaths : f.deaths;
            const fightDamage = self ? self.damage_dealt : f.damage;
            const fightScore = self ? self.score : f.score;
              return (
                <tr
                  key={idx}
                  style={{ background: bg, cursor: "pointer" }}
                  onClick={() => onSelect(idx)}
                >
                  <td style={tdStyleCentered}>{fightNumber}</td>
                  <td style={tdStyle}>{f.map || "—"}</td>
                  <td style={tdStyle}>{f.mode || "—"}</td>
                  <td style={tdStyle}>{resultText}</td>
                <td style={tdStyleCentered}>{fightKills}</td>
                <td style={tdStyleCentered}>{fightDeaths}</td>
                <td style={tdStyleCentered}>{Math.round(fightDamage)}</td>
                <td style={tdStyleCentered}>{fightScore}</td>
                  <td style={tdStyleCentered}>{formatFightDuration(f.duration)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "4px 6px",
  borderBottom: "1px solid #333",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const thStyleCentered: React.CSSProperties = {
  ...thStyle,
  textAlign: "center",
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

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDto | null>(
    selfPlayer ?? players[0] ?? null,
  );

  // Подсветка строк: по кому стрелял (damage_to_players) + кого убил (kills_to_players), как в основном приложении
  const highlightVictims = (() => {
    const d2p = selectedPlayer?.damage_to_players ?? {};
    const k2p = selectedPlayer?.kills_to_players ?? {};
    const s = new Set<string>();
    for (const nick of Object.keys(d2p)) {
      if (!nick || nick.includes(":")) continue;
      if ((d2p[nick] ?? 0) <= 0) continue;
      s.add(nick);
    }
    for (const [nick, count] of Object.entries(k2p)) {
      if (!nick || nick.includes(":")) continue;
      if (!count || count <= 0) continue;
      s.add(nick);
    }
    return s.size ? s : undefined;
  })();

  const killsToPlayers = selectedPlayer?.kills_to_players ?? {};

  // Группы (party): показываем 👥 только если в группе ≥2 человек
  const partyCounts: Record<number, number> = {};
  for (const p of players) {
    const pid = p.party ?? 0;
    if (pid > 0) partyCounts[pid] = (partyCounts[pid] || 0) + 1;
  }
  const realParties = new Set(
    Object.entries(partyCounts)
      .filter(([, count]) => count >= 2)
      .map(([pid]) => Number(pid)),
  );

  const team1: PlayerDto[] = [];
  const team2: PlayerDto[] = [];
  const unknown: PlayerDto[] = [];

  for (const p of players) {
    // Для режима «Вторжение» башни и левиафаны уже размечены по командам (1 и 2)
    // и попадают в те же таблицы, что и игроки.
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
        <div style={{ marginBottom: 4, fontSize: 15, opacity: 0.8 }}>
          Режим FFA — результаты по игрокам
        </div>
        <div className="overlay-scroll-x" style={{ overflowX: "auto", minWidth: 0 }}>
          <PlayersTable
            fight={fight}
            players={team1}
            showPlacement
            selectedPlayer={selectedPlayer}
            onSelectPlayer={setSelectedPlayer}
            highlightVictims={highlightVictims}
            killsToPlayers={killsToPlayers}
            realParties={realParties}
          />
        </div>
        <PlayerDetailsPanel player={selectedPlayer} fight={fight} />
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
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ marginBottom: 4, fontSize: 15, color: "#a5d6a7" }}>
          Команда 1
        </div>
        <div className="overlay-scroll-x" style={{ overflowX: "auto", minWidth: 0 }}>
          <PlayersTable
            fight={fight}
            players={leftTeam}
            selectedPlayer={selectedPlayer}
            onSelectPlayer={setSelectedPlayer}
            highlightVictims={highlightVictims}
            killsToPlayers={killsToPlayers}
            realParties={realParties}
          />
        </div>
      </div>
      <div
        style={{
          padding: 6,
          borderRadius: 4,
          background: "#1c1c1c",
          border: "1px solid #5d4037",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ marginBottom: 4, fontSize: 15, color: "#ef9a9a" }}>
          Команда 2
        </div>
        <div className="overlay-scroll-x" style={{ overflowX: "auto", minWidth: 0 }}>
          <PlayersTable
            fight={fight}
            players={rightTeam}
            alignRight
            selectedPlayer={selectedPlayer}
            onSelectPlayer={setSelectedPlayer}
            highlightVictims={highlightVictims}
            killsToPlayers={killsToPlayers}
            realParties={realParties}
          />
        </div>
      </div>
      {unknown.length > 0 && (
        <div
          style={{
            gridColumn: "1 / span 2",
            padding: 6,
            borderRadius: 4,
            background: "#1c1c1c",
            border: "1px solid #555",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <div style={{ marginBottom: 4, fontSize: 15, opacity: 0.8 }}>
            Без команды
          </div>
          <div className="overlay-scroll-x" style={{ overflowX: "auto", minWidth: 0 }}>
            <PlayersTable
              fight={fight}
              players={unknown}
              selectedPlayer={selectedPlayer}
              onSelectPlayer={setSelectedPlayer}
              highlightVictims={highlightVictims}
              killsToPlayers={killsToPlayers}
              realParties={realParties}
            />
          </div>
        </div>
      )}
      <div
        style={{
          gridColumn: "1 / span 2",
          marginTop: 6,
        }}
      >
        <PlayerDetailsPanel player={selectedPlayer} fight={fight} />
      </div>
    </div>
  );
}

const BOT_SYMBOL = "🤖";
const PARTY_SYMBOL = "👥";
const SKULL_SYMBOL = "💀";

function PlayersTable({
  players,
  showPlacement = false,
  selectedPlayer,
  onSelectPlayer,
  alignRight = false,
  highlightVictims,
  killsToPlayers = {},
  realParties = new Set<number>(),
}: {
  fight: FightDto;
  players: PlayerDto[];
  showPlacement?: boolean;
  selectedPlayer?: PlayerDto | null;
  onSelectPlayer?: (p: PlayerDto) => void;
  alignRight?: boolean;
  highlightVictims?: Set<string>;
  killsToPlayers?: Record<string, number>;
  realParties?: Set<number>;
}) {
  if (!players.length) {
    return <div style={{ fontSize: 15, opacity: 0.7 }}>Нет данных.</div>;
  }

  const formatNickname = (p: PlayerDto) => {
    const inParty = (p.party ?? 0) > 0 && realParties.has(p.party ?? 0);
    const skullCount = highlightVictims?.has(p.nickname)
      ? (killsToPlayers[p.nickname] ?? 0)
      : 0;
    const skulls = skullCount > 0 ? SKULL_SYMBOL.repeat(Math.min(skullCount, 5)) : "";
    // Левая таблица: черепа справа от никнейма. Правая таблица: черепа слева от никнейма.
    if (alignRight) {
      return <>{skulls && <>{skulls} </>}{p.nickname}{inParty && <> {PARTY_SYMBOL}</>}{p.is_bot && <> {BOT_SYMBOL}</>}</>;
    }
    return <>{p.is_bot && <>{BOT_SYMBOL} </>}{inParty && <>{PARTY_SYMBOL} </>}{p.nickname}{skulls && <> {skulls}</>}</>;
  };

  const displayWeapons = (p: PlayerDto) => {
    const raw = p.weapons && p.weapons.length ? p.weapons : p.weapons_def;
    const filtered = (raw || [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .filter((v) => v !== "Неизвестно" && v !== "-")
      .filter((v) => !v.startsWith("CarPart_") && !v.startsWith("preset_") && !v.includes(":"));
    const unique = Array.from(new Set(filtered));
    return unique.length ? unique.join(", ") : "—";
  };

  return (
    <table
      style={{
        width: "100%",
        minWidth: 520,
        borderCollapse: "collapse",
        fontSize: 13,
      }}
    >
      <thead>
        <tr>
          {showPlacement && <th style={thStyle}>#</th>}
          {!alignRight && (
            <>
              <th style={thStyle}>Игрок</th>
              <th style={thStyleCentered}>Оружие</th>
              <th style={thStyleCentered}>Урон</th>
              <th style={thStyleCentered}>Получил</th>
              <th style={thStyleCentered}>K</th>
              <th style={thStyleCentered}>D</th>
              <th style={thStyleCentered}>Очки</th>
              <th style={thStyleCentered}>ОМ</th>
            </>
          )}
          {alignRight && (
            <>
              <th style={thStyleCentered}>ОМ</th>
              <th style={thStyleCentered}>Очки</th>
              <th style={thStyleCentered}>D</th>
              <th style={thStyleCentered}>K</th>
              <th style={thStyleCentered}>Получил</th>
              <th style={thStyleCentered}>Урон</th>
              <th style={thStyleCentered}>Оружие</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Игрок</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {players.map((p, idx) => {
          const inParty = (p.party ?? 0) > 0 && realParties.has(p.party ?? 0);
          const nameStyle: React.CSSProperties = {
            fontWeight: p.is_self ? 700 : 400,
            color: p.is_self ? "#4caf50" : inParty ? "#81C784" : p.is_bot ? "#9e9e9e" : "#fff",
          };
          const placeLabel =
            showPlacement && p.placement != null ? p.placement : idx + 1;
          const isSelected =
            selectedPlayer && selectedPlayer.nickname === p.nickname;
          const isVictim =
            !isSelected &&
            highlightVictims &&
            highlightVictims.has(p.nickname);

          return (
            <tr
              key={p.nickname + idx}
              style={{
                backgroundColor:
                  isSelected
                    ? "rgba(255,255,255,0.08)"
                    : isVictim
                      ? "rgba(255,193,7,0.14)"
                      : "transparent",
                cursor: onSelectPlayer ? "pointer" : "default",
              }}
              onClick={() => onSelectPlayer?.(p)}
            >
              {showPlacement && <td style={tdStyleCentered}>{placeLabel}</td>}
              {!alignRight && (
                <>
                  <td style={tdStyle}>
                    <span style={nameStyle}>{formatNickname(p)}</span>
                  </td>
                  <td style={tdStyle}>
                    {displayWeapons(p)}
                  </td>
                  <td style={tdStyleCentered}>{Math.round(p.damage_dealt)}</td>
                  <td style={tdStyleCentered}>
                    {Math.round(p.damage_received)}
                  </td>
                  <td style={tdStyleCentered}>{p.kills}</td>
                  <td style={tdStyleCentered}>{p.deaths}</td>
                  <td style={tdStyleCentered}>{p.score}</td>
                  <td style={tdStyleCentered}>{p.power_score || ""}</td>
                </>
              )}
              {alignRight && (
                <>
                  <td style={tdStyleCentered}>{p.power_score || ""}</td>
                  <td style={tdStyleCentered}>{p.score}</td>
                  <td style={tdStyleCentered}>{p.deaths}</td>
                  <td style={tdStyleCentered}>{p.kills}</td>
                  <td style={tdStyleCentered}>
                    {Math.round(p.damage_received)}
                  </td>
                  <td style={tdStyleCentered}>{Math.round(p.damage_dealt)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {displayWeapons(p)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <span style={nameStyle}>{formatNickname(p)}</span>
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PlayerDetailsPanel({
  player,
  fight,
}: {
  player: PlayerDto | null;
  fight: FightDto;
}) {
  if (!player) {
    return null;
  }

  const damageTargets = player.damage_to_players
    ? Object.entries(player.damage_to_players).sort((a, b) => b[1] - a[1])
    : [];

  // Входящий урон: инверсия damage_to_players по всем игрокам боя
  const incomingMap = new Map<string, number>();
  for (const p of fight.players || []) {
    if (!p.damage_to_players) continue;
    if (p.nickname === player.nickname) continue;
    const dmg = p.damage_to_players[player.nickname];
    if (!dmg || dmg <= 0) continue;
    incomingMap.set(p.nickname, (incomingMap.get(p.nickname) || 0) + dmg);
  }
  const incomingTargets = Array.from(incomingMap.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div
      style={{
        padding: 8,
        borderRadius: 4,
        background: "#151515",
        border: "1px solid #333",
        fontSize: 14,
        overflowX: "auto",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 6,
        }}
      >
        <div>
          <div style={{ fontWeight: 600 }}>{player.nickname}</div>
          <div style={{ opacity: 0.8 }}>
            Оружие:{" "}
            {(player as any).weapons_with_damage ||
              (player.weapons?.length
                ? player.weapons.join(", ")
                : player.weapons_def.join(", ") || "—")}
          </div>
        </div>
        <div>
          <div>
            Урон: <strong>{Math.round(player.damage_dealt)}</strong>
          </div>
          <div>
            Получил: <strong>{Math.round(player.damage_received)}</strong>
          </div>
        </div>
        <div>
          <div>
            K / D:{" "}
            <strong>
              {player.kills} / {player.deaths}
            </strong>
          </div>
          <div>
            Очки: <strong>{player.score}</strong>
          </div>
        </div>
      </div>

      {(damageTargets.length > 0 || incomingTargets.length > 0) && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: "1px solid #333",
            display: "grid",
            gridTemplateColumns: "minmax(160px, 1fr) minmax(160px, 1fr)",
            gap: 12,
            minWidth: 360,
          }}
        >
          {/* Исходящий урон */}
          <div
            style={{
              borderRight: "1px solid #333",
              paddingRight: 8,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Нанес урон:
            </div>
            <div
              style={{
                maxHeight: 120,
                overflowY: "auto",
                paddingRight: 6,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 60px",
                  columnGap: 6,
                  fontSize: 10,
                  opacity: 0.7,
                  marginBottom: 2,
                }}
              >
                <span>Игрок</span>
                <span style={{ textAlign: "center" }}>Урон</span>
              </div>
              {damageTargets.map(([nick, dmg], idx) => (
                <div
                  key={nick}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 60px",
                    columnGap: 6,
                    borderBottom: "1px solid #222",
                    padding: "2px 4px",
                    backgroundColor:
                      idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                    borderRadius: 2,
                  }}
                >
                  <span>{nick}</span>
                  <span
                    style={{
                      fontWeight: 500,
                      textAlign: "center",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {Math.round(dmg)}
                  </span>
                </div>
              ))}
              {!damageTargets.length && (
                <div style={{ opacity: 0.6, fontSize: 11 }}>нет данных</div>
              )}
            </div>
          </div>

          {/* Входящий урон */}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Получил урон от
            </div>
            <div
              style={{
                maxHeight: 120,
                overflowY: "auto",
                paddingRight: 6,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 60px",
                  columnGap: 6,
                  fontSize: 10,
                  opacity: 0.7,
                  marginBottom: 2,
                }}
              >
                <span>Игрок</span>
                <span style={{ textAlign: "center" }}>Урон</span>
              </div>
              {incomingTargets.map(([nick, dmg], idx) => (
                <div
                  key={nick}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 60px",
                    columnGap: 6,
                    borderBottom: "1px solid #222",
                    padding: "2px 4px",
                    backgroundColor:
                      idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                    borderRadius: 2,
                  }}
                >
                  <span>{nick}</span>
                  <span
                    style={{
                      fontWeight: 500,
                      textAlign: "center",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {Math.round(dmg)}
                  </span>
                </div>
              ))}
              {!incomingTargets.length && (
                <div style={{ opacity: 0.6, fontSize: 11 }}>нет данных</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

