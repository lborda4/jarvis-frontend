export const USER_ROLE = {
  USER: 'user',
  ADMIN: 'admin',
  ADVISOR: 'advisor',
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

export function isAdminRole(role: string | undefined | null): boolean {
  return role === USER_ROLE.ADMIN
}

export function isAdvisorRole(role: string | undefined | null): boolean { return role === USER_ROLE.ADVISOR }
