import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatDateTime, formatProjectStatus, formatRoleLabel, profileLink } from "../lib/format";

function createEmptyProjectForm() {
  return {
    title: "",
    description: "",
    feedbackDeadlineAt: "",
    studentIds: [],
    teacherIds: [],
  };
}

function normalizeSearchToken(value) {
  return String(value || "").trim().toLowerCase();
}

function filterPickerUsers(users, selectedIds, query) {
  const selectedSet = new Set(selectedIds || []);
  const needle = normalizeSearchToken(query);

  const filtered = users.filter((user) => {
    if (selectedSet.has(user.userId)) {
      return false;
    }
    if (!needle) {
      return true;
    }
    const haystack = `${user.fullName || ""} ${user.code || ""} ${user.role || ""}`.toLowerCase();
    return haystack.includes(needle);
  });

  return filtered.slice(0, 12);
}

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
    feedbackDeadlineAt: normalizeDateTimeInput(project?.feedbackDeadlineAt),
  };
}

function resolveLifecycleDraft(project, draft) {
  return {
    ...createLifecycleDraft(project),
    ...(draft || {}),
  };
}

export default function ProjectsCompletedPage() {
  const { api, authApi, hasRole, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState([]);
  const [adminProjects, setAdminProjects] = useState([]);
  const [studentCandidates, setStudentCandidates] = useState([]);
  const [teacherCandidates, setTeacherCandidates] = useState([]);
  const [lifecycleDrafts, setLifecycleDrafts] = useState({});
  const [form, setForm] = useState(createEmptyProjectForm);
  const [studentQuery, setStudentQuery] = useState("");
  const [teacherQuery, setTeacherQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lifecycleSavingProjectId, setLifecycleSavingProjectId] = useState(null);

  const isAdmin = isAuthenticated && hasRole("ADMIN");

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const completedPromise = api("/api/site/projects/completed", { method: "GET" });
      const adminPromise = isAdmin ? authApi("/api/projects", { method: "GET" }) : Promise.resolve([]);
      const studentsPromise = api("/api/site/participants/students", { method: "GET" });
      const teachersPromise = api("/api/site/participants/teachers", { method: "GET" });
      const [completedData, adminData, studentsData, teachersData] = await Promise.all([
        completedPromise,
        adminPromise,
        studentsPromise,
        teachersPromise,
      ]);

      setProjects(completedData);
      setStudentCandidates(studentsData);
      setTeacherCandidates(teachersData);
      if (isAdmin) {
        setAdminProjects(adminData);
        setLifecycleDrafts((current) => {
          const next = { ...current };
          for (const project of adminData) {
            next[project.id] = resolveLifecycleDraft(project, current[project.id]);
          }
          return next;
        });
      } else {
        setAdminProjects([]);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [api, authApi, isAdmin]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((left, right) => {
      const leftDate = new Date(left.endAt || left.startAt || 0).getTime();
      const rightDate = new Date(right.endAt || right.startAt || 0).getTime();
      return rightDate - leftDate;
    });
  }, [projects]);

  const sortedAdminProjects = useMemo(() => {
    return [...adminProjects].sort((left, right) => {
      const leftDate = new Date(left.createdAt || left.startAt || 0).getTime();
      const rightDate = new Date(right.createdAt || right.startAt || 0).getTime();
      return rightDate - leftDate;
    });
  }, [adminProjects]);

  const selectedStudentUsers = useMemo(() => {
    const selectedSet = new Set(form.studentIds || []);
    return studentCandidates.filter((user) => selectedSet.has(user.userId));
  }, [form.studentIds, studentCandidates]);

  const selectedTeacherUsers = useMemo(() => {
    const selectedSet = new Set(form.teacherIds || []);
    return teacherCandidates.filter((user) => selectedSet.has(user.userId));
  }, [form.teacherIds, teacherCandidates]);

  const studentPickerSuggestions = useMemo(
    () => filterPickerUsers(studentCandidates, form.studentIds, studentQuery),
    [form.studentIds, studentCandidates, studentQuery],
  );

  const teacherPickerSuggestions = useMemo(
    () => filterPickerUsers(teacherCandidates, form.teacherIds, teacherQuery),
    [form.teacherIds, teacherCandidates, teacherQuery],
  );

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function addProjectMember(kind, userId) {
    const key = kind === "student" ? "studentIds" : "teacherIds";
    setForm((current) => {
      const currentIds = current[key] || [];
      if (currentIds.includes(userId)) {
        return current;
      }
      return {
        ...current,
        [key]: [...currentIds, userId],
      };
    });
    if (kind === "student") {
      setStudentQuery("");
    } else {
      setTeacherQuery("");
    }
  }

  function removeProjectMember(kind, userId) {
    const key = kind === "student" ? "studentIds" : "teacherIds";
    setForm((current) => ({
      ...current,
      [key]: (current[key] || []).filter((id) => id !== userId),
    }));
  }

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

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const created = await authApi("/api/projects", {
        method: "POST",
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
          feedbackDeadlineAt: form.feedbackDeadlineAt || null,
          studentIds: form.studentIds,
          teacherIds: form.teacherIds,
        },
      });

      setMessage(`Проєкт створено (ID: ${created.id}).`);
      setForm(createEmptyProjectForm());
      setStudentQuery("");
      setTeacherQuery("");
      await loadProjects();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
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
        feedbackDeadlineAt: draft.feedbackDeadlineAt || null,
      },
      `Життєвий цикл проєкту #${project.id} оновлено.`,
    );
  }

  async function handleQuickComplete(project) {
    const endAt = plusHoursInput(0);
    const feedbackDeadlineAt = plusHoursInput(24);

    setLifecycleDrafts((current) => ({
      ...current,
      [project.id]: {
        ...resolveLifecycleDraft(project, current[project.id]),
        status: "COMPLETED",
        endAt,
        feedbackDeadlineAt,
      },
    }));

    await saveLifecycle(
      project,
      {
        status: "COMPLETED",
        endAt,
        feedbackDeadlineAt,
      },
      `Проєкт #${project.id} завершено, вікно оцінювання відкрито на 24 години.`,
    );
  }

  return (
    <div className="page-stack">
      <section className="hero hero-short">
        <p className="hero-kicker">Проєкти</p>
        <h1 className="hero-title">Завершені проєкти та команди</h1>
      </section>

      {isAuthenticated ? (
        <section className="panel">
          <h2 className="panel-title">Створити проєкт</h2>
          <form onSubmit={handleSubmit} className="form-grid two-col">
            <label className="field">
              <span>Назва</span>
              <input type="text" name="title" value={form.title} onChange={updateForm} required maxLength={255} />
            </label>

            <label className="field">
              <span>Дедлайн оцінювання</span>
              <input
                type="datetime-local"
                name="feedbackDeadlineAt"
                value={form.feedbackDeadlineAt}
                onChange={updateForm}
              />
            </label>

            <label className="field field-wide">
              <span>Опис</span>
              <textarea name="description" rows={3} value={form.description} onChange={updateForm} maxLength={4000} />
            </label>

            <label className="field">
              <span>Студенти</span>
              <input
                type="search"
                value={studentQuery}
                onChange={(event) => setStudentQuery(event.target.value)}
                placeholder="Почніть вводити ім'я, код або email студента"
              />
              {studentQuery.trim() ? (
                <div className="picker-menu">
                  {!studentPickerSuggestions.length ? <p className="muted">Нічого не знайдено.</p> : null}
                  {studentPickerSuggestions.map((user) => (
                    <button
                      key={`completed-student-pick-${user.userId}`}
                      type="button"
                      className="picker-option"
                      onClick={() => addProjectMember("student", user.userId)}
                    >
                      <span>{user.fullName}</span>
                      <span className="mono">
                        {user.code} | {user.role}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">Введіть частину імені, коду або email для пошуку.</p>
              )}
              <div className="picker-selected">
                {!selectedStudentUsers.length ? <p className="muted">Студентів ще не додано.</p> : null}
                {selectedStudentUsers.map((user) => (
                  <div key={`completed-student-selected-${user.userId}`} className="picker-chip">
                    <span>
                      {user.fullName} ({user.code})
                    </span>
                    <button
                      type="button"
                      className="picker-chip-remove"
                      onClick={() => removeProjectMember("student", user.userId)}
                    >
                      Видалити
                    </button>
                  </div>
                ))}
              </div>
            </label>

            <label className="field">
              <span>Викладачі / аспіранти</span>
              <input
                type="search"
                value={teacherQuery}
                onChange={(event) => setTeacherQuery(event.target.value)}
                placeholder="Почніть вводити ім'я, код або email викладача"
              />
              {teacherQuery.trim() ? (
                <div className="picker-menu">
                  {!teacherPickerSuggestions.length ? <p className="muted">Нічого не знайдено.</p> : null}
                  {teacherPickerSuggestions.map((user) => (
                    <button
                      key={`completed-teacher-pick-${user.userId}`}
                      type="button"
                      className="picker-option"
                      onClick={() => addProjectMember("teacher", user.userId)}
                    >
                      <span>{user.fullName}</span>
                      <span className="mono">
                        {user.code} | {formatRoleLabel(user.role)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">Введіть частину імені, коду або email для пошуку.</p>
              )}
              <div className="picker-selected">
                {!selectedTeacherUsers.length ? <p className="muted">Викладачів або аспірантів ще не додано.</p> : null}
                {selectedTeacherUsers.map((user) => (
                  <div key={`completed-teacher-selected-${user.userId}`} className="picker-chip">
                    <span>
                      {user.fullName} ({user.code})
                    </span>
                    <button
                      type="button"
                      className="picker-chip-remove"
                      onClick={() => removeProjectMember("teacher", user.userId)}
                    >
                      Видалити
                    </button>
                  </div>
                ))}
              </div>
            </label>

            <button type="submit" className="button button-primary" disabled={isSubmitting}>
              {isSubmitting ? "Створення..." : "Створити проєкт"}
            </button>
          </form>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="panel">
          <h2 className="panel-title">Адмін: життєвий цикл проєктів</h2>
          {!sortedAdminProjects.length ? <p className="muted">Поки немає проєктів для керування.</p> : null}

          <div className="list-stack">
            {sortedAdminProjects.map((project) => {
              const draft = resolveLifecycleDraft(project, lifecycleDrafts[project.id]);
              const isSaving = lifecycleSavingProjectId === project.id;

              return (
                <article key={project.id} className="list-card">
                  <h3>
                    {project.title} <span className="mono">#{project.id}</span>
                  </h3>
                  <p className="muted">
                    Поточний статус: {formatProjectStatus(project.status)} | Початок: {formatDateTime(project.startAt)} | Завершення:{" "}
                    {formatDateTime(project.endAt)} | Дедлайн оцінювання: {formatDateTime(project.feedbackDeadlineAt)}
                  </p>

                  <form className="form-grid two-col" onSubmit={(event) => handleLifecycleSubmit(event, project)}>
                    <label className="field">
                      <span>Статус</span>
                      <select
                        value={draft.status}
                        onChange={(event) => updateLifecycleDraft(project, "status", event.target.value)}
                      >
                        <option value="ACTIVE">Активний</option>
                        <option value="COMPLETED">Завершений</option>
                        <option value="ARCHIVED">Архів</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Дата завершення</span>
                      <input
                        type="datetime-local"
                        value={draft.endAt}
                        onChange={(event) => updateLifecycleDraft(project, "endAt", event.target.value)}
                      />
                    </label>

                    <label className="field">
                      <span>Дедлайн оцінювання</span>
                      <input
                        type="datetime-local"
                        value={draft.feedbackDeadlineAt}
                        onChange={(event) => updateLifecycleDraft(project, "feedbackDeadlineAt", event.target.value)}
                      />
                    </label>

                    <div className="toolbar field-wide">
                      <button type="submit" className="button button-primary" disabled={isSaving}>
                        {isSaving ? "Збереження..." : "Зберегти життєвий цикл"}
                      </button>
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => handleQuickComplete(project)}
                        disabled={isSaving}
                      >
                        Завершити зараз (+24 год для оцінювання)
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
        {!isLoading && !sortedProjects.length ? <p className="muted">Поки немає завершених проєктів.</p> : null}

        <div className="list-stack">
          {sortedProjects.map((project) => (
            <article key={project.projectId} className="list-card">
              <h3>{project.title}</h3>
              <p>{project.description || "Без опису."}</p>
              <p className="muted">
                Статус: {formatProjectStatus(project.status)} | Початок: {formatDateTime(project.startAt)} | Завершення:{" "}
                {formatDateTime(project.endAt)} | Дедлайн оцінювання: {formatDateTime(project.feedbackDeadlineAt)}
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
