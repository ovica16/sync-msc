import jwt from "jsonwebtoken";
import { Rol, Disciplina } from "@/types";

const JWT_SECRET = process.env.JWT_SECRET || "sync-msc-secret-dev-2025";
const COOKIE_NAME = "sync_session";
const MAX_AGE = 60 * 60 * 8; // 8 horas

export interface SessionPayload {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  areas: string[];
  disciplina: Disciplina;
}

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: MAX_AGE });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, MAX_AGE };
