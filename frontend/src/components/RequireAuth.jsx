import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function RequireAuth({ children }) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return <div className="panel">Завантаження сесії...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/site/auth/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
