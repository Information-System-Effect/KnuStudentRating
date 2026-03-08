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
    <div className="page-stack">
      <section className="hero hero-short">
        <p className="hero-kicker">Проєкти</p>
        <h1 className="hero-title">Проєкти та команди</h1>
      </section>

      {isAuthenticated ? (
        <section className="panel">
          <h2 className="panel-title">Мої активні проєкти</h2>
          {!myActiveProjects.length ? (
            <p className="muted">Наразі у Вас немає активних проєктів, у яких Ви є учасником або власником.</p>
          ) : (
            <div className="list-stack">
              {myActiveProjects.map((project) => {
                const currentMember = (project.members || []).find((member) => member.userId === me?.userId);
                return (
                  <article key={`active-${project.id}`} className="list-card">
                    <h3>
                      {project.title} <span className="mono">#{project.id}</span>
                    </h3>
                    <p>{project.description || "Опис відсутній."}</p>
                    <p className="muted">
                      Статус: {formatProjectStatus(project.status)} | Ваша роль: {formatRoleLabel(currentMember?.memberRole)} |
                      Початок: {formatDateTime(project.startAt)} | Планове завершення: {formatDateTime(project.endAt)}
                    </p>

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
        <section className="panel">
          <h2 className="panel-title">Адміністрування життєвого циклу проєктів</h2>
          <p className="muted">
            Звичайні користувачі можуть створювати лише заявки. Пряме створення проєктів доступне виключно в панелі
            адміністрування.
          </p>
          {!sortedAdminProjects.length ? <p className="muted">Наразі немає проєктів для керування.</p> : null}

          <div className="list-stack">
            {sortedAdminProjects.map((project) => {
              const draft = resolveLifecycleDraft(project, lifecycleDrafts[project.id]);
              const isSaving = lifecycleSavingProjectId === project.id;
              const isCompleted = project.status === "COMPLETED";

              return (
                <article key={project.id} className="list-card">
                  <h3>
                    {project.title} <span className="mono">#{project.id}</span>
                  </h3>
                  <p className="muted">
                    Поточний статус: {formatProjectStatus(project.status)} | Початок: {formatDateTime(project.startAt)} |
                    Завершення: {formatDateTime(project.endAt)} | Оцінювання до: {formatDateTime(project.feedbackDeadlineAt)}
                  </p>

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

      {message ? <div className="message message-success">{message}</div> : null}
      {error ? <div className="message message-error">{error}</div> : null}

      <section className="panel">
        <h2 className="panel-title">Завершені проєкти</h2>
        {isLoading ? <p>Завантаження проєктів...</p> : null}
        {!isLoading && !sortedProjects.length ? <p className="muted">Наразі завершені проєкти відсутні.</p> : null}

        <div className="list-stack">
          {sortedProjects.map((project) => (
            <article key={project.projectId} className="list-card">
              <h3>{project.title}</h3>
              <p>{project.description || "Опис відсутній."}</p>
              <p className="muted">
                Статус: {formatProjectStatus(project.status)} | Початок: {formatDateTime(project.startAt)} | Завершення:{" "}
                {formatDateTime(project.endAt)} | Оцінювання до: {formatDateTime(project.feedbackDeadlineAt)}
              </p>

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
