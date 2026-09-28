import { Buffer } from "buffer";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hashedPassword = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hashedPassword}`;
}

export function verifyPassword(password: string, savedPassword: string) {
  const [salt, savedHash] = savedPassword.split(":");

  const hash = scryptSync(password, salt, 64);

  return timingSafeEqual(
    Buffer.from(savedHash, "hex"),
    hash
  );
}