// Canonical permissions & role helpers — single source of truth shared by
// backend functions and the frontend. Owner = built-in role "admin".
// Staff = role "user" with a non-empty `permissions` array. Customer = role
// "user" with no permissions.

export const PERMISSIONS = [
  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  'inventory.manage',
  'orders.manage',
  'customers.manage',
  'invoices.create',
  'invoices.edit',
  'discounts.manage',
  'giftcards.manage',
  'loyalty.manage',
  'returns.manage',
  'reports.view',
  'delivery.manage',
];

export const PERMISSION_GROUPS = [
  { key: 'products', label: 'Products', perms: ['products.view', 'products.create', 'products.edit', 'products.delete'] },
  { key: 'inventory', label: 'Inventory', perms: ['inventory.manage'] },
  { key: 'orders', label: 'Orders', perms: ['orders.manage'] },
  { key: 'customers', label: 'Customers', perms: ['customers.manage'] },
  { key: 'invoices', label: 'Invoices', perms: ['invoices.create', 'invoices.edit'] },
  { key: 'discounts', label: 'Discount Codes', perms: ['discounts.manage'] },
  { key: 'giftcards', label: 'Gift Cards', perms: ['giftcards.manage'] },
  { key: 'loyalty', label: 'Loyalty Points', perms: ['loyalty.manage'] },
  { key: 'returns', label: 'Returns & Exchanges', perms: ['returns.manage'] },
  { key: 'reports', label: 'Reports', perms: ['reports.view'] },
  { key: 'delivery', label: 'Delivery Pricing', perms: ['delivery.manage'] },
];

// Custom `permissions` field may be exposed at the top level of the user
// object or nested under `data` depending on the SDK surface.
export function permsOf(user) {
  if (!user) return [];
  if (Array.isArray(user.permissions)) return user.permissions;
  if (user.data && Array.isArray(user.data.permissions)) return user.data.permissions;
  return [];
}

export function isOwner(user) {
  return !!user && user.role === 'admin';
}

export function isStaff(user) {
  return !!user && user.role !== 'admin' && permsOf(user).length > 0;
}

export function isCustomer(user) {
  return !!user && user.role !== 'admin' && permsOf(user).length === 0;
}

export function can(user, perm) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return permsOf(user).includes(perm);
}

export function canAccessStaffArea(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return permsOf(user).length > 0;
}