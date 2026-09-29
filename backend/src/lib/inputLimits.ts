import { z } from "zod";

// Maximum lengths for every client-supplied string (B-13). The DB columns are unbounded `text`, so
// these schemas are the only limit: without them a single request could store a 100 KB name (the
// body-size ceiling) and make every list and access response carry it.
export const LIMITS = {
  name: 200,
  customId: 100,
  sub: 255,
  provider: 50,
  label: 100,
  url: 2048,
  redirectUris: 50,
  search: 200,
  inviteToken: 256,
  id: 64,
  email: 320,
} as const;

export const nameField = z.string().min(1).max(LIMITS.name);
export const customIdField = z.string().min(1).max(LIMITS.customId);
export const subField = z.string().min(1).max(LIMITS.sub);
export const providerField = z.string().min(1).max(LIMITS.provider);
export const labelField = z.string().min(1).max(LIMITS.label);
export const urlField = z.string().url().max(LIMITS.url);
export const idField = z.string().min(1).max(LIMITS.id);
// Normalised so comparisons (e.g. an invitation bound to an email, B-19) are case-insensitive.
export const emailField = z.string().trim().toLowerCase().email().max(LIMITS.email);
export const redirectUrisField = z.array(urlField).max(LIMITS.redirectUris);
