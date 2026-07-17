import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { buildApp } from "../index.js";
import { getRequiredEnv } from "./env.js";

dotenv.config();

const SALT_ROUNDS = 12;
const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const JWT_ACCESS_TTL_MINUTES = process.env['JWT_ACCESS_TTL_MINUTES'] ?? '60';

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export const verifyPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
}

export const generateAccessToken = async (data: any): Promise<{ accessToken: string; }> => {
  const app = await buildApp();

  const payload = { user: data, type: 'access'};
  const accessToken = app.jwt.sign(payload, { expiresIn: `${JWT_ACCESS_TTL_MINUTES}m` });
  return { accessToken };
}  

export const verifyAccessToken = async (token: string): Promise<string> => {
  const app = await buildApp();
  return app.jwt.verify(token, { key: JWT_SECRET }) as string;
};