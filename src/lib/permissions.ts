import { UserRole, WhitelabelMembership } from '../types';

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN_GLOBAL: 'Administrador Global',
  GESTOR: 'Gestor',
  REPCAO: 'Recepcao',
  TERAPEUTA: 'Terapeuta',
};

const TENANT_ROLES: UserRole[] = ['GESTOR', 'REPCAO', 'TERAPEUTA'];

export function isAdminGlobal(roles: UserRole[] = []) {
  return roles.includes('ADMIN_GLOBAL');
}

export function isTenantRole(role: UserRole) {
  return TENANT_ROLES.includes(role);
}

export function hasRole(roles: UserRole[] | undefined = [], role: UserRole) {
  return roles.includes(role);
}

export function hasAnyRole(roles: UserRole[] | undefined = [], allowedRoles: UserRole[]) {
  return allowedRoles.some((role) => roles.includes(role));
}

export function getActiveMembership(
  memberships: WhitelabelMembership[] = [],
  whitelabelId?: string | null
) {
  if (!whitelabelId) return null;

  return memberships.find(
    (membership) => membership.whitelabelId === whitelabelId && membership.status === 'ATIVO'
  ) ?? null;
}

export function hasTenantRole(
  memberships: WhitelabelMembership[] = [],
  whitelabelId: string | null | undefined,
  role: UserRole
) {
  const membership = getActiveMembership(memberships, whitelabelId);
  return !!membership && membership.roles.includes(role);
}

export function canManageWhitelabels(roles: UserRole[] = []) {
  return isAdminGlobal(roles);
}

export function canManageTenantMembers(
  roles: UserRole[] = [],
  memberships: WhitelabelMembership[] = [],
  whitelabelId?: string | null
) {
  return isAdminGlobal(roles) || hasTenantRole(memberships, whitelabelId, 'GESTOR');
}

export function canManagePatients(
  roles: UserRole[] = [],
  memberships: WhitelabelMembership[] = [],
  whitelabelId?: string | null
) {
  return isAdminGlobal(roles) || hasAnyRole(getActiveMembership(memberships, whitelabelId)?.roles, ['GESTOR', 'REPCAO']);
}

export function canManageTherapists(
  roles: UserRole[] = [],
  memberships: WhitelabelMembership[] = [],
  whitelabelId?: string | null
) {
  return isAdminGlobal(roles) || hasTenantRole(memberships, whitelabelId, 'GESTOR');
}

export function canAccessClinicalRecords(
  roles: UserRole[] = [],
  memberships: WhitelabelMembership[] = [],
  whitelabelId?: string | null
) {
  return isAdminGlobal(roles) || hasAnyRole(getActiveMembership(memberships, whitelabelId)?.roles, ['GESTOR', 'TERAPEUTA']);
}
