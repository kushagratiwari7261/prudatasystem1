import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Coupons from './pages/Coupons';
import AdminProtectedRoute from './components/AdminProtectedRoute';

function App() {
    return (
        <BrowserRouter>
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
                <Route path="/coupons" element={
                    <AdminProtectedRoute><Coupons /></AdminProtectedRoute>
                } />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
