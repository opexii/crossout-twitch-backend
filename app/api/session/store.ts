import type { SessionPayload } from "./update/route";

// Простое in-memory хранилище (на один инстанс serverless функции)
const sessions = new Map<string, SessionPayload>();

export function setSession(channelId: string, payload: SessionPayload) {
  sessions.set(channelId, payload);
}

export function getSession(channelId: string): SessionPayload | null {
  return sessions.get(channelId) ?? null;
}

export function listSessions() {
  return Array.from(sessions.values());
}

