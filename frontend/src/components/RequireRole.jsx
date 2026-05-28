import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function RequireRole({ role, children }) {
  const { isAuthenticated, isBootstrapping, hasRole } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return <div className="empty-state">Завантаження сесії...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/site/auth/login" replace state={{ from: location.pathname }} />;
  }

  if (!hasRole(role)) {
    return <Navigate to="/site/auth/profile" replace />;
  }

  return children;
}
