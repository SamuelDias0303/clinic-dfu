export const ROOT_COLLECTIONS = {
  users: 'users',
  whitelabels: 'whitelabels',
  legacyClients: 'clients',
  invites: 'invites',
} as const;

export const TENANT_COLLECTIONS = {
  members: 'members',
  patients: 'patients',
  therapists: 'therapists',
  appointments: 'appointments',
  evolutions: 'evolutions',
  anamneses: 'anamneses',
  auditLogs: 'auditLogs',
} as const;

export type RootCollection = typeof ROOT_COLLECTIONS[keyof typeof ROOT_COLLECTIONS];
export type TenantCollection = typeof TENANT_COLLECTIONS[keyof typeof TENANT_COLLECTIONS];

export function assertWhitelabelId(whitelabelId: string) {
  if (!whitelabelId || !whitelabelId.trim()) {
    throw new Error('whitelabelId e obrigatorio para acessar dados com escopo de whitelabel.');
  }
}

export function whitelabelDocPath(whitelabelId: string) {
  assertWhitelabelId(whitelabelId);
  return `${ROOT_COLLECTIONS.whitelabels}/${whitelabelId}`;
}

export function tenantCollectionPath(whitelabelId: string, collectionName: TenantCollection) {
  return `${whitelabelDocPath(whitelabelId)}/${collectionName}`;
}

export function tenantDocPath(whitelabelId: string, collectionName: TenantCollection, docId: string) {
  if (!docId || !docId.trim()) {
    throw new Error('docId e obrigatorio para acessar um documento com escopo de whitelabel.');
  }

  return `${tenantCollectionPath(whitelabelId, collectionName)}/${docId}`;
}

export function memberDocPath(whitelabelId: string, userId: string) {
  return tenantDocPath(whitelabelId, TENANT_COLLECTIONS.members, userId);
}

export function userDocPath(userId: string) {
  if (!userId || !userId.trim()) {
    throw new Error('userId e obrigatorio para acessar perfil de usuario.');
  }

  return `${ROOT_COLLECTIONS.users}/${userId}`;
}

export function legacyClientDocPath(clientId: string) {
  if (!clientId || !clientId.trim()) {
    throw new Error('clientId e obrigatorio para acessar cliente legado.');
  }

  return `${ROOT_COLLECTIONS.legacyClients}/${clientId}`;
}
