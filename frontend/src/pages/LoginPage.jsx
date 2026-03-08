import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/site/auth/profile" replace />;
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      await login({
        email: form.email.trim(),
        password: form.password,
      });
      setMessage("Вхід виконано успішно.");
      const redirect = location.state?.from || "/site/auth/profile";
      navigate(redirect, { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-panel">
      <h1 className="panel-title">Вхід</h1>
      <p className="muted">Увійдіть до облікового запису, щоб керувати профілем, заявками та процесами модерації.</p>

      <form onSubmit={handleSubmit} className="form-grid">
        <label className="field">
          <span>Електронна пошта</span>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={updateField}
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span>Пароль</span>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={updateField}
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" className="button button-primary" disabled={isSubmitting}>
          {isSubmitting ? "Вхід..." : "Увійти"}
        </button>
      </form>

      {message ? <div className="message message-success">{message}</div> : null}
      {error ? <div className="message message-error">{error}</div> : null}

      <p className="muted">
        Ще не маєте облікового запису? <Link to="/site/auth/register">Зареєструватися</Link>.
      </p>
    </section>
  );
}
