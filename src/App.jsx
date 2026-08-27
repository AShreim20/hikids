import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PageNotFound = lazy(() => import('./lib/PageNotFound'));
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import MobileNav from './components/MobileNav';
import ChatWidget from './components/ai/ChatWidget';
import WhatsAppButton from './components/WhatsAppButton';
import AdminSidebar from './components/AdminSidebar';
import AdminMobileMenu from './components/AdminMobileMenu';
import NewOrderNotifier from './components/orders/NewOrderNotifier';
// Add page imports here
const Home = lazy(() => import('./pages/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const About = lazy(() => import('./pages/About'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Contact = lazy(() => import('./pages/Contact'));
const Admin = lazy(() => import('./pages/Admin'));
const ProductEditor = lazy(() => import('./pages/ProductEditor'));
const HeroSlides = lazy(() => import('./pages/HeroSlides'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const POEditor = lazy(() => import('./pages/POEditor'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Categories = lazy(() => import('./pages/Categories'));
const Reports = lazy(() => import('./pages/Reports'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const StaffManagement = lazy(() => import('./pages/StaffManagement'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const OrdersManagement = lazy(() => import('./pages/OrdersManagement'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const DeliveryManagement = lazy(() => import('./pages/DeliveryManagement'));
const MyAddresses = lazy(() => import('./pages/MyAddresses'));
const DiscountManagement = lazy(() => import('./pages/DiscountManagement'));
const MyLoyalty = lazy(() => import('./pages/MyLoyalty'));
const LoyaltyManagement = lazy(() => import('./pages/LoyaltyManagement'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Bundles = lazy(() => import('./pages/Bundles'));
const BundleEditor = lazy(() => import('./pages/BundleEditor'));
const BundleDetail = lazy(() => import('./pages/BundleDetail'));
const ChallengesAdmin = lazy(() => import('./pages/ChallengesAdmin'));
const MysteryWheelAdmin = lazy(() => import('./pages/MysteryWheelAdmin'));
const Challenges = lazy(() => import('./pages/Challenges'));
const MysteryWheel = lazy(() => import('./pages/MysteryWheel'));
const RewardsHistory = lazy(() => import('./pages/RewardsHistory'));
const ShareLanding = lazy(() => import('./pages/ShareLanding'));
const MyWheelRewards = lazy(() => import('./pages/MyWheelRewards'));
const WheelWinners = lazy(() => import('./pages/WheelWinners'));
const SharedCart = lazy(() => import('./pages/SharedCart'));
const PhotoReviews = lazy(() => import('./pages/PhotoReviews'));
const SiteContentAdmin = lazy(() => import('./pages/admin/SiteContentAdmin'));
const SiteSettingsAdmin = lazy(() => import('./pages/admin/SiteSettingsAdmin'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { CategoryProvider } from '@/context/CategoryContext';
import { CartFlyProvider } from '@/context/CartFlyContext';
import { SiteContentProvider } from '@/context/SiteContentContext';

function AnimatedRoutes() {
  const location = useLocation();
  const routes = (
    <Routes location={location}>
      {/* Add your page Route elements here */}
      <Route path="/" element={<Home />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/bundles/:id" element={<BundleDetail />} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/wishlist" element={<Wishlist />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/about" element={<About />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/admin/carousel" element={<HeroSlides />} />
      <Route path="/admin/suppliers" element={<Suppliers />} />
      <Route path="/admin/po" element={<PurchaseOrders />} />
      <Route path="/admin/po/new" element={<POEditor />} />
      <Route path="/admin/po/:id" element={<POEditor />} />
      <Route path="/admin/categories" element={<Categories />} />
      <Route path="/admin/users" element={<UserManagement />} />
      <Route path="/admin/bundles" element={<Bundles />} />
      <Route path="/admin/bundle/new" element={<BundleEditor />} />
      <Route path="/admin/bundle/:id" element={<BundleEditor />} />
      <Route path="/admin/challenges" element={<ChallengesAdmin />} />
      <Route path="/admin/wheel" element={<MysteryWheelAdmin />} />
      <Route path="/challenges" element={<Challenges />} />
      <Route path="/wheel" element={<MysteryWheel />} />
      <Route path="/rewards" element={<RewardsHistory />} />
      <Route path="/share" element={<ShareLanding />} />
      <Route path="/wheel-rewards" element={<MyWheelRewards />} />
      <Route path="/admin/wheel-winners" element={<WheelWinners />} />
      <Route path="/admin/photo-reviews" element={<PhotoReviews />} />
      <Route path="/admin/site-content" element={<SiteContentAdmin />} />
      <Route path="/admin/site-settings" element={<SiteSettingsAdmin />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/cart/shared" element={<SharedCart />} />
      <Route path="/admin/reports" element={<Reports />} />
      <Route path="/admin/product/new" element={<ProductEditor />} />
      <Route path="/admin/product/:id" element={<ProductEditor />} />
      <Route path="/staff" element={<StaffManagement />} />
      <Route path="/delivery" element={<DeliveryManagement />} />
      <Route path="/addresses" element={<MyAddresses />} />
      <Route path="/discounts" element={<DiscountManagement />} />
      <Route path="/loyalty" element={<MyLoyalty />} />
      <Route path="/loyalty-admin" element={<LoyaltyManagement />} />
      <Route path="/orders" element={<MyOrders />} />
      <Route path="/orders-admin" element={<OrdersManagement />} />
      <Route path="/orders-admin/:id" element={<OrderDetail />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );

  // The <Routes> element must stay stable across navigations: all page
  // components are lazy-loaded behind <Suspense>, and keying/remounting the
  // route tree (e.g. via an AnimatePresence wrapper keyed by pathname) re-fires
  // the Suspense fallback and page mount effects on every navigation — which
  // on mobile showed up as a persistent loading/reload loop. Returning routes
  // directly keeps the same <Routes> instance, so lazy chunks stay loaded.
  return routes;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <CartFlyProvider>
    <CartProvider>
      <WishlistProvider>
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>}>
      <AnimatedRoutes />
      </Suspense>
      <MobileNav />
      <AdminSidebar />
      <AdminMobileMenu />
      <NewOrderNotifier />
      {!isAdmin && <ChatWidget />}
      {!isAdmin && <WhatsAppButton />}
      </WishlistProvider>
    </CartProvider>
    </CartFlyProvider>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ThemeProvider>
        <LanguageProvider>
        <SiteContentProvider>
        <CategoryProvider>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        </CategoryProvider>
        </SiteContentProvider>
        </LanguageProvider>
        </ThemeProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App