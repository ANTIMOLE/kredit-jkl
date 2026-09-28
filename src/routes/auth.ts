import {
  Router,
  Request,
  Response,
  NextFunction
} from "express";
import { randomUUID } from "crypto";

import { db } from "../db/database";
import { verifyPassword } from "../domain/password";

export interface AuthUser {
  iduser: number;
  username: string;
  idgroup: number;
  nama_group: string;
  idcabang: number;
  iddealer: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const sessions = new Map<string, AuthUser>();

export const authRouter = Router();

authRouter.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};

  const userData = db.prepare(`
    SELECT
      u.*,
      g.nama_group
    FROM master_user u
    JOIN master_group_user g
      ON g.idgroup = u.idgroup
    WHERE u.username = ?
      AND u.is_active = 1
  `).get(username) as any;

  const passwordBenar =
    userData &&
    verifyPassword(
      String(password ?? ""),
      userData.password_hash
    );

  if (!passwordBenar) {
    res.status(401).json({
      error: "Username atau password salah"
    });
    return;
  }

  const user: AuthUser = {
    iduser: userData.iduser,
    username: userData.username,
    idgroup: userData.idgroup,
    nama_group: userData.nama_group,
    idcabang: userData.idcabang,
    iddealer: userData.iddealer
  };

  const token = randomUUID();
  sessions.set(token, user);

  const menu = db.prepare(`
    SELECT
      m.idmenu,
      m.nama_menu,
      m.parent_menu,
      m.url_menu
    FROM mapping_group_menu mg
    JOIN master_menu m
      ON m.idmenu = mg.idmenu
    WHERE mg.idgroup = ?
      AND m.is_active = 1
    ORDER BY m.idmenu
  `).all(user.idgroup);

  res.json({
    token,
    user,
    menu
  });
});

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.header("x-token");

  if (!token) {
    res.status(401).json({
      error: "Belum login"
    });
    return;
  }

  const user = sessions.get(token);

  if (!user) {
    res.status(401).json({
      error: "Belum login"
    });
    return;
  }

  req.user = user;
  next();
}

export function requireGroup(...groups: string[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (
      !req.user ||
      !groups.includes(req.user.nama_group)
    ) {
      res.status(403).json({
        error: "Tidak punya hak akses"
      });
      return;
    }

    next();
  };
}