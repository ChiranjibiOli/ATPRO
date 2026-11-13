import * as SecureStore from 'expo-secure-store';
const TOKEN_KEY = 'atpro.auth.token.v1';
export const sessionStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  save: (token:string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
