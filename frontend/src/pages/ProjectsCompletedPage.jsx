import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatDateTime, formatProjectStatus, formatRoleLabel, profileLink } from "../lib/format";

function normalizeDateTimeInput(value) {
  if (!value) {
    return "";
  }

  const text = String(value);
  const directMatch = text.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (directMatch) {
    return directMatch[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function plusHoursInput(hours) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  return normalizeDateTimeInput(date);
}

function createLifecycleDraft(project) {
  return {
    status: project?.status || "ACTIVE",
    endAt: normalizeDateTimeInput(project?.endAt),
  };
}

function resolveLifecycleDraft(project, draft) {
  return {
    ...createLifecycleDraft(project),
    ...(draft || {}),
  };
}

function sortByNewest(leftValue, rightValue) {
  const leftDate = new Date(leftValue || 0).getTime();
  const rightDate = new Date(rightValue || 0).getTime();
  return rightDate - leftDate;
}

export default function ProjectsCompletedPage() {
  const { api, authApi, hasRole, isAuthenticated, me } = useAuth();
  const [projects, setProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [lifecycleDrafts, setLifecycleDrafts] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lifecycleSavingProjectId, setLifecycleSavingProjectId] = useState(null);

  const isAdmin = isAuthenticated && hasRole("ADMIN");

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const completedPromise = api("/api/site/projects/completed", { method: "GET" });
      const allProjectsPromise = isAuthenticated ? authApi("/api/projects", { method: "GET" }) : Promise.resolve([]);
      const [completedData, allProjectsData] = await Promise.all([completedPromise, allProjectsPromise]);

      setProjects(completedData);
      setAllProjects(allProjectsData);

      if (isAdmin) {
        setLifecycleDrafts((current) => {
          const next = { ...current };
          for (const project of allProjectsData) {
            next[project.id] = resolveLifecycleDraft(project, current[project.id]);
          }
          return next;
        });
      } else {
        setLifecycleDrafts({});
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [api, authApi, isAdmin, isAuthenticated]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((left, right) => sortByNewest(left.endAt || left.startAt, right.endAt || right.startAt));
  }, [projects]);

  const sortedAdminProjects = useMemo(() => {
    return [...allProjects].sort((left, right) => sortByNewest(left.createdAt || left.startAt, right.createdAt || right.startAt));
  }, [allProjects]);

  const myActiveProjects = useMemo(() => {
    if (!isAuthenticated || !me?.userId) {
      return [];
    }

    return allProjects
      .filter(
        (project) =>
          project.status === "ACTIVE" && (project.members || []).some((member) => member.userId === me.userId),
      )
      .sort((left, right) => sortByNewest(left.createdAt || left.startAt, right.createdAt || right.startAt));
  }, [allProjects, isAuthenticated, me?.userId]);

  function updateLifecycleDraft(project, field, value) {
    setLifecycleDrafts((current) => {
      const resolved = resolveLifecycleDraft(project, current[project.id]);
      return {
        ...current,
        [project.id]: {
          ...resolved,
          [field]: value,
        },
      };
    });
  }

  async function saveLifecycle(project, payload, successText) {
    setError("");
    setMessage("");
    setLifecycleSavingProjectId(project.id);

    try {
      await authApi(`/api/admin/projects/${encodeURIComponent(project.id)}/lifecycle`, {
        method: "PUT",
        body: payload,
      });
      setMessage(successText);
      await loadProjects();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLifecycleSavingProjectId(null);
    }
  }

  async function handleLifecycleSubmit(event, project) {
    event.preventDefault();
    const draft = resolveLifecycleDraft(project, lifecycleDrafts[project.id]);

    await saveLifecycle(
      project,
      {
        status: draft.status,
        endAt: draft.endAt || null,
      },
      `Життєвий цикл проєкту #${project.id} оновлено.`,
    );
  }

  async function handleQuickComplete(project) {
    if (project.status === "COMPLETED") {
      return;
    }

    const endAt = plusHoursInput(0);

    setLifecycleDrafts((current) => ({
      ...current,
      [project.id]: {
        ...resolveLifecycleDraft(project, current[project.id]),
        status: "COMPLETED",
        endAt,
      },
    }));

    await saveLifecycle(
      project,
      {
        status: "COMPLETED",
        endAt,
      },
      `Проєкт #${project.id} завершено. Вікно оцінювання відкрите на 24 години.`,
    );
  }

  return (
    <div className="page-stack projects-page">
      <section className="page-hero">
        <div>
          <p className="hero-kicker">Портфоліо проєктів</p>
          <h1 className="hero-title">Проєкти та команди</h1>
          <p className="hero-text">
            Огляд активної участі, завершених командних робіт і адміністративного життєвого циклу проєктів.
          </p>
        </div>
        <div className="hero-actions">
          <Link to="/site/projects/reviews" className="button button-primary">
            Перейти до оцінювання
          </Link>
          <Link to="/site/projects/requests" className="button button-soft">
            Заявки
          </Link>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Завершені</span>
          <strong className="stat-value">{sortedProjects.length}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Активні для мене</span>
          <strong className="stat-value">{myActiveProjects.length}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">У керуванні</span>
          <strong className="stat-value">{isAdmin ? sortedAdminProjects.length : 0}</strong>
        </article>
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
          <button type="button" className="button button-soft" onClick={loadProjects}>
            Спробувати ще раз
          </button>
        </section>
      ) : null}

      {isAuthenticated ? (
        <section className="workspace-section">
          <div className="section-heading">
            <div>
              <p className="hero-kicker">Мій робочий простір</p>
              <h2 className="panel-title">Мої активні проєкти</h2>
            </div>
          </div>
          {!myActiveProjects.length ? (
            <div className="empty-state">
              <strong>Активних проєктів поки немає</strong>
              <p>Коли Вас додадуть до команди, проєкт з'явиться тут з роллю, строками та складом учасників.</p>
            </div>
          ) : (
            <div className="project-card-grid">
              {myActiveProjects.map((project) => {
                const currentMember = (project.members || []).find((member) => member.userId === me?.userId);
                return (
                  <article key={`active-${project.id}`} className="list-card project-card">
                    <div className="project-card-head">
                      <h3>{project.title}</h3>
                      <span className="status-pill status-pill-active">{formatProjectStatus(project.status)}</span>
                    </div>
                    <p>{project.description || "Опис відсутній."}</p>
                    <div className="meta-grid">
                      <span>Роль <strong>{formatRoleLabel(currentMember?.memberRole)}</strong></span>
                      <span>Старт <strong>{formatDateTime(project.startAt)}</strong></span>
                      <span>План <strong>{formatDateTime(project.endAt)}</strong></span>
                    </div>

                    <div className="chip-row">
                      {(project.members || []).map((member) => (
                        <Link key={`${project.id}-${member.userId}`} to={profileLink(member.userCode)} className="chip-link">
                          {member.fullName} <span className="mono">{member.userCode}</span> {formatRoleLabel(member.memberRole)}
                        </Link>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {isAdmin ? (
        <section className="panel admin-lifecycle-panel">
          <div className="section-heading">
            <div>
              <p className="hero-kicker">Керування</p>
              <h2 className="panel-title">Життєвий цикл проєктів</h2>
            </div>
            <Link to="/site/admin" className="button button-soft">
              Повна admin-панель
            </Link>
          </div>
          <p className="muted">Швидке завершення, архівація та керування строками без переходу з проєктного огляду.</p>
          {!sortedAdminProjects.length ? <div className="empty-state">Наразі немає проєктів для керування.</div> : null}

          <div className="list-stack">
            {sortedAdminProjects.map((project) => {
              const draft = resolveLifecycleDraft(project, lifecycleDrafts[project.id]);
              const isSaving = lifecycleSavingProjectId === project.id;
              const isCompleted = project.status === "COMPLETED";

              return (
                <article key={project.id} className="list-card admin-project-row">
                  <div className="project-card-head">
                    <h3>
                      {project.title} <span className="mono">#{project.id}</span>
                    </h3>
                    <span className={`status-pill status-pill-${String(project.status || "").toLowerCase()}`}>
                      {formatProjectStatus(project.status)}
                    </span>
                  </div>
                  <div className="meta-grid">
                    <span>Початок <strong>{formatDateTime(project.startAt)}</strong></span>
                    <span>Завершення <strong>{formatDateTime(project.endAt)}</strong></span>
                    <span>Оцінювання до <strong>{formatDateTime(project.feedbackDeadlineAt)}</strong></span>
                  </div>

                  <form className="form-grid two-col" onSubmit={(event) => handleLifecycleSubmit(event, project)}>
                    <label className="field">
                      <span>Статус</span>
                      <select
                        value={draft.status}
                        onChange={(event) => updateLifecycleDraft(project, "status", event.target.value)}
                        disabled={isSaving || isCompleted}
                      >
                        <option value="ACTIVE">Активний</option>
                        <option value="COMPLETED">Завершений</option>
                        <option value="ARCHIVED">Архівний</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Дата завершення проєкту</span>
                      <input
                        type="datetime-local"
                        value={draft.endAt}
                        onChange={(event) => updateLifecycleDraft(project, "endAt", event.target.value)}
                        disabled={isSaving || isCompleted}
                      />
                    </label>

                    <div className="toolbar field-wide">
                      <button type="submit" className="button button-primary" disabled={isSaving || isCompleted}>
                        {isSaving ? "Збереження..." : "Зберегти зміни"}
                      </button>
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => handleQuickComplete(project)}
                        disabled={isSaving || isCompleted}
                      >
                        {isCompleted ? "Проєкт уже завершено" : "Завершити негайно (+24 год для оцінювання)"}
                      </button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <p className="hero-kicker">Архів завершених</p>
            <h2 className="panel-title">Завершені проєкти</h2>
          </div>
        </div>
        {isLoading ? <div className="empty-state">Завантаження проєктів...</div> : null}
        {!isLoading && !sortedProjects.length ? <div className="empty-state">Наразі завершені проєкти відсутні.</div> : null}

        <div className="project-card-grid">
          {sortedProjects.map((project) => (
            <article key={project.projectId} className="list-card project-card">
              <div className="project-card-head">
                <h3>{project.title}</h3>
                <span className={`status-pill status-pill-${String(project.status || "").toLowerCase()}`}>
                  {formatProjectStatus(project.status)}
                </span>
              </div>
              <p>{project.description || "Опис відсутній."}</p>
              <div className="meta-grid">
                <span>Початок <strong>{formatDateTime(project.startAt)}</strong></span>
                <span>Завершення <strong>{formatDateTime(project.endAt)}</strong></span>
                <span>Оцінювання до <strong>{formatDateTime(project.feedbackDeadlineAt)}</strong></span>
              </div>

              <div className="chip-row">
                {(project.members || []).map((member) => (
                  <Link key={`${project.projectId}-${member.userId}`} to={profileLink(member.userCode)} className="chip-link">
                    {member.fullName} <span className="mono">{member.userCode}</span> {formatRoleLabel(member.memberRole)}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
