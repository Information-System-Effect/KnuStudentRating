import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const DEFAULT_FORM = {
  role: "STUDENT",
  email: "",
  password: "",
  fullName: "",
  institution: "",
  groupName: "",
  about: "",
};

export default function RegisterPage() {
  const { isAuthenticated, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(DEFAULT_FORM);
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
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      await register(form.role, {
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        institution: form.institution.trim(),
        groupName: form.groupName.trim(),
        about: form.about.trim(),
      });
      setMessage("Реєстрацію виконано успішно.");
      navigate("/site/auth/profile", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-panel">
      <h1 className="panel-title">Реєстрація</h1>
      <p className="muted">Створіть акаунт для участі в проєктах і системі взаємооцінювання.</p>

      <form onSubmit={handleSubmit} className="form-grid">
        <label className="field">
          <span>Роль</span>
          <select name="role" value={form.role} onChange={updateField}>
            <option value="STUDENT">Студент</option>
            <option value="POSTGRADUATE">Аспірант</option>
          </select>
        </label>

        <label className="field">
          <span>Електронна пошта</span>
          <input type="email" name="email" value={form.email} onChange={updateField} required />
        </label>

        <label className="field">
          <span>Пароль</span>
          <input type="password" name="password" value={form.password} onChange={updateField} required minLength={8} />
        </label>

        <label className="field">
          <span>ПІБ</span>
          <input type="text" name="fullName" value={form.fullName} onChange={updateField} required />
        </label>

        <label className="field">
          <span>Інституція</span>
          <input type="text" name="institution" value={form.institution} onChange={updateField} />
        </label>

        <label className="field">
          <span>Група/кафедра</span>
          <input type="text" name="groupName" value={form.groupName} onChange={updateField} />
        </label>

        <label className="field">
          <span>Про себе</span>
          <textarea name="about" rows={4} value={form.about} onChange={updateField} />
        </label>

        <button type="submit" className="button button-primary" disabled={isSubmitting}>
          {isSubmitting ? "Реєстрація..." : "Створити акаунт"}
        </button>
      </form>

      {message ? <div className="message message-success">{message}</div> : null}
      {error ? <div className="message message-error">{error}</div> : null}

      <p className="muted">
        Уже зареєстровані? <Link to="/site/auth/login">Перейти до входу</Link>.
      </p>
    </section>
  );
}


