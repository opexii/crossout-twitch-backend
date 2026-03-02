export default function Home() {
  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        minHeight: "100vh",
        background: "#111",
        color: "#eee",
      }}
    >
      <h1>Crossout Twitch Backend</h1>
      <p>API для передачи статистики текущей сессии со стороннего приложения.</p>
      <p>Основные эндпоинты:</p>
      <ul>
        <li>
          <code>POST /api/session/update</code> — приём данных о текущей сессии.
        </li>
        <li>
          <code>GET /api/session/&lt;channelId&gt;</code> — выдача текущей сессии
          для зрителей/расширения.
        </li>
      </ul>
    </main>
  );
}

