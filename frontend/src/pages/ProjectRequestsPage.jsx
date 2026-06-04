import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Breadcrumbs from "../components/Breadcrumbs";
import CreateProjectFromRequestModal from "../components/CreateProjectFromRequestModal";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import { useToast } from "../components/ToastProvider";
import { getErrorMessage } from "../lib/errors";
import { formatDateTime, formatRequestStatus } from "../lib/format";

function createProjectRequestForm() {
  return { title: "", description: "" };
}

function requestStatusClass(status) {
  return `status-pill status-pill-${String(status || "").toLowerCase().replace(/_/g, "-")}`;
}

export default function ProjectRequestsPage() {
  const { api, authApi, hasRole, isAuthenticated } = useAuth();
  const toast = useToast();

  const [publicRequests, setPublicRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [moderationComments, setModerationComments] = useState({});
  const [form, setForm] = useState(createProjectRequestForm);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [moderatingRequestId, setModeratingRequestId] = useState(null);
  const [creatingProjectRequestId, setCreatingProjectRequestId] = useState(null);
  const [projectCreationRequest, setProjectCreationRequest] = useState(null);

  const canCreateRequests = isAuthenticated && (hasRole("STUDENT") || hasRole("TEACHER"));
  const isAdmin = isAuthenticated && hasRole("ADMIN");

  const pendingAdminCount = useMemo(
    () => adminRequests.filter((request) => request.status === "PENDING").length,
    [adminRequests],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const [publicData, mine, requests, users] = await Promise.all([
        api("/api/site/projects/requests", { method: "GET" }),
        canCreateRequests ? authApi("/api/project-requests/my", { method: "GET" }) : Promise.resolve([]),
        isAdmin ? authApi("/api/admin/project-requests", { method: "GET" }) : Promise.resolve([]),
        isAdmin ? authApi("/api/admin/users", { method: "GET" }) : Promise.resolve([]),
      ]);

      setPublicRequests(publicData);
      setMyRequests(mine);
      setAdminRequests(requests);
      setAdminUsers(users);
    } catch (error) {
      setLoadError(getErrorMessage(error, "Не вдалося завантажити заявки та модераційні дані."));
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
    setIsSubmittingRequest(true);

    try {
      await authApi("/api/project-requests", {
        method: "POST",
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
        },
      });
      setForm(createProjectRequestForm());
      toast.success("Заявку надіслано", "Нова ідея додана до черги на розгляд адміністратора.");
      await loadData();
    } catch (error) {
      toast.error("Не вдалося подати заявку", getErrorMessage(error, "Перевірте поля форми й спробуйте ще раз."));
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  async function moderateRequest(request, action) {
    setModeratingRequestId(request.id);

    try {
      const updated = await authApi(`/api/admin/project-requests/${encodeURIComponent(request.id)}/${action}`, {
        method: "POST",
        body: {
          comment: moderationComments[request.id] || "",
        },
      });

      if (action === "approve") {
        toast.success(
          "Заявку схвалено",
          updated?.createdProjectId
            ? `Проєкт уже пов'язано із заявкою (ID: ${updated.createdProjectId}).`
            : "Тепер можна створити проєкт і додати учасників команди.",
        );
      } else {
        toast.info("Заявку відхилено", "Автор побачить статус та коментар модерації.");
      }

      await loadData();
    } catch (error) {
      toast.error(
        action === "approve" ? "Не вдалося схвалити заявку" : "Не вдалося відхилити заявку",
        getErrorMessage(error, "Спробуйте виконати цю дію ще раз."),
      );
    } finally {
      setModeratingRequestId(null);
    }
  }

  async function createProjectForApprovedRequest(payload) {
    if (!projectCreationRequest) {
      return;
    }

    setCreatingProjectRequestId(projectCreationRequest.id);

    try {
      const createdProject = await authApi(
        `/api/admin/projects/from-request/${encodeURIComponent(projectCreationRequest.id)}`,
        {
          method: "POST",
          body: payload,
        },
      );
      toast.success(
        "Проєкт створено",
        `Проєкт #${createdProject.id} створено із заявки #${projectCreationRequest.id}.`,
      );
      setProjectCreationRequest(null);
      await loadData();
    } catch (error) {
      toast.error(
        "Не вдалося створити проєкт",
        getErrorMessage(error, "Перевірте склад учасників та повторіть спробу."),
      );
    } finally {
      setCreatingProjectRequestId(null);
    }
  }

  return (
    <div className="page-stack requests-page">
      <Breadcrumbs
        items={[
          { to: "/", label: "Головна" },
          { label: "Заявки на проєкти" },
        ]}
      />

      <section className="page-hero">
        <div>
          <p className="hero-kicker">Подання проєктів</p>
          <h1 className="hero-title">Заявки на нові проєкти</h1>
          <p className="hero-text">
            Єдиний потік для ідей, модерації та запуску командних проєктів з прозорим статусом кожної заявки.
          </p>
        </div>
        <div className="hero-actions">
          {canCreateRequests ? (
            <a href="#create-request" className="button button-primary">
              Подати заявку
            </a>
          ) : null}
          {isAdmin ? (
            <a href="#moderation" className="button button-soft">
              До модерації
            </a>
          ) : null}
        </div>
      </section>

      {loadError ? (
        <section className="home-error-alert" role="alert">
          <span className="alert-icon" aria-hidden="true" />
          <div>
            <h2>Не вдалося завантажити дані</h2>
            <p>Спробуйте оновити сторінку або повторити запит пізніше.</p>
            <span className="alert-details">{loadError}</span>
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
          <span className="stat-label">Очікують рішення</span>
          <strong className="stat-value">{pendingAdminCount}</strong>
        </article>
      </section>

      {canCreateRequests ? (
        <section className="request-workbench" id="create-request">
          <article className="panel request-form-card">
            <p className="hero-kicker">Нова заявка</p>
            <h2 className="panel-title">Подати заявку</h2>
            <p className="muted">Коротко опишіть ідею, щоб адміністратор міг швидко її схвалити або повернути з коментарем.</p>
            <form onSubmit={handleCreate} className="form-grid">
              <label className="field">
                <span>Назва</span>
                <input type="text" name="title" value={form.title} onChange={updateForm} required maxLength={255} />
              </label>
              <label className="field">
                <span>Опис</span>
                <textarea name="description" rows={5} value={form.description} onChange={updateForm} maxLength={4000} />
              </label>
              <button type="submit" className="button button-primary" disabled={isSubmittingRequest}>
                {isSubmittingRequest ? "Надсилання..." : "Надіслати заявку"}
              </button>
            </form>
          </article>

          <article className="panel">
            <div className="section-heading">
              <div>
                <p className="hero-kicker">Мої заявки</p>
                <h2 className="panel-title">Історія моїх заявок</h2>
              </div>
            </div>

            {!myRequests.length ? (
              <EmptyState
                title="Поки немає жодної заявки"
                description="Після першого подання тут з'являться статус, дата розгляду та коментар адміністратора."
              />
            ) : (
              <div className="list-stack">
                {myRequests.map((request) => (
                  <article key={request.id} className="list-card request-card request-card-emphasis">
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
            )}
          </article>
        </section>
      ) : null}

      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <p className="hero-kicker">Публічна стрічка</p>
            <h2 className="panel-title">Останні заявки</h2>
          </div>
        </div>

        {isLoading ? (
          <LoadingState
            title="Завантаження заявок"
            description="Готуємо публічну стрічку ідей та статусів."
            cards={3}
          />
        ) : !publicRequests.length ? (
          <EmptyState
            title="Поки немає публічних заявок"
            description="Коли хтось подасть нову ідею, вона з'явиться тут зі статусом і коротким описом."
          />
        ) : (
          <div className="request-card-grid">
            {publicRequests.map((request) => (
              <article key={request.requestId} className="list-card request-card request-card-emphasis">
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
        )}
      </section>

      {isAdmin ? (
        <section className="panel" id="moderation">
          <div className="section-heading">
            <div>
              <p className="hero-kicker">Черга модерації</p>
              <h2 className="panel-title">Рішення по заявках</h2>
            </div>
          </div>

          {!adminRequests.length ? (
            <EmptyState
              title="Немає заявок для модерації"
              description="Коли з'являться нові ідеї, тут можна буде схвалювати заявки та створювати проєкти з учасниками."
            />
          ) : (
            <div className="list-stack">
              {adminRequests.map((request) => {
                const canModerate = request.status === "PENDING";
                const canCreateMissingProject = request.status === "APPROVED" && !request.createdProjectId;
                const isModerating = moderatingRequestId === request.id;
                const isCreating = creatingProjectRequestId === request.id;

                return (
                  <article key={request.id} className="list-card moderation-card request-card-emphasis">
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

                    {request.status === "APPROVED" && !request.createdProjectId ? (
                      <p className="inline-insight">
                        <span>Наступний крок</span>
                        <strong>Створіть проєкт і додайте студентів та менторів перед запуском команди.</strong>
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
                        onClick={() => moderateRequest(request, "approve")}
                        disabled={!canModerate || isModerating || isCreating}
                      >
                        {isModerating && canModerate ? "Схвалення..." : "Схвалити"}
                      </button>
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => moderateRequest(request, "reject")}
                        disabled={!canModerate || isModerating || isCreating}
                      >
                        Відхилити
                      </button>
                      {canCreateMissingProject ? (
                        <button
                          type="button"
                          className="button button-primary"
                          onClick={() => setProjectCreationRequest(request)}
                          disabled={isCreating || isModerating}
                        >
                          {isCreating ? "Створення..." : "Створити проєкт"}
                        </button>
                      ) : null}
                      {request.createdProjectId ? (
                        <Link to="/site/projects/completed" className="button button-soft">
                          До проєктів
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <CreateProjectFromRequestModal
        key={projectCreationRequest?.id || "project-request-modal"}
        open={Boolean(projectCreationRequest)}
        request={projectCreationRequest}
        users={adminUsers}
        isSubmitting={creatingProjectRequestId != null}
        onClose={() => {
          if (creatingProjectRequestId == null) {
            setProjectCreationRequest(null);
          }
        }}
        onConfirm={createProjectForApprovedRequest}
      />
    </div>
  );
}
