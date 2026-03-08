import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatDateTime, formatRequestStatus } from "../lib/format";

function createProjectRequestForm() {
  return { title: "", description: "" };
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

  const isStudent = isAuthenticated && hasRole("STUDENT");
  const isAdmin = isAuthenticated && hasRole("ADMIN");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const publicData = await api("/api/site/projects/requests", { method: "GET" });
      setPublicRequests(publicData);

      if (isStudent) {
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
  }, [api, authApi, isAdmin, isStudent]);

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
    <div className="page-stack">
      <section className="hero hero-short">
        <p className="hero-kicker">Заявки</p>
        <h1 className="hero-title">Заявки на нові проєкти</h1>
      </section>

      {message ? <div className="message message-success">{message}</div> : null}
      {error ? <div className="message message-error">{error}</div> : null}

      <section className="panel">
        <h2 className="panel-title">Публічна стрічка</h2>
        {isLoading ? <p>Завантаження заявок...</p> : null}
        {!isLoading && !publicRequests.length ? <p className="muted">Заявки наразі відсутні.</p> : null}

        <div className="list-stack">
          {publicRequests.map((request) => (
            <article key={request.requestId} className="list-card">
              <h3>{request.title}</h3>
              <p>{request.description || "Без опису."}</p>
              <p className="muted">
                Статус: {formatRequestStatus(request.status)} | Автор (ID): {request.authorUserId} | Створено:{" "}
                {formatDateTime(request.createdAt)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {isStudent ? (
        <section className="panel">
          <h2 className="panel-title">Подати заявку</h2>
          <form onSubmit={handleCreate} className="form-grid">
            <label className="field">
              <span>Назва</span>
              <input type="text" name="title" value={form.title} onChange={updateForm} required maxLength={255} />
            </label>
            <label className="field">
              <span>Опис</span>
              <textarea name="description" rows={3} value={form.description} onChange={updateForm} maxLength={4000} />
            </label>
            <button type="submit" className="button button-primary">
              Надіслати заявку
            </button>
          </form>

          <h3 className="panel-title">Мої заявки</h3>
          {!myRequests.length ? <p className="muted">Наразі у Вас ще немає заявок.</p> : null}
          <div className="list-stack">
            {myRequests.map((request) => (
              <article key={request.id} className="list-card">
                <h3>{request.title}</h3>
                <p>{request.description || "Без опису."}</p>
                <p className="muted">
                  {formatRequestStatus(request.status)} | Створено: {formatDateTime(request.createdAt)} | Розглянуто:{" "}
                  {formatDateTime(request.reviewedAt)}
                </p>
                {request.adminComment ? <p className="muted">Коментар адміністратора: {request.adminComment}</p> : null}
                {request.createdProjectId ? (
                  <p className="muted">
                    Проєкт створено: <span className="mono">#{request.createdProjectId}</span>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="panel">
          <h2 className="panel-title">Модерація</h2>
          {!adminRequests.length ? <p className="muted">Немає заявок для модерації.</p> : null}

          <div className="list-stack">
            {adminRequests.map((request) => {
              const canModerate = request.status === "PENDING";
              const canCreateMissingProject = request.status === "APPROVED" && !request.createdProjectId;
              const isCreating = creatingProjectRequestId === request.id;
              return (
                <article key={request.id} className="list-card">
                  <h3>{request.title}</h3>
                  <p>{request.description || "Без опису."}</p>
                  <p className="muted">
                    Статус: {formatRequestStatus(request.status)} | Автор (ID): {request.authorUserId} | Створено:{" "}
                    {formatDateTime(request.createdAt)}
                  </p>

                  {request.createdProjectId ? (
                    <p className="muted">
                      Проєкт створено автоматично: <span className="mono">#{request.createdProjectId}</span>
                    </p>
                  ) : null}
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
