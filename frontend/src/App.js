import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Login from './pages/Login';
import Register from './pages/Register';
import AuthCallback from './pages/AuthCallback';
import ForgotPassword from './pages/ForgotPassword';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Search from './pages/Search';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderTracking from './pages/OrderTracking';
import Account from './pages/Account';
import Wishlist from './pages/Wishlist';
import NotFound from './pages/NotFound';

function App() {
    return (
        <BrowserRouter>
            {/* Toast Container for notifications */}
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
            />

            <Navbar />
            <div className="page-wrapper">
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/shop" element={<Shop />} />
                    <Route path="/products/:slug" element={<ProductDetail />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />

                    {/* Protected Customer Routes */}
                    <Route path="/cart" element={
                        <ProtectedRoute>
                            <Cart />
                        </ProtectedRoute>
                    } />

                    <Route path="/checkout" element={
                        <ProtectedRoute>
                            <Checkout />
                        </ProtectedRoute>
                    } />

                    <Route path="/orders" element={
                        <ProtectedRoute>
                            <Orders />
                        </ProtectedRoute>
                    } />

                    <Route path="/orders/:id" element={
                        <ProtectedRoute>
                            <OrderTracking />
                        </ProtectedRoute>
                    } />

                    <Route path="/account/*" element={
                        <ProtectedRoute>
                            <Account />
                        </ProtectedRoute>
                    } />

                    <Route path="/wishlist" element={
                        <ProtectedRoute>
                            <Wishlist />
                        </ProtectedRoute>
                    } />

                    {/* Catch All - 404 */}
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </div>
            <Footer />
        </BrowserRouter>
    );
}

export default App;