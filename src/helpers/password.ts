import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { buildApp } from "../index.js";
import { getRequiredEnv } from "./env.js";
import { v4 as uuid } from 'uuid';


dotenv.config();

const SALT_ROUNDS = 12;
const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const JWT_ACCESS_TTL_MINUTES = process.env['JWT_ACCESS_TTL_MINUTES'] ?? '60';
const JWT_REFRESH_TTL_HOURS = process.env['JWT_REFRESH_TTL_HOURS'] ?? '24';

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
  const accessToken = app.jwt.sign(payload, { expiresIn: `${JWT_ACCESS_TTL_MINUTES}m`, key: JWT_SECRET });
  return { accessToken };
}  

export const verifyAccessToken = async (token: string): Promise<string> => {
  const app = await buildApp();
  return app.jwt.verify(token, { key: JWT_SECRET }) as string;
};

export const generateRefreshToken = async (data: any): Promise<{ refreshToken: string; jti: string }> => {
  const app = await buildApp();
  const jti = uuid(); // unique token ID for rotation tracking

  const payload = { user: data, type: 'refresh', jti };
  const refreshToken = app.jwt.sign(payload, { expiresIn: `${JWT_REFRESH_TTL_HOURS}h`, key: JWT_SECRET });
  return { refreshToken, jti };
}

export const verifyRefreshToken = async (token: string): Promise<any> => {
  const app = await buildApp();
  return app.jwt.verify(token, { key: JWT_SECRET });
};