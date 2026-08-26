import {
  LayoutDashboard, GalleryHorizontal, ShoppingCart, Truck, Layers,
  Search, ClipboardList, BarChart3, Award, Ticket, Package, Trophy, Sparkles, Gamepad2, Users,
} from 'lucide-react';

// Single source of truth for the admin navigation. Top-level entries are
// either a direct link or a group with children. Groups collapse several
// management pages under one icon without merging their functionality.
export function getAdminNav(t) {
  return [
    { type: 'link', to: '/admin/carousel', label: t('nav.carousel'), icon: GalleryHorizontal },
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
        { to: '/delivery', label: t('nav.managementDelivery'), icon: Truck },
        { to: '/orders-admin', label: t('nav.managementOrders'), icon: ClipboardList },
        { to: '/admin/bundles', label: t('nav.managementBundles'), icon: Package },
      ],
    },
    {
      type: 'group', id: 'gamification', label: t('nav.gamification'), icon: Gamepad2,
      children: [
        { to: '/admin/challenges', label: t('nav.challengesAdmin'), icon: Trophy },
        { to: '/admin/wheel', label: t('nav.wheelAdmin'), icon: Sparkles },
        { to: '/admin/wheel-winners', label: t('nav.wheelWinners'), icon: Users },
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