import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatDateTime, formatRequestStatus } from "../lib/format";

function createProjectRequestForm() {
  return { title: "", description: "" };
}

function requestStatusClass(status) {
  return `status-pill status-pill-${String(status || "").toLowerCase().replace(/_/g, "-")}`;
}

export default function ProjectRequestsPage() {
  const { api, authApi, hasRole, isAuthenticated } = useAuth();
  const [publicRequests, setPublicRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [moderationComments, setModerationComments] = useState({});
  const [form, setForm] = useState(createProjectRequestForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [creatingProjectRequestId, setCreatingProjectRequestId] = useState(null);

  const canCreateRequests = isAuthenticated && (hasRole("STUDENT") || hasRole("TEACHER"));
  const isAdmin = isAuthenticated && hasRole("ADMIN");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const publicData = await api("/api/site/projects/requests", { method: "GET" });
      setPublicRequests(publicData);

      if (canCreateRequests) {
        const mine = await authApi("/api/project-requests/my", { method: "GET" });
        setMyRequests(mine);
      } else {
        setMyRequests([]);
      }

      if (isAdmin) {
        const items = await authApi("/api/admin/project-requests", { method: "GET" });
        setAdminRequests(items);
      } else {
        setAdminRequests([]);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [api, authApi, canCreateRequests, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateComment(requestId, value) {
    setModerationComments((current) => ({ ...current, [requestId]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      await authApi("/api/project-requests", {
        method: "POST",
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
        },
      });
      setForm(createProjectRequestForm());
      setMessage("Заявку на новий проєкт надіслано.");
      await loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function moderateRequest(requestId, action) {
    setMessage("");
    setError("");

    try {
      const updated = await authApi(`/api/admin/project-requests/${encodeURIComponent(requestId)}/${action}`, {
        method: "POST",
        body: {
          comment: moderationComments[requestId] || "",
        },
      });

      if (action === "approve" && updated?.createdProjectId) {
        setMessage(`Заявку #${requestId} схвалено. Проєкт створено автоматично (ID: ${updated.createdProjectId}).`);
      } else {
        setMessage(`Заявку ${requestId} опрацьовано.`);
      }

      await loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function createProjectForApprovedRequest(request) {
    setMessage("");
    setError("");
    setCreatingProjectRequestId(request.id);

    try {
      const createdProject = await authApi(`/api/admin/projects/from-request/${encodeURIComponent(request.id)}`, {
        method: "POST",
        body: {
          title: request.title,
          description: request.description || "",
          startAt: null,
          studentIds: [],
          teacherIds: [],
          studentCodes: [],
          teacherCodes: [],
        },
      });
      setMessage(`Проєкт створено для заявки #${request.id} (ID: ${createdProject.id}).`);
      await loadData();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setCreatingProjectRequestId(null);
    }
  }

  return (
    <div className="page-stack requests-page">
      <section className="page-hero">
        <div>
          <p className="hero-kicker">Подання проєктів</p>
          <h1 className="hero-title">Заявки на нові проєкти</h1>
          <p className="hero-text">Прозорий pipeline для ідей, модерації та запуску командних проєктів.</p>
        </div>
        <div className="hero-actions">
          {canCreateRequests ? (
            <a href="#create-request" className="button button-primary">
              Подати заявку
            </a>
          ) : null}
          {isAdmin ? (
            <a href="#moderation" className="button button-soft">
              Модерація
            </a>
          ) : null}
        </div>
      </section>

      {message ? <div className="message message-success">{message}</div> : null}
      {error ? (
        <section className="home-error-alert" role="alert">
          <span className="alert-icon" aria-hidden="true" />
          <div>
            <h2>Не вдалося завантажити дані</h2>
            <p>Спробуйте оновити сторінку або повторити запит пізніше.</p>
            <span className="alert-details">{error}</span>
          </div>
          <button type="button" className="button button-soft" onClick={loadData}>
            Спробувати ще раз
          </button>
        </section>
      ) : null}

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Публічні заявки</span>
          <strong className="stat-value">{publicRequests.length}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Мої заявки</span>
          <strong className="stat-value">{myRequests.length}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Для модерації</span>
          <strong className="stat-value">{adminRequests.length}</strong>
        </article>
      </section>

      {canCreateRequests ? (
        <section className="request-workbench" id="create-request">
          <article className="panel request-form-card">
            <p className="hero-kicker">Нова заявка</p>
            <h2 className="panel-title">Подати заявку</h2>
            <form onSubmit={handleCreate} className="form-grid">
              <label className="field">
                <span>Назва</span>
                <input type="text" name="title" value={form.title} onChange={updateForm} required maxLength={255} />
              </label>
              <label className="field">
                <span>Опис</span>
                <textarea name="description" rows={5} value={form.description} onChange={updateForm} maxLength={4000} />
              </label>
              <button type="submit" className="button button-primary">
                Надіслати заявку
              </button>
            </form>
          </article>

          <article className="panel">
            <div className="section-heading">
              <div>
                <p className="hero-kicker">Мої заявки</p>
                <h2 className="panel-title">Мої заявки</h2>
              </div>
            </div>
            {!myRequests.length ? <div className="empty-state">Наразі у Вас ще немає заявок.</div> : null}
            <div className="list-stack">
              {myRequests.map((request) => (
                <article key={request.id} className="list-card request-card">
                  <div className="project-card-head">
                    <h3>{request.title}</h3>
                    <span className={requestStatusClass(request.status)}>{formatRequestStatus(request.status)}</span>
                  </div>
                  <p>{request.description || "Без опису."}</p>
                  <div className="meta-grid">
                    <span>Створено <strong>{formatDateTime(request.createdAt)}</strong></span>
                    <span>Розглянуто <strong>{formatDateTime(request.reviewedAt)}</strong></span>
                    {request.createdProjectId ? (
                      <span>Проєкт <strong>#{request.createdProjectId}</strong></span>
                    ) : null}
                  </div>
                  {request.adminComment ? <p className="muted">Коментар адміністратора: {request.adminComment}</p> : null}
                </article>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <p className="hero-kicker">Публічна стрічка</p>
            <h2 className="panel-title">Публічна стрічка</h2>
          </div>
        </div>
        {isLoading ? <div className="empty-state">Завантаження заявок...</div> : null}
        {!isLoading && !publicRequests.length ? <div className="empty-state">Заявки наразі відсутні.</div> : null}

        <div className="request-card-grid">
          {publicRequests.map((request) => (
            <article key={request.requestId} className="list-card request-card">
              <div className="project-card-head">
                <h3>{request.title}</h3>
                <span className={requestStatusClass(request.status)}>{formatRequestStatus(request.status)}</span>
              </div>
              <p>{request.description || "Без опису."}</p>
              <div className="meta-grid">
                <span>Автор ID <strong>{request.authorUserId}</strong></span>
                <span>Створено <strong>{formatDateTime(request.createdAt)}</strong></span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {isAdmin ? (
        <section className="panel" id="moderation">
          <div className="section-heading">
            <div>
              <p className="hero-kicker">Черга модерації</p>
              <h2 className="panel-title">Модерація</h2>
            </div>
          </div>
          {!adminRequests.length ? <div className="empty-state">Немає заявок для модерації.</div> : null}

          <div className="list-stack">
            {adminRequests.map((request) => {
              const canModerate = request.status === "PENDING";
              const canCreateMissingProject = request.status === "APPROVED" && !request.createdProjectId;
              const isCreating = creatingProjectRequestId === request.id;
              return (
                <article key={request.id} className="list-card moderation-card">
                  <div className="project-card-head">
                    <h3>{request.title}</h3>
                    <span className={requestStatusClass(request.status)}>{formatRequestStatus(request.status)}</span>
                  </div>
                  <p>{request.description || "Без опису."}</p>
                  <div className="meta-grid">
                    <span>Автор ID <strong>{request.authorUserId}</strong></span>
                    <span>Створено <strong>{formatDateTime(request.createdAt)}</strong></span>
                    {request.createdProjectId ? (
                      <span>Проєкт <strong>#{request.createdProjectId}</strong></span>
                    ) : null}
                  </div>

                  {request.adminComment ? <p className="muted">Чинний коментар адміністратора: {request.adminComment}</p> : null}

                  <label className="field">
                    <span>Коментар модерації</span>
                    <textarea
                      rows={2}
                      value={moderationComments[request.id] || ""}
                      onChange={(event) => updateComment(request.id, event.target.value)}
                      placeholder="Необов'язковий коментар"
                    />
                  </label>

                  <div className="toolbar">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => moderateRequest(request.id, "approve")}
                      disabled={!canModerate}
                    >
                      Схвалити
                    </button>
                    <button
                      type="button"
                      className="button button-soft"
                      onClick={() => moderateRequest(request.id, "reject")}
                      disabled={!canModerate}
                    >
                      Відхилити
                    </button>
                    {canCreateMissingProject ? (
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => createProjectForApprovedRequest(request)}
                        disabled={isCreating}
                      >
                        {isCreating ? "Створення..." : "Створити проєкт"}
                      </button>
                    ) : null}
                    {request.createdProjectId ? (
                      <Link to="/site/projects/completed" className="button button-soft">
                        До керування проєктами
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
