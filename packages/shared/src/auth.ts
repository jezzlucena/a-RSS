import { z } from 'zod';

export const emailSchema = z.string().email().toLowerCase().trim();

export const signupRequest = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64).optional(),
});
export type SignupRequest = z.infer<typeof signupRequest>;

export const loginRequest = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof loginRequest>;

export const magicRequest = z.object({
  email: emailSchema,
});
export type MagicRequest = z.infer<typeof magicRequest>;

export const magicConsumeRequest = z.object({
  token: z.string().min(16).max(256),
});
export type MagicConsumeRequest = z.infer<typeof magicConsumeRequest>;

export const googleAuthRequest = z.object({
  idToken: z.string().min(16),
});
export type GoogleAuthRequest = z.infer<typeof googleAuthRequest>;

export const appleAuthRequest = z.object({
  identityToken: z.string().min(16),
  email: z.string().email().optional(),
  fullName: z
    .object({
      givenName: z.string().nullable().optional(),
      familyName: z.string().nullable().optional(),
    })
    .optional(),
});
export type AppleAuthRequest = z.infer<typeof appleAuthRequest>;

export const setAnthropicApiKeyRequest = z.object({
  apiKey: z.string().trim().min(20).max(256),
});
export type SetAnthropicApiKeyRequest = z.infer<typeof setAnthropicApiKeyRequest>;

export const changePasswordRequest = z.object({
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: z.string().min(8).max(128),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequest>;

export const meResponse = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  authMethods: z.array(z.enum(['password', 'magic', 'google', 'apple'])),
  hasAnthropicApiKey: z.boolean(),
});
export type MeResponse = z.infer<typeof meResponse>;

export const authTokensResponse = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type AuthTokensResponse = z.infer<typeof authTokensResponse>;
