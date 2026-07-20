import { createEmptySession, type UserSession } from "../types/propertyFilters";

const sessions = new Map<string, UserSession>();

export function getSession(userId: string): UserSession {
  if (!sessions.has(userId)) {
    sessions.set(userId, createEmptySession());
  }
  return sessions.get(userId)!;
}

export function updateSession(userId: string, updates: Partial<UserSession>) {
  const current = getSession(userId);

  sessions.set(userId, {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  });
}

export function clearSession(userId: string) {
  sessions.delete(userId);
}

export function resetSession(userId: string) {
    sessions.set(userId, createEmptySession());
}