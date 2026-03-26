import bcrypt from 'bcrypt';

export interface DashboardUser {
  username: string;
  passwordHash: string;
}

function parseUsers(): DashboardUser[] {
  const raw = process.env.DASH_USERS_JSON;
  if (!raw) {
    console.warn('[dashboardUsers] DASH_USERS_JSON is not set. No dashboard users are configured.');
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as DashboardUser[] | unknown;
    if (!Array.isArray(parsed)) {
      console.error('[dashboardUsers] DASH_USERS_JSON must be a JSON array.');
      return [];
    }

    return parsed
      .filter((u: any) => typeof u?.username === 'string' && typeof u?.passwordHash === 'string')
      .map((u: any) => ({
        username: u.username,
        passwordHash: u.passwordHash,
      }));
  } catch (err) {
    console.error('[dashboardUsers] Failed to parse DASH_USERS_JSON:', err);
    return [];
  }
}

const dashboardUsers: DashboardUser[] = parseUsers();

export async function validateDashboardUser(
  username: string,
  password: string,
): Promise<DashboardUser | null> {
  const user = dashboardUsers.find((u) => u.username === username);
  if (!user) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  return user;
}

export function getDashboardUserByUsername(username: string): DashboardUser | null {
  const user = dashboardUsers.find((u) => u.username === username);
  return user ?? null;
}

