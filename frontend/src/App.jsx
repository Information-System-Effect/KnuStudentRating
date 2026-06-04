import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import { ToastProvider } from "./components/ToastProvider";
import AdminConsolePage from "./pages/AdminConsolePage";
import AuthProfilePage from "./pages/AuthProfilePage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import ParticipantProfilePage from "./pages/ParticipantProfilePage";
import ParticipantsAboutPage from "./pages/ParticipantsAboutPage";
import ParticipantsDirectoryPage from "./pages/ParticipantsDirectoryPage";
import ParticipantsReviewsPage from "./pages/ParticipantsReviewsPage";
import ProjectReviewsPage from "./pages/ProjectReviewsPage";
import ProjectsCompletedPage from "./pages/ProjectsCompletedPage";
import ProjectRequestsPage from "./pages/ProjectRequestsPage";
import RegisterPage from "./pages/RegisterPage";
import RulesPage from "./pages/RulesPage";
import TeamPage from "./pages/TeamPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="site/team" element={<TeamPage />} />
              <Route path="site/projects/rules" element={<RulesPage />} />
              <Route path="site/projects/completed" element={<ProjectsCompletedPage />} />
              <Route path="site/projects/requests" element={<ProjectRequestsPage />} />
              <Route path="site/projects/reviews" element={<ProjectReviewsPage />} />

              <Route
                path="site/participants/students/about"
                element={<ParticipantsAboutPage audience="students" />}
              />
              <Route
                path="site/participants/teachers/about"
                element={<ParticipantsAboutPage audience="teachers" />}
              />
              <Route
                path="site/participants/students/profile"
                element={<ParticipantsDirectoryPage audience="students" />}
              />
              <Route
                path="site/participants/teachers/profile"
                element={<ParticipantsDirectoryPage audience="teachers" />}
              />
              <Route
                path="site/participants/students/reviews"
                element={<ParticipantsReviewsPage audience="students" />}
              />
              <Route
                path="site/participants/teachers/reviews"
                element={<ParticipantsReviewsPage audience="teachers" />}
              />
              <Route path="site/participants/profile/:code" element={<ParticipantProfilePage />} />

              <Route path="site/auth/login" element={<LoginPage />} />
              <Route path="site/auth/register" element={<RegisterPage />} />
              <Route
                path="site/auth/profile"
                element={
                  <RequireAuth>
                    <AuthProfilePage />
                  </RequireAuth>
                }
              />
              <Route
                path="site/admin"
                element={
                  <RequireRole role="ADMIN">
                    <AdminConsolePage />
                  </RequireRole>
                }
              />

              <Route path="site" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
