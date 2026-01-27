import bcrypt from 'bcryptjs';
import { eq, and, gt } from 'drizzle-orm';
import { db, users, refreshTokens, userPreferences, NewUser } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  AuthPayload,
} from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput) {
  const { email, password, name } = input;

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (existingUser) {
    throw new AppError(409, 'User with this email already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    });

  // Create default preferences
  await db.insert(userPreferences).values({
    userId: user.id,
  });

  // Generate tokens
  const payload: AuthPayload = { userId: user.id, email: user.email };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token
  await storeRefreshToken(user.id, refreshToken);

  return {
    user,
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

export async function login(input: LoginInput) {
  const { email, password } = input;

  // Find user
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user) {
    throw new AppError(401, 'Invalid email or password');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    throw new AppError(401, 'Invalid email or password');
  }

  // Generate tokens
  const payload: AuthPayload = { userId: user.id, email: user.email };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token
  await storeRefreshToken(user.id, refreshToken);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

export async function refresh(token: string) {
  let payload: AuthPayload;

  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, 'Invalid refresh token');
  }

  // Check if token exists in database
  const storedToken = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.token, token),
      eq(refreshTokens.userId, payload.userId),
      gt(refreshTokens.expiresAt, new Date())
    ),
  });

  if (!storedToken) {
    throw new AppError(401, 'Invalid refresh token');
  }

  // Delete old token
  await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));

  // Generate new tokens
  const accessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  // Store new refresh token
  await storeRefreshToken(payload.userId, newRefreshToken);

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
}

export async function logout(userId: string, token?: string) {
  if (token) {
    // Delete specific token
    await db.delete(refreshTokens).where(
      and(eq(refreshTokens.userId, userId), eq(refreshTokens.token, token))
    );
  } else {
    // Delete all tokens for user
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }
}

export async function getMe(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return user;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const { currentPassword, newPassword } = input;

  // Find user with password
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password);

  if (!isValid) {
    throw new AppError(401, 'Current password is incorrect');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update password
  await db
    .update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Invalidate all refresh tokens for security
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

  return { success: true };
}

async function storeRefreshToken(userId: string, token: string) {
  // Calculate expiration (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.insert(refreshTokens).values({
    userId,
    token,
    expiresAt,
  });

  // Clean up old tokens (keep only last 5)
  const userTokens = await db.query.refreshTokens.findMany({
    where: eq(refreshTokens.userId, userId),
    orderBy: (tokens, { desc }) => [desc(tokens.createdAt)],
  });

  if (userTokens.length > 5) {
    const tokensToDelete = userTokens.slice(5);
    for (const t of tokensToDelete) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, t.id));
    }
  }
}
