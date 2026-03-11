#!/usr/bin/env node
/**
 * Собирает оверлей для Twitch Hosted Test (тест на сервере).
 * Использует Vite-сборку (без inline-скриптов Next.js), чтобы проходить CSP Twitch.
 * Результат: twitch-extension.zip с index.html, video_overlay.html, config.html и assets/*.js
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const overlayDir = path.join(rootDir, "twitch-overlay");
const distDir = path.join(overlayDir, "dist");
const zipName = "twitch-extension.zip";
const backendUrl =
  process.env.OVERLAY_API_BASE || "https://crossout-twitch-backend-gx73.vercel.app";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  return r.status ?? 1;
}

console.log("Building Twitch overlay for Hosted Test (Vite, no inline scripts)...");
console.log("Backend URL:", backendUrl);

// 1. Установка зависимостей twitch-overlay
if (!fs.existsSync(path.join(overlayDir, "node_modules"))) {
  console.log("Installing twitch-overlay dependencies...");
  const status = run("npm", ["install"], { cwd: overlayDir });
  if (status !== 0) {
    console.error("npm install failed in twitch-overlay");
    process.exit(1);
  }
}

// 2. Vite build (только внешние скрипты — CSP Twitch не блокирует)
const viteBin = path.join(overlayDir, "node_modules", "vite", "bin", "vite.js");
if (!fs.existsSync(viteBin)) {
  console.error("Vite not found. Run: cd twitch-overlay && npm install");
  process.exit(1);
}
const buildStatus = run(process.execPath, [viteBin, "build"], {
  cwd: overlayDir,
  env: {
    ...process.env,
    OVERLAY_API_BASE: backendUrl,
    VITE_OVERLAY_API_BASE: backendUrl,
  },
});
if (buildStatus !== 0) {
  console.error("Vite build failed");
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error("Expected twitch-overlay/dist not found.");
  process.exit(1);
}

// 3. video_overlay.html — копия index.html (путь для "Видео: на весь экран")
const indexPath = path.join(distDir, "index.html");
if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, path.join(distDir, "video_overlay.html"));
  console.log("Created video_overlay.html");
}

// 4. config.html — минимальная страница настройки для стримера
const configHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Настройка расширения</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #1a1a1a; color: #eee; padding: 24px; max-width: 600px; margin: 0 auto; }
    h1 { font-size: 1.25rem; }
    p { opacity: 0.9; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Crossout Session Overlay</h1>
  <p>Оверлей статистики для стрима. Данные передаются программой prser с вашего ПК на backend. Установите расширение в слот Video Overlay и запустите трансляцию.</p>
</body>
</html>
`;
fs.writeFileSync(path.join(distDir, "config.html"), configHtml);
console.log("Created config.html");

// 5. ZIP
const zipPath = path.join(rootDir, zipName);
try {
  const isWin = process.platform === "win32";
  if (isWin) {
    const ps = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path "${distDir}\\*" -DestinationPath "${zipPath}" -Force`,
      ],
      { stdio: "inherit", cwd: rootDir }
    );
    if (ps.status !== 0) throw new Error("PowerShell Compress-Archive failed");
  } else {
    run("zip", ["-r", zipPath, "."], { cwd: distDir });
  }
  console.log("\nDone. ZIP:", zipPath);
} catch (e) {
  console.warn("\nZIP not created:", e.message);
  console.log("Create ZIP manually from twitch-overlay/dist and upload to Twitch Files tab.");
}
