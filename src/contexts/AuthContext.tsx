import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { MembershipStatus, User, UserRole, WhitelabelMembership } from '../types';
import { ROOT_COLLECTIONS, TENANT_COLLECTIONS } from '../lib/tenantPaths';
import { LEGACY_WHITELABEL_ID } from '../services/serviceScope';
import { personalWorkspaceService } from '../services/personalWorkspaceService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  setActiveRole: (role: UserRole) => void;
  setActiveWhitelabel: (whitelabelId: string) => void;
  returnToGlobalAdmin: () => void;
  enterWhitelabelAsGestor: (whitelabelId: string, whitelabelName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const LEGACY_WHITELABEL_NAME = 'Clinic DFU';
const PERSONAL_WORKSPACE_RELEASE_AT = new Date('2026-05-22T14:06:00-03:00');

function isUserRole(role: unknown): role is UserRole {
  return role === 'ADMIN_GLOBAL' || role === 'GESTOR' || role === 'REPCAO' || role === 'TERAPEUTA';
}

function normalizeRoles(value: unknown): UserRole[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isUserRole);
}

function uniqueRoles(roles: UserRole[]) {
  return Array.from(new Set(roles));
}

function normalizeMembershipStatus(status: unknown): MembershipStatus {
  if (status === 'INATIVO' || status === 'PENDENTE') return status;
  return 'ATIVO';
}

function normalizeMembership(id: string, data: any, firebaseUser: FirebaseUser): WhitelabelMembership | null {
  const whitelabelId = data.whitelabelId;
  if (!whitelabelId || typeof whitelabelId !== 'string') return null;

  const roles = normalizeRoles(data.roles);
  if (roles.length === 0) return null;
  const status = normalizeMembershipStatus(data.status);
  if (status !== 'ATIVO') return null;

  return {
    id,
    whitelabelId,
    whitelabelName: data.whitelabelName,
    userId: data.userId ?? firebaseUser.uid,
    email: data.email ?? firebaseUser.email ?? '',
    name: data.name ?? firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Usuario',
    roles,
    status,
    invitationToken: data.invitationToken,
    therapistId: data.therapistId,
    therapistSpecialty: data.therapistSpecialty,
    patientIds: Array.isArray(data.patientIds) ? data.patientIds : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function shouldProvisionPersonalWorkspace(firebaseUser: FirebaseUser, profile: any) {
  if (profile?.provisioningMode === 'LEGACY_DEFAULT') return false;
  if (profile?.provisioningMode === 'PERSONAL_WORKSPACE') return true;
  if (firebaseUser.email?.toLowerCase().includes('admin')) return false;

  const creationTime = firebaseUser.metadata.creationTime;
  if (!creationTime) return false;

  return new Date(creationTime).getTime() >= PERSONAL_WORKSPACE_RELEASE_AT.getTime();
}

async function loadMemberships(firebaseUser: FirebaseUser) {
  const membershipsById = new Map<string, WhitelabelMembership>();

  function addMembership(membership: WhitelabelMembership | null) {
    if (!membership) return;

    const key = `${membership.whitelabelId}:${membership.email}`;
    const previous = membershipsById.get(key);

    if (!previous) {
      membershipsById.set(key, membership);
      return;
    }

    membershipsById.set(key, {
      ...previous,
      ...membership,
      id: membership.id === firebaseUser.uid ? membership.id : previous.id,
      userId: membership.userId === firebaseUser.uid ? membership.userId : previous.userId,
      roles: uniqueRoles([...previous.roles, ...membership.roles]),
    });
  }

  async function loadByField(field: 'userId' | 'email', value: string | null) {
    if (!value) return;

    const snapshot = await getDocs(
      query(collectionGroup(db, 'members'), where(field, '==', value))
    );

    snapshot.docs.forEach((membershipDoc) => {
      addMembership(normalizeMembership(membershipDoc.id, membershipDoc.data(), firebaseUser));
    });
  }

  async function loadByAcceptedInvites() {
    if (!firebaseUser.email) return;

    const snapshot = await getDocs(
      query(
        collection(db, ROOT_COLLECTIONS.invites),
        where('email', '==', firebaseUser.email.toLowerCase())
      )
    );

    await Promise.all(snapshot.docs.map(async (inviteDoc) => {
      const invite = inviteDoc.data();
      if (invite.status !== 'ACEITO') return;
      if (!invite.whitelabelId || typeof invite.whitelabelId !== 'string') return;

      const memberSnap = await getDoc(doc(
        db,
        ROOT_COLLECTIONS.whitelabels,
        invite.whitelabelId,
        TENANT_COLLECTIONS.members,
        firebaseUser.uid
      ));

      if (memberSnap.exists()) {
        addMembership(normalizeMembership(memberSnap.id, memberSnap.data(), firebaseUser));
      }
    }));
  }

  // Cada busca falha por conta propria. Compartilhar um `try` fazia a falha de
  // uma cancelar a outra: uma consulta de collectionGroup sem indice lancava
  // FAILED_PRECONDITION em `userId` e a busca por `email` nem era tentada,
  // deixando o usuario sem membership e caindo em "Acesso nao vinculado"
  // mesmo tendo associacao valida.
  for (const [campo, valor] of [
    ['userId', firebaseUser.uid],
    ['email', firebaseUser.email],
  ] as const) {
    try {
      await loadByField(campo, valor);
    } catch (error) {
      console.warn(`Nao foi possivel carregar associacoes por ${campo}:`, error);
    }
  }

  try {
    await loadByAcceptedInvites();
  } catch (error) {
    console.warn('Nao foi possivel carregar associacoes por convites aceitos:', error);
  }

  return Array.from(membershipsById.values());
}

async function loadProfile(firebaseUser: FirebaseUser) {
  try {
    const profileSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
    return profileSnap.exists() ? profileSnap.data() : null;
  } catch (error) {
    console.warn('Nao foi possivel carregar perfil do usuario:', error);
    return null;
  }
}

async function buildUser(firebaseUser: FirebaseUser): Promise<User> {
  const [tokenResult, profile, persistedMemberships] = await Promise.all([
    firebaseUser.getIdTokenResult().catch(() => null),
    loadProfile(firebaseUser),
    loadMemberships(firebaseUser),
  ]);

  let effectiveMemberships = persistedMemberships;

  if (effectiveMemberships.length === 0 && shouldProvisionPersonalWorkspace(firebaseUser, profile)) {
    try {
      const personalMembership = await personalWorkspaceService.ensurePersonalWorkspace(firebaseUser);
      effectiveMemberships = [personalMembership];
    } catch (error) {
      console.warn('Nao foi possivel provisionar workspace individual:', error);
    }
  }

  // Papel vem de custom claims e memberships — exatamente as duas fontes que
  // `firestore.rules` reconhece. A UI e as regras passam a concordar; antes era
  // possivel a tela liberar o Backoffice enquanto o Firestore negava tudo.
  //
  // Removidos junto da migracao para whitelabels:
  //
  //   `users/{uid}.roles`  — era gravavel pelo proprio usuario, o que permitia
  //                          auto-promocao a ADMIN_GLOBAL. Hoje e redundante:
  //                          quem tem papel tem membership.
  //   fallback de e-mail   — qualquer endereco contendo "admin" recebia
  //                          ADMIN_GLOBAL. Agora ADMIN_GLOBAL so por claim,
  //                          concedida com `npm.cmd run admin:grant`.
  //   `legacy-default`     — membership virtual que apontava os services para
  //                          as colecoes globais, bloqueadas pelas regras. Os
  //                          dados foram para `whitelabels/{id}/...` por
  //                          `scripts/migrate-to-whitelabels.ts`.
  //
  // Conta sem claim e sem membership cai em "Acesso nao vinculado" (App.tsx),
  // que e o comportamento correto — melhor negar do que dar acesso silencioso
  // a dado clinico de outro tenant.
  const claimRoles = normalizeRoles(tokenResult?.claims?.roles);
  const membershipRoles = effectiveMemberships.flatMap((membership) => membership.roles);

  let roles = uniqueRoles([...claimRoles, ...membershipRoles]);

  if (tokenResult?.claims?.admin === true && !roles.includes('ADMIN_GLOBAL')) {
    roles = [...roles, 'ADMIN_GLOBAL'];
  }

  const whitelabelMemberships = effectiveMemberships;

  const savedRole = localStorage.getItem(`activeRole_${firebaseUser.uid}`) as UserRole | null;
  const savedWhitelabelId = localStorage.getItem(`activeWhitelabel_${firebaseUser.uid}`);
  const activeMemberships = whitelabelMemberships.filter((membership) => membership.status === 'ATIVO');
  const activeWhitelabelId = savedWhitelabelId && activeMemberships.some((membership) => membership.whitelabelId === savedWhitelabelId)
    ? savedWhitelabelId
    : activeMemberships.length === 1 ? activeMemberships[0].whitelabelId : null;
  const initialRole = savedRole && roles.includes(savedRole)
    ? savedRole
    : roles.length === 1 ? roles[0] : null;

  return {
    id: firebaseUser.uid,
    name: profile?.name ?? firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Usuario',
    email: firebaseUser.email ?? '',
    roles,
    activeRole: initialRole,
    whitelabelMemberships,
    activeWhitelabelId,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (!firebaseUser) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const nextUser = await buildUser(firebaseUser);

      if (mounted) {
        setUser(nextUser);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const setActiveRole = (role: UserRole) => {
    if (!user || !user.roles.includes(role)) return;

    const storageKey = user.id ?? user.email;
    localStorage.setItem(`activeRole_${storageKey}`, role);

    if (role === 'ADMIN_GLOBAL') {
      localStorage.removeItem(`activeWhitelabel_${storageKey}`);
      setUser({ ...user, activeRole: role, activeWhitelabelId: null });
      return;
    }

    setUser({ ...user, activeRole: role });
  };

  const setActiveWhitelabel = (whitelabelId: string) => {
    if (!user) return;

    const canUseWhitelabel = user.whitelabelMemberships?.some(
      (membership) => membership.whitelabelId === whitelabelId && membership.status === 'ATIVO'
    );

    if (!canUseWhitelabel) return;

    const storageKey = user.id ?? user.email;
    localStorage.setItem(`activeWhitelabel_${storageKey}`, whitelabelId);
    setUser({ ...user, activeWhitelabelId: whitelabelId });
  };

  const returnToGlobalAdmin = () => {
    if (!user || !user.roles.includes('ADMIN_GLOBAL')) return;

    const storageKey = user.id ?? user.email;
    localStorage.setItem(`activeRole_${storageKey}`, 'ADMIN_GLOBAL');
    localStorage.removeItem(`activeWhitelabel_${storageKey}`);

    setUser({
      ...user,
      activeRole: 'ADMIN_GLOBAL',
      activeWhitelabelId: null,
    });
  };

  // Acesso direto do Admin Global como Gestor, sem depender de convite/
  // vinculo de membro. `firestore.rules` ja libera leitura/escrita irrestrita
  // para isAdminGlobal() em todas as colecoes de whitelabel — o que faltava
  // era a UI, que deriva `activeMembership` (App.tsx) estritamente de
  // `whitelabelMemberships`. Em vez de reescrever esse gate em todo consumidor,
  // injeta uma membership sintetica somente nesta sessao (nao grava no
  // Firestore); um reload descarta e reconstroi do zero em `buildUser`.
  const enterWhitelabelAsGestor = (whitelabelId: string, whitelabelName: string) => {
    if (!user || !user.roles.includes('ADMIN_GLOBAL')) return;

    const impersonatedMembership: WhitelabelMembership = {
      id: `admin-impersonation:${whitelabelId}`,
      whitelabelId,
      whitelabelName,
      userId: user.id,
      email: user.email,
      name: user.name,
      roles: ['GESTOR'],
      status: 'ATIVO',
    };

    const nextMemberships = [
      ...(user.whitelabelMemberships ?? []).filter((membership) => membership.whitelabelId !== whitelabelId),
      impersonatedMembership,
    ];

    const storageKey = user.id ?? user.email;
    localStorage.setItem(`activeRole_${storageKey}`, 'GESTOR');
    localStorage.setItem(`activeWhitelabel_${storageKey}`, whitelabelId);

    setUser({
      ...user,
      whitelabelMemberships: nextMemberships,
      activeRole: 'GESTOR',
      activeWhitelabelId: whitelabelId,
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      logout,
      setActiveRole,
      setActiveWhitelabel,
      returnToGlobalAdmin,
      enterWhitelabelAsGestor,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
