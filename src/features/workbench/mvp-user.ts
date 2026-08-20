export function getMvpUserId() {
  return process.env.SUPABASE_MVP_USER_ID ?? "00000000-0000-0000-0000-000000000001";
}
