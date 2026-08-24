import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
const PageNotFound = lazy(() => import('./lib/PageNotFound'));
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import MobileNav from './components/MobileNav';
import ChatWidget from './components/ai/ChatWidget';
import WhatsAppButton from './components/WhatsAppButton';
import AdminSidebar from './components/AdminSidebar';
import NewOrderNotifier from './components/orders/NewOrderNotifier';
// Add page imports here
const Home = lazy(() => import('./pages/Home'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const About = lazy(() => import('./pages/About'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Admin = lazy(() => import('./pages/Admin'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const StaffManagement = lazy(() => import('./pages/StaffManagement'));
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
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';

function AnimatedRoutes() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const routes = (
    <Routes location={location}>
      {/* Add your page Route elements here */}
      <Route path="/" element={<Home />} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/wishlist" element={<Wishlist />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/about" element={<About />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/admin" element={<Admin />} />
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

  // Desktop keeps the default routing (no transition wrapper) so sticky
  // headers / fixed overlays behave exactly as before. On mobile we wrap
  // routes in AnimatePresence for a smooth slide-in + fade-out per navigation.
  if (!isMobile) return routes;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="route-slide-in"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {routes}
      </motion.div>
    </AnimatePresence>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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
    <CartProvider>
      <WishlistProvider>
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>}>
      <AnimatedRoutes />
      </Suspense>
      <MobileNav />
      <AdminSidebar />
      <NewOrderNotifier />
      <ChatWidget />
      <WhatsAppButton />
      </WishlistProvider>
    </CartProvider>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ThemeProvider>
        <LanguageProvider>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        </LanguageProvider>
        </ThemeProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App