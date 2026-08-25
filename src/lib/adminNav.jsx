import {
  LayoutDashboard, GalleryHorizontal, ShoppingCart, Truck, Layers,
  Tags, MapPin, ClipboardList, TrendingUp, BarChart3, Award, Ticket, Package,
} from 'lucide-react';

// Single source of truth for the admin navigation. Top-level entries are
// either a direct link or a group with children. Groups collapse several
// management pages under one icon without merging their functionality.
export function getAdminNav(t) {
  return [
    { type: 'link', to: '/admin', label: t('nav.admin'), icon: LayoutDashboard },
    { type: 'link', to: '/admin/carousel', label: t('nav.carousel'), icon: GalleryHorizontal },
    { type: 'link', to: '/admin/bundles', label: t('nav.bundles'), icon: Package },
    {
      type: 'group', id: 'purchasing', label: t('nav.purchasing'), icon: ShoppingCart,
      children: [
        { to: '/admin/po', label: t('nav.po'), icon: ShoppingCart },
        { to: '/admin/suppliers', label: t('nav.suppliers'), icon: Truck },
      ],
    },
    {
      type: 'group', id: 'management', label: t('nav.management'), icon: Layers,
      children: [
        { to: '/admin/categories', label: t('nav.categories'), icon: Tags },
        { to: '/delivery', label: t('nav.cities'), icon: MapPin },
        { to: '/orders-admin', label: t('nav.sales'), icon: TrendingUp },
        { to: '/orders-admin', label: t('nav.ordersAdmin'), icon: ClipboardList },
      ],
    },
    { type: 'link', to: '/admin/reports', label: t('nav.reports'), icon: BarChart3 },
    {
      type: 'group', id: 'loyalty', label: t('nav.loyaltyDiscounts'), icon: Award,
      children: [
        { to: '/loyalty-admin', label: t('loyalty.nav'), icon: Award },
        { to: '/discounts', label: t('discount.title'), icon: Ticket },
      ],
    },
  ];
}