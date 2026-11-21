/** Shared password rules (browser + server). Mirror these in Supabase Auth settings. */
export const PASSWORD_MIN_LENGTH = 10;

export function validatePassword(password: string, email?: string): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > 128) return "Password must be at most 128 characters.";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) {
    return "Use at least three of: lowercase, uppercase, number, symbol.";
  }
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 3 && password.toLowerCase().includes(local)) {
    return "Password must not contain your email name.";
  }
  return null;
}
