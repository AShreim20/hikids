import {
  LayoutDashboard, GalleryHorizontal, ShoppingCart, Truck, Layers,
  Search, ClipboardList, BarChart3, Award, Ticket, Package,
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
        { to: '/admin', label: t('nav.managementProducts'), icon: LayoutDashboard },
        { to: '/admin/product-search', label: t('nav.managementProductSearch'), icon: Search },
        { to: '/delivery', label: t('nav.managementDelivery'), icon: Truck },
        { to: '/orders-admin', label: t('nav.managementOrders'), icon: ClipboardList },
        { to: '/admin/bundles', label: t('nav.managementBundles'), icon: Package },
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