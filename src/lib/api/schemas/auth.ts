import { z, EmailSchema, IsoDateSchema, SafeUserSchema } from "./common";

export const LoginInputSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(1),
    deviceId: z.string().min(1).max(128).optional(),
  })
  .openapi("LoginInput");

export const AuthTokensSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: IsoDateSchema,
    refreshExpiresAt: IsoDateSchema,
  })
  .openapi("AuthTokens");

export const LoginResponseSchema = z
  .object({
    user: SafeUserSchema,
    tokens: AuthTokensSchema,
  })
  .openapi("LoginResponse");

export const RefreshInputSchema = z
  .object({ refreshToken: z.string().min(1) })
  .openapi("RefreshInput");

export const RefreshResponseSchema = z
  .object({ tokens: AuthTokensSchema })
  .openapi("RefreshResponse");

export const LogoutInputSchema = z
  .object({ refreshToken: z.string().min(1).optional() })
  .openapi("LogoutInput");

export const RegisterInputSchema = z
  .object({
    name: z.string().min(1).max(120),
    email: EmailSchema,
    password: z.string().min(12).max(200),
    phone: z.string().min(7).max(20).optional(),
    city: z.string().max(120).optional(),
    ridingExperience: z.string().max(120).optional(),
    motorcycle: z.string().max(120).optional(),
    deviceId: z.string().min(1).max(128).optional(),
  })
  .openapi("RegisterInput");

export const SendOtpInputSchema = z
  .object({
    email: EmailSchema,
    purpose: z.enum(["email_verify", "password_reset"]).default("email_verify"),
  })
  .openapi("SendOtpInput");

export const VerifyOtpInputSchema = z
  .object({
    email: EmailSchema,
    code: z.string().min(4).max(10),
    purpose: z.enum(["email_verify", "password_reset"]).default("email_verify"),
  })
  .openapi("VerifyOtpInput");

export const ResetPasswordInputSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(12).max(200),
  })
  .openapi("ResetPasswordInput");

export const MeResponseSchema = z
  .object({ user: SafeUserSchema })
  .openapi("MeResponse");
