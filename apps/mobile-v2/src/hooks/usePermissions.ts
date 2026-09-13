import { useCurrentUser } from './useAuthUser';

export type Permission =
  | 'customer.read'
  | 'customer.write'
  | 'lead.read'
  | 'lead.write'
  | 'projection.read'
  | 'projection.write'
  | 'order.read'
  | 'order.write'
  | 'payment.read'
  | 'payment.write'
  | 'report.view'
  | 'user.manage';

export function usePermissions() {
  const { data: user } = useCurrentUser();

  const can = (permission: Permission): boolean => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'super_admin') return true;

    if (user.role === 'mgmt') {
      return permission !== 'user.manage' && permission !== 'order.write';
    }

    if (user.role === 'sales') {
      // Sales has full read/write on their domain, read on payment, view on report
      return [
        'customer.read',
        'customer.write',
        'lead.read',
        'lead.write',
        'projection.read',
        'projection.write',
        'order.read',
        'order.write',
        'payment.read',
        'payment.write',
        'report.view',
      ].includes(permission);
    }

    return false;
  };

  return { can, role: user?.role };
}
