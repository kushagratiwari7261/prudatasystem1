import { Navigate } from 'react-router-dom';

const AdminProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('adminToken');
    const user = JSON.parse(localStorage.getItem('adminUser') || 'null');

    if (!token || !user || user.role !== 'admin') {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default AdminProtectedRoute;
