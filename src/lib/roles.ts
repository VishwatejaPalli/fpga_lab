/**
 * Role-based access control configuration.
 *
 * Three roles: student (default), researcher (advanced), admin (full access).
 */

export type Role = "student" | "researcher" | "admin";

export interface RoleConfig {
  label: string;
  color: string;
  bgColor: string;
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
  jobPriority: number;
  canBatchProgram: boolean;
  canExportData: boolean;
  canReserveBoards: boolean;
  canUseNotebooks: boolean;
  canViewAnalytics: boolean;
  canGenerateApiKeys: boolean;
  canManageUsers: boolean;
  canManageBoards: boolean;
}

export const ROLE_CONFIG: Record<Role, RoleConfig> = {
  student: {
    label: "Student",
    color: "text-green-700",
    bgColor: "bg-green-100",
    maxConcurrentSessions: 1,
    sessionTimeoutMinutes: 30,
    jobPriority: 0,
    canBatchProgram: false,
    canExportData: false,
    canReserveBoards: false,
    canUseNotebooks: false,
    canViewAnalytics: false,
    canGenerateApiKeys: false,
    canManageUsers: false,
    canManageBoards: false,
  },
  researcher: {
    label: "Researcher",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    maxConcurrentSessions: 3,
    sessionTimeoutMinutes: 120,
    jobPriority: 5,
    canBatchProgram: true,
    canExportData: true,
    canReserveBoards: true,
    canUseNotebooks: true,
    canViewAnalytics: true,
    canGenerateApiKeys: true,
    canManageUsers: false,
    canManageBoards: false,
  },
  admin: {
    label: "Administrator",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    maxConcurrentSessions: 99,
    sessionTimeoutMinutes: 480,
    jobPriority: 10,
    canBatchProgram: true,
    canExportData: true,
    canReserveBoards: true,
    canUseNotebooks: true,
    canViewAnalytics: true,
    canGenerateApiKeys: true,
    canManageUsers: true,
    canManageBoards: true,
  },
};

export function getRoleConfig(role: string): RoleConfig {
  return ROLE_CONFIG[role as Role] || ROLE_CONFIG.student;
}

export function hasPermission(
  role: string,
  perm: keyof RoleConfig
): boolean {
  const cfg = getRoleConfig(role);
  const val = cfg[perm];
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val > 0;
  return !!val;
}

export function roleLevel(role: string): number {
  const levels: Record<string, number> = { student: 0, researcher: 1, admin: 2 };
  return levels[role] ?? 0;
}

export function isAtLeast(role: string, minimum: Role): boolean {
  return roleLevel(role) >= roleLevel(minimum);
}
