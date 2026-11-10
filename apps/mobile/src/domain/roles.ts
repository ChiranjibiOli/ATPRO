/** Public role descriptions. These are NOT permissions or authenticated identities. */
export const ROLE_DEFINITIONS = [
  {
    id: 'farmer',
    label: 'Farmer',
    headline: 'Send produce to the right market',
    summary: 'Plan a pickup without needing to arrange an entire vehicle alone.',
    responsibilities: [
      'Request transport with product, quantity and pickup details',
      'Choose a market and requested transport time',
      'Review compatible vehicle offers and trip status',
    ],
  },
  {
    id: 'driver',
    label: 'Driver',
    headline: 'Make each trip more useful',
    summary: 'List an available vehicle and review compatible pickup routes.',
    responsibilities: [
      'Register vehicle type, capacity and handling capabilities',
      'Set availability and trip starting location',
      'Accept trips and confirm pickups and deliveries',
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    headline: 'Monitor transport operations',
    summary: 'Review users, vehicles and transport activity with accountable records.',
    responsibilities: [
      'Review vehicle registration and user status',
      'Monitor transport requests and trip exceptions',
      'View auditable assignment and delivery updates',
    ],
  },
] as const;

export type RoleId = (typeof ROLE_DEFINITIONS)[number]['id'];

export function isRoleId(value: unknown): value is RoleId {
  return typeof value === 'string' && ROLE_DEFINITIONS.some(role => role.id === value);
}

export function getRole(roleId: RoleId) {
  return ROLE_DEFINITIONS.find(role => role.id === roleId)!;
}
