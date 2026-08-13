/**
 * Хто адмін — простий allowlist пошт із env ADMIN_EMAILS (через кому). Без ролі
 * в БД і без RLS-ускладнень: адмін-дії йдуть через service-role клієнт на
 * сервері, а цей предикат вирішує, кого туди пускати. Порожній env = адмінів
 * немає (безпечний дефолт).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}
