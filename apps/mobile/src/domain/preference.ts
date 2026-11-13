import { isRoleId, type RoleId } from './roles.ts';

/** Public browsing preference, never an authentication/session role. */
export const ROLE_PREFERENCE_KEY = 'atpro.public.role.v1';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
}

/** Dependency-injected storage keeps persistence logic testable without a device. */
export function createRolePreferenceStore(storage: KeyValueStorage) {
  return {
    async load(): Promise<RoleId | null> {
      const value = await storage.getItem(ROLE_PREFERENCE_KEY);
      return isRoleId(value) ? value : null;
    },
    async save(value: RoleId): Promise<void> {
      if (!isRoleId(value)) {
        throw new Error('Unsupported role');
      }
      await storage.setItem(ROLE_PREFERENCE_KEY, value);
    },
    async clear(): Promise<void> {
      await storage.removeItem(ROLE_PREFERENCE_KEY);
    },
  };
}
