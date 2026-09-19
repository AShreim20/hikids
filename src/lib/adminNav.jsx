import {
  GalleryHorizontal, ShoppingCart, Truck, Layers, ClipboardList, BarChart3, Award, Ticket, Package, Trophy,
  Sparkles, Users, FolderTree, Camera, Type, Settings, Receipt, MessageCircleQuestion, Undo2, LineChart, Inbox,
  LayoutDashboard, BellRing, Store, Gift, SlidersHorizontal, ShieldCheck, Wallet,
} from 'lucide-react';

// Single source of truth for the admin navigation: Action Required (standalone
// shortcut with a live count) followed by six functional groups. Every child
// points at an existing route -- no route is created or renamed here.
// `also` lists the detail/editor routes that belong to the same page so the
// right group/page stays highlighted there.
export function getAdminNav(t, { isOwner = false } = {}) {
  return [
    { type: 'action', id: 'action-required', label: t('nav.actionRequired'), icon: BellRing },
    {
      type: 'group', id: 'sales', label: t('nav.grpSales'), icon: Store,
      children: [
        { to: '/orders-admin', label: t('nav.managementOrders'), icon: ClipboardList },
        { to: '/admin/return-requests', label: t('nav.returnRequests'), icon: Inbox },
        { to: '/admin/inquiries', label: t('nav.inquiries'), icon: MessageCircleQuestion },
        { to: '/delivery', label: t('nav.managementDelivery'), icon: Truck },
      ],
    },
    {
      type: 'group', id: 'products', label: t('nav.grpProducts'), icon: Package,
      children: [
        { to: '/admin', label: t('nav.managementProducts'), icon: LayoutDashboard, also: ['/admin/product'] },
        { to: '/admin/categories', label: t('nav.categories'), icon: FolderTree },
        { to: '/admin/bundles', label: t('nav.managementBundles'), icon: Layers, also: ['/admin/bundle'] },
      ],
    },
    {
      type: 'group', id: 'expenses', label: t('nav.grpExpenses'), icon: Receipt,
      children: [
        { to: '/admin/po', label: t('nav.po'), icon: ShoppingCart },
        { to: '/admin/suppliers', label: t('nav.suppliers'), icon: Truck },
        { to: '/admin/expenses', label: t('nav.expensesList'), icon: Wallet },
        { to: '/admin/expense-categories', label: t('nav.expenseCategories'), icon: FolderTree },
      ],
    },
    {
      type: 'group', id: 'reports', label: t('nav.grpReports'), icon: BarChart3,
      children: [
        { to: '/admin/reports', label: t('nav.siteReports'), icon: BarChart3 },
        { to: '/analytics', label: t('nav.googleAnalytics'), icon: LineChart },
      ],
    },
    {
      type: 'group', id: 'marketing', label: t('nav.grpMarketing'), icon: Gift,
      children: [
        { to: '/loyalty-admin', label: t('loyalty.nav'), icon: Award },
        { to: '/discounts', label: t('discount.title'), icon: Ticket },
        { to: '/admin/challenges', label: t('nav.challengesAdmin'), icon: Trophy },
        { to: '/admin/wheel', label: t('nav.wheelAdmin'), icon: Sparkles },
        { to: '/admin/wheel-winners', label: t('nav.wheelWinners'), icon: Users },
        { to: '/admin/photo-reviews', label: t('nav.photoReviews'), icon: Camera },
      ],
    },
    {
      type: 'group', id: 'site', label: t('nav.grpSite'), icon: SlidersHorizontal,
      children: [
        { to: '/admin/carousel', label: t('nav.homepageSlides'), icon: GalleryHorizontal, also: ['/admin/hero-slide-preview'] },
        { to: '/admin/site-content', label: t('nav.siteContent'), icon: Type },
        { to: '/admin/site-settings', label: t('nav.siteSettings'), icon: Settings },
        { to: '/admin/users', label: t('nav.users'), icon: Users },
        { to: '/admin/return-reasons', label: t('nav.returnReasons'), icon: Undo2 },
        ...(isOwner ? [{ to: '/staff', label: t('staff.nav'), icon: ShieldCheck }] : []),
      ],
    },
  ];
}

// A child is active on its own route, its sub-routes, or any `also` route.
export function isActivePath(pathname, child) {
  if (pathname === child.to) return true;
  const prefixes = child.to === '/admin' ? (child.also || []) : [child.to, ...(child.also || [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
