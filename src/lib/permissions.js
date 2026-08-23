import { useAuth } from '@/lib/AuthContext';
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  permsOf,
  isOwner,
  isStaff,
  isCustomer,
  can,
  canAccessStaffArea,
} from '../../base44/shared/permissions';

export {
  PERMISSIONS,
  PERMISSION_GROUPS,
  permsOf,
  isOwner,
  isStaff,
  isCustomer,
  can,
  canAccessStaffArea,
};

export function usePermissions() {
  const { user } = useAuth();
  return {
    user,
    isOwner: isOwner(user),
    isStaff: isStaff(user),
    isCustomer: isCustomer(user),
    canAccessStaffArea: canAccessStaffArea(user),
    can: (perm) => can(user, perm),
  };
}