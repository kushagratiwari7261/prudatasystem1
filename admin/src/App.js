import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Reviews from './pages/Reviews';
import Coupons from './pages/Coupons';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
    return (
        <ThemeProvider>
            <BrowserRouter>
                <ToastContainer position="top-right" autoClose={3000} />
                <Routes>
                    <Route path="/login" element={<AdminLogin />} />
                    <Route path="/dashboard" element={
                        <AdminProtectedRoute><Dashboard /></AdminProtectedRoute>
                    } />
                    <Route path="/orders" element={
                        <AdminProtectedRoute><Orders /></AdminProtectedRoute>
                    } />
                    <Route path="/products" element={
                        <AdminProtectedRoute><Products /></AdminProtectedRoute>
                    } />
                    <Route path="/inventory" element={
                        <AdminProtectedRoute><Inventory /></AdminProtectedRoute>
                    } />
                    <Route path="/customers" element={
                        <AdminProtectedRoute><Customers /></AdminProtectedRoute>
                    } />
                    <Route path="/reviews" element={
                        <AdminProtectedRoute><Reviews /></AdminProtectedRoute>
                    } />
                    <Route path="/coupons" element={
                        <AdminProtectedRoute><Coupons /></AdminProtectedRoute>
                    } />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;
