export type UserRole = 'farmer' | 'driver' | 'admin';
export type AuthUser = { id: string; name: string; email: string; role: UserRole };
export type LoginResult = { user: AuthUser; token: string; expiresAt: string };
export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string,string>) { super(message); }
}
export function apiBase() {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!url) throw new ApiError(0, 'API address is not configured. Set EXPO_PUBLIC_API_URL to your laptop LAN address.');
  return url.replace(/\/$/, '');
}
export async function apiRequest<T>(path: string, method: 'GET'|'POST', body?: object, token?: string): Promise<T> {
  const response = await fetch(apiBase() + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any;
  try { data = await response.json(); } catch { throw new ApiError(response.status, 'Unexpected server response.'); }
  if (!response.ok) throw new ApiError(response.status, data.error ?? 'Request failed.', data.fields);
  return data as T;
}
export const register = (body: { name:string; email:string; password:string; role:'farmer'|'driver' }) => apiRequest<{user:AuthUser}>('/api/auth/register','POST',body);
export const login = (body: {email:string;password:string}) => apiRequest<LoginResult>('/api/auth/login','POST',body);
export const me = (token:string) => apiRequest<{user:AuthUser}>('/api/auth/me','GET',undefined,token);
export const logout = (token:string) => apiRequest<{message:string}>('/api/auth/logout','POST',undefined,token);
