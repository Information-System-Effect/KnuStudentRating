import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Breadcrumbs from "../components/Breadcrumbs";
import CreateProjectFromRequestModal from "../components/CreateProjectFromRequestModal";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import MemberPicker from "../components/MemberPicker";
import { useToast } from "../components/ToastProvider";
import { getErrorMessage } from "../lib/errors";
import {
  formatDateTime,
  formatProjectStatus,
  formatRequestStatus,
  formatRoleLabel,
  profileLink,
} from "../lib/format";

const MEMBER_ROLE_LABELS = {
  OWNER: "Власник",
  STUDENT: "Студент",
  TEACHER: "Викладач",
  MENTOR: "Ментор",
};

const MEMBER_ROLE_OPTIONS = ["OWNER", "STUDENT", "TEACHER", "MENTOR"];

function formatMemberRole(value) {
  return MEMBER_ROLE_LABELS[String(value || "").toUpperCase()] || value || "-";
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
  return normalizeDateTimeInput(new Date(Date.now() + hours * 60 * 60 * 1000));
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

function createTeacherForm() {
  return {
    email: "",
    password: "",
    fullName: "",
    institution: "",
    groupName: "",
    about: "",
  };
}

function createProjectForm() {
  return {
    title: "",
    description: "",
    studentIds: [],
    teacherIds: [],
  };
}

function statusClass(status) {
  const normalized = String(status || "").toLowerCase().replace(/_/g, "-");
  return `status-pill status-pill-${normalized}`;
}

export default function AdminConsolePage() {
  const { api, authApi } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  const [requestComments, setRequestComments] = useState({});
  const [lifecycleDrafts, setLifecycleDrafts] = useState({});
  const [memberDrafts, setMemberDrafts] = useState({});
  const [roleDrafts, setRoleDrafts] = useState({});

  const [teacherForm, setTeacherForm] = useState(createTeacherForm);
  const [projectCreateForm, setProjectCreateForm] = useState(createProjectForm);

  const [requestFilter, setRequestFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [moderatingRequestId, setModeratingRequestId] = useState(null);
  const [creatingProjectRequestId, setCreatingProjectRequestId] = useState(null);
  const [projectCreationRequest, setProjectCreationRequest] = useState(null);
  const [savingLifecycleProjectId, setSavingLifecycleProjectId] = useState(null);
  const [upsertingMemberProjectId, setUpsertingMemberProjectId] = useState(null);
  const [removingMemberKey, setRemovingMemberKey] = useState("");
  const [savingRoleUserId, setSavingRoleUserId] = useState(null);
  const [deletingProjectId, setDeletingProjectId] = useState(null);
  const [purgingProjectId, setPurgingProjectId] = useState(null);
  const [deletingRequestId, setDeletingRequestId] = useState(null);
  const [creatingProjectDirect, setCreatingProjectDirect] = useState(false);
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [siteHome, requestData, projectData, usersData, rolesData] = await Promise.all([
        api("/api/site/home", { method: "GET" }),
        authApi("/api/admin/project-requests", { method: "GET" }),
        authApi("/api/projects", { method: "GET" }),
        authApi("/api/admin/users", { method: "GET" }),
        authApi("/api/admin/users/roles", { method: "GET" }),
      ]);

      setStats(siteHome);
      setRequests(requestData);
      setProjects(projectData);
      setUsers(usersData);
      setRoles(rolesData);

      setRoleDrafts((current) => {
        const next = { ...current };
        for (const user of usersData) {
          next[user.userId] = current[user.userId] || user.role;
        }
        return next;
      });

      setLifecycleDrafts((current) => {
        const next = { ...current };
        for (const project of projectData) {
          next[project.id] = resolveLifecycleDraft(project, current[project.id]);
        }
        return next;
      });

      setMemberDrafts((current) => {
        const next = { ...current };
        for (const project of projectData) {
          next[project.id] = current[project.id] || { userId: "", memberRole: "STUDENT" };
        }
        return next;
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Не вдалося завантажити дані панелі адміністрування."));
    } finally {
      setIsLoading(false);
    }
  }, [api, authApi]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const filteredRequests = useMemo(() => {
    const needle = requestFilter.trim().toLowerCase();
    if (!needle) {
      return requests;
    }
    return requests.filter((request) => {
      const hay = `${request.title || ""} ${request.description || ""} ${request.id || ""} ${request.authorUserId || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [requestFilter, requests]);

  const filteredProjects = useMemo(() => {
    const needle = projectFilter.trim().toLowerCase();
    const sorted = [...projects].sort((left, right) => {
      const leftDate = new Date(left.createdAt || left.startAt || 0).getTime();
      const rightDate = new Date(right.createdAt || right.startAt || 0).getTime();
      return rightDate - leftDate;
    });
    if (!needle) {
      return sorted;
    }
    return sorted.filter((project) => {
      const hay = `${project.title || ""} ${project.description || ""} ${project.id || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [projectFilter, projects]);

  const filteredUsers = useMemo(() => {
    const needle = userFilter.trim().toLowerCase();
    const sorted = [...users].sort((left, right) => left.fullName.localeCompare(right.fullName));
    if (!needle) {
      return sorted;
    }
    return sorted.filter((user) => {
      const hay = `${user.fullName || ""} ${user.email || ""} ${user.code || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [userFilter, users]);

  const activeProjectsCount = useMemo(() => projects.filter((project) => project.status === "ACTIVE").length, [projects]);
  const completedProjectsCount = useMemo(() => projects.filter((project) => project.status === "COMPLETED").length, [projects]);
  const pendingRequestsCount = useMemo(() => requests.filter((request) => request.status === "PENDING").length, [requests]);
  const approvedWithoutProjectCount = useMemo(
    () => requests.filter((request) => request.status === "APPROVED" && !request.createdProjectId).length,
    [requests],
  );

  function clearLoadError() {
    setError("");
  }

  function showActionError(title, actionError, fallback) {
    toast.error(title, getErrorMessage(actionError, fallback));
  }

  function updateRequestComment(requestId, value) {
    setRequestComments((current) => ({ ...current, [requestId]: value }));
  }

  function updateLifecycleDraft(project, field, value) {
    setLifecycleDrafts((current) => ({
      ...current,
      [project.id]: {
        ...resolveLifecycleDraft(project, current[project.id]),
        [field]: value,
      },
    }));
  }

  function updateMemberDraft(projectId, field, value) {
    setMemberDrafts((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] || { userId: "", memberRole: "STUDENT" }),
        [field]: value,
      },
    }));
  }

  function updateRoleDraft(userId, role) {
    setRoleDrafts((current) => ({ ...current, [userId]: role }));
  }

  function updateTeacherField(event) {
    const { name, value } = event.target;
    setTeacherForm((current) => ({ ...current, [name]: value }));
  }

  function updateProjectCreateField(event) {
    const { name, value } = event.target;
    setProjectCreateForm((current) => ({ ...current, [name]: value }));
  }

  async function moderateRequest(request, action) {
    clearLoadError();
    setModeratingRequestId(request.id);

    try {
      const updated = await authApi(`/api/admin/project-requests/${encodeURIComponent(request.id)}/${action}`, {
        method: "POST",
        body: {
          comment: requestComments[request.id] || "",
        },
      });

      if (action === "approve") {
        toast.success(
          "Заявку схвалено",
          updated?.createdProjectId
            ? `Проєкт уже прив'язано до заявки (ID: ${updated.createdProjectId}).`
            : "Тепер можна створити проєкт і відразу додати студентів та менторів.",
        );
      } else {
        toast.info("Заявку відхилено", "Статус і коментар модерації збережено.");
      }

      await loadAdminData();
    } catch (submitError) {
      showActionError(
        action === "approve" ? "Не вдалося схвалити заявку" : "Не вдалося відхилити заявку",
        submitError,
        "Спробуйте повторити дію ще раз.",
      );
    } finally {
      setModeratingRequestId(null);
    }
  }

  async function createProjectForApprovedRequest(payload) {
    if (!projectCreationRequest) {
      return;
    }

    clearLoadError();
    setCreatingProjectRequestId(projectCreationRequest.id);

    try {
      const created = await authApi(`/api/admin/projects/from-request/${encodeURIComponent(projectCreationRequest.id)}`, {
        method: "POST",
        body: payload,
      });
      toast.success(
        "Проєкт створено",
        `Проєкт #${created.id} створено із заявки #${projectCreationRequest.id}.`,
      );
      setProjectCreationRequest(null);
      await loadAdminData();
    } catch (submitError) {
      showActionError(
        "Не вдалося створити проєкт",
        submitError,
        "Перевірте склад команди і повторіть спробу.",
      );
    } finally {
      setCreatingProjectRequestId(null);
    }
  }

  async function createProjectFromAdmin(event) {
    event.preventDefault();
    clearLoadError();
    setCreatingProjectDirect(true);

    try {
      const created = await authApi("/api/projects", {
        method: "POST",
        body: {
          title: projectCreateForm.title.trim(),
          description: projectCreateForm.description.trim(),
          studentIds: projectCreateForm.studentIds,
          teacherIds: projectCreateForm.teacherIds,
        },
      });
      toast.success("Проєкт створено", `Новий проєкт #${created.id} додано до системи.`);
      setProjectCreateForm(createProjectForm());
      await loadAdminData();
    } catch (submitError) {
      showActionError(
        "Не вдалося створити проєкт",
        submitError,
        "Перевірте форму і повторіть спробу.",
      );
    } finally {
      setCreatingProjectDirect(false);
    }
  }

  async function deleteProject(project) {
    if (!window.confirm(`Видалити проєкт #${project.id} (${project.title})? Дію неможливо скасувати.`)) {
      return;
    }

    clearLoadError();
    setDeletingProjectId(project.id);

    try {
      const result = await authApi(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });
      toast.success("Операцію виконано", result || `Проєкт #${project.id} опрацьовано.`);
      await loadAdminData();
    } catch (submitError) {
      showActionError(
        "Не вдалося видалити проєкт",
        submitError,
        "Спробуйте виконати цю дію пізніше.",
      );
    } finally {
      setDeletingProjectId(null);
    }
  }

  async function purgeProject(project) {
    if (
      !window.confirm(
        `Безповоротно видалити проєкт #${project.id} (${project.title}) з відкатом його оцінок у рейтингу?`,
      )
    ) {
      return;
    }

    clearLoadError();
    setPurgingProjectId(project.id);

    try {
      const result = await authApi(`/api/admin/projects/${encodeURIComponent(project.id)}/purge`, {
        method: "DELETE",
      });
      toast.success("Проєкт видалено", result || `Проєкт #${project.id} знищено безповоротно.`);
      await loadAdminData();
    } catch (submitError) {
      showActionError(
        "Не вдалося видалити проєкт безповоротно",
        submitError,
        "Спробуйте повторити дію ще раз.",
      );
    } finally {
      setPurgingProjectId(null);
    }
  }

  async function deleteRequest(request) {
    if (!window.confirm(`Видалити заявку #${request.id}? Дію неможливо скасувати.`)) {
      return;
    }

    clearLoadError();
    setDeletingRequestId(request.id);

    try {
      await authApi(`/api/admin/project-requests/${encodeURIComponent(request.id)}`, {
        method: "DELETE",
      });
      toast.success("Заявку видалено", `Заявку #${request.id} видалено з черги.`);
      await loadAdminData();
    } catch (submitError) {
      showActionError(
        "Не вдалося видалити заявку",
        submitError,
        "Спробуйте повторити дію пізніше.",
      );
    } finally {
      setDeletingRequestId(null);
    }
  }

  async function saveLifecycle(project, payload, successText) {
    clearLoadError();
    setSavingLifecycleProjectId(project.id);

    try {
      await authApi(`/api/admin/projects/${encodeURIComponent(project.id)}/lifecycle`, {
        method: "PUT",
        body: payload,
      });
      toast.success("Життєвий цикл оновлено", successText);
      await loadAdminData();
    } catch (submitError) {
      showActionError(
        "Не вдалося оновити життєвий цикл",
        submitError,
        "Перевірте введені дати та статус.",
      );
    } finally {
      setSavingLifecycleProjectId(null);
    }
  }

  async function submitLifecycle(project, event) {
    event.preventDefault();
    const draft = resolveLifecycleDraft(project, lifecycleDrafts[project.id]);

    await saveLifecycle(
      project,
      {
        status: draft.status,
        endAt: draft.endAt || null,
      },
      `Параметри проєкту #${project.id} збережено.`,
    );
  }

  async function quickCompleteProject(project) {
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
      `Проєкт #${project.id} завершено. Вікно оцінювання відкрите ще на 24 години.`,
    );
  }

  async function upsertProjectMember(project) {
    clearLoadError();
    const draft = memberDrafts[project.id] || { userId: "", memberRole: "STUDENT" };
    const parsedUserId = Number(draft.userId);

    if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      toast.error("Не вибрано учасника", "Оберіть користувача для додавання або оновлення ролі в проєкті.");
      return;
    }

    setUpsertingMemberProjectId(project.id);

    try {
      await authApi(`/api/admin/projects/${encodeURIComponent(project.id)}/members`, {
        method: "PUT",
        body: {
          userId: parsedUserId,
          memberRole: draft.memberRole,
        },
      });
      toast.success("Склад проєкту оновлено", `Учасників проєкту #${project.id} синхронізовано.`);
      await loadAdminData();
    } catch (submitError) {
      showActionError(
        "Не вдалося оновити склад проєкту",
        submitError,
        "Перевірте роль користувача і повторіть спробу.",
      );
    } finally {
      setUpsertingMemberProjectId(null);
    }
  }

  async function removeProjectMember(projectId, userId) {
    clearLoadError();
    const key = `${projectId}:${userId}`;
    setRemovingMemberKey(key);

    try {
      await authApi(`/api/admin/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      toast.success("Учасника видалено", `Користувача прибрано з проєкту #${projectId}.`);
      await loadAdminData();
    } catch (submitError) {
      showActionError(
        "Не вдалося видалити учасника",
        submitError,
        "Спробуйте повторити дію ще раз.",
      );
    } finally {
      setRemovingMemberKey("");
    }
  }

  async function saveUserRole(user) {
    clearLoadError();
    setSavingRoleUserId(user.userId);

    try {
      await authApi(`/api/admin/users/${encodeURIComponent(user.userId)}/role`, {
        method: "PUT",
        body: {
          role: roleDrafts[user.userId],
        },
      });
      toast.success("Роль оновлено", `Роль користувача ${user.code} змінено.`);
      await loadAdminData();
    } catch (submitError) {
      showActionError(
        "Не вдалося оновити роль",
        submitError,
        "Спробуйте зберегти зміни пізніше.",
      );
    } finally {
      setSavingRoleUserId(null);
    }
  }

  async function createTeacherAccount(event) {
    event.preventDefault();
    clearLoadError();
    setCreatingTeacher(true);

    try {
      await authApi("/api/auth/register/teacher", {
        method: "POST",
        body: {
          email: teacherForm.email.trim(),
          password: teacherForm.password,
          fullName: teacherForm.fullName.trim(),
          institution: teacherForm.institution.trim(),
          groupName: teacherForm.groupName.trim(),
          about: teacherForm.about.trim(),
        },
      });
      toast.success("Акаунт створено", "Новий обліковий запис викладача готовий до використання.");
      setTeacherForm(createTeacherForm());
      await loadAdminData();
    } catch (submitError) {
      showActionError(
        "Не вдалося створити акаунт викладача",
        submitError,
        "Перевірте форму реєстрації та повторіть спробу.",
      );
    } finally {
      setCreatingTeacher(false);
    }
  }

  return (
    <div className="page-stack admin-console-page">
      <Breadcrumbs
        items={[
          { to: "/", label: "Головна" },
          { label: "Адміністрування" },
        ]}
      />

      <section className="page-hero">
        <div>
          <p className="hero-kicker">Центр керування</p>
          <h1 className="hero-title">Панель адміністрування платформи</h1>
          <p className="hero-text">
            Єдиний центр керування заявками, життєвим циклом проєктів, учасниками та ролями користувачів.
          </p>
        </div>
        <div className="hero-actions">
          <a href="#admin-requests" className="button button-primary">
            Заявки
          </a>
          <a href="#admin-projects" className="button button-soft">
            Проєкти
          </a>
          <a href="#admin-users" className="button button-soft">
            Користувачі
          </a>
        </div>
      </section>

      {error ? (
        <section className="home-error-alert" role="alert">
          <span className="alert-icon" aria-hidden="true" />
          <div>
            <h2>Не вдалося завантажити дані</h2>
            <p>Спробуйте оновити сторінку або повторити запит пізніше.</p>
            <span className="alert-details">{error}</span>
          </div>
          <button type="button" className="button button-soft" onClick={loadAdminData}>
            Спробувати ще раз
          </button>
        </section>
      ) : null}

      {isLoading ? (
        <LoadingState
          title="Завантаження адмін-панелі"
          description="Підтягуємо заявки, проєкти, користувачів та ролі."
          cards={4}
        />
      ) : null}

      <section className="admin-kpi-grid">
        <article className="panel admin-kpi-card">
          <span className="stat-label">Заявки на розгляді</span>
          <strong className="stat-value">{pendingRequestsCount}</strong>
        </article>
        <article className="panel admin-kpi-card">
          <span className="stat-label">Схвалено без проєкту</span>
          <strong className="stat-value">{approvedWithoutProjectCount}</strong>
        </article>
        <article className="panel admin-kpi-card">
          <span className="stat-label">Активні проєкти</span>
          <strong className="stat-value">{activeProjectsCount}</strong>
        </article>
        <article className="panel admin-kpi-card">
          <span className="stat-label">Завершені проєкти</span>
          <strong className="stat-value">{completedProjectsCount || stats?.completedProjects || 0}</strong>
        </article>
        <article className="panel admin-kpi-card">
          <span className="stat-label">Користувачів</span>
          <strong className="stat-value">{users.length}</strong>
        </article>
        <article className="panel admin-kpi-card">
          <span className="stat-label">Студенти</span>
          <strong className="stat-value">{stats?.studentsCount || 0}</strong>
        </article>
      </section>

      <section className="panel admin-board" id="admin-requests">
        <div className="admin-section-head">
          <div>
            <p className="hero-kicker">Черга розгляду</p>
            <h2 className="panel-title">Модерація заявок</h2>
          </div>
          <input
            type="search"
            className="admin-filter"
            placeholder="Пошук заявок..."
            value={requestFilter}
            onChange={(event) => setRequestFilter(event.target.value)}
          />
        </div>

        {!filteredRequests.length ? (
          <EmptyState
            title="Заявок за фільтром не знайдено"
            description="Спробуйте змінити пошуковий запит або дочекайтеся нових ідей від користувачів."
          />
        ) : (
          <div className="list-stack">
            {filteredRequests.map((request) => {
              const isModerating = moderatingRequestId === request.id;
              const isCreatingProject = creatingProjectRequestId === request.id;
              const isDeletingRequest = deletingRequestId === request.id;
              const canModerate = request.status === "PENDING";
              const canCreateMissingProject = request.status === "APPROVED" && !request.createdProjectId;

              return (
                <article key={request.id} className="list-card admin-work-card request-card-emphasis">
                  <div className="admin-row-head">
                    <h3>
                      {request.title} <span className="mono">#{request.id}</span>
                    </h3>
                    <span className={statusClass(request.status)}>{formatRequestStatus(request.status)}</span>
                  </div>

                  <p>{request.description || "Без опису."}</p>
                  <div className="meta-grid">
                    <span>Автор ID <strong>{request.authorUserId}</strong></span>
                    <span>Створено <strong>{formatDateTime(request.createdAt)}</strong></span>
                    <span>Розглянуто <strong>{formatDateTime(request.reviewedAt)}</strong></span>
                  </div>

                  {request.createdProjectId ? (
                    <p className="muted">
                      Проєкт: <span className="mono">#{request.createdProjectId}</span>
                    </p>
                  ) : null}

                  {request.status === "APPROVED" && !request.createdProjectId ? (
                    <p className="inline-insight">
                      <span>Наступний крок</span>
                      <strong>Створіть проєкт і відразу додайте учасників команди через модальне вікно.</strong>
                    </p>
                  ) : null}

                  <label className="field">
                    <span>Коментар модерації</span>
                    <textarea
                      rows={2}
                      value={requestComments[request.id] || ""}
                      onChange={(event) => updateRequestComment(request.id, event.target.value)}
                      placeholder="Необов'язковий коментар"
                    />
                  </label>

                  <div className="toolbar">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => moderateRequest(request, "approve")}
                      disabled={!canModerate || isModerating || isCreatingProject || isDeletingRequest}
                    >
                      {isModerating ? "Обробка..." : "Схвалити"}
                    </button>
                    <button
                      type="button"
                      className="button button-soft"
                      onClick={() => moderateRequest(request, "reject")}
                      disabled={!canModerate || isModerating || isCreatingProject || isDeletingRequest}
                    >
                      Відхилити
                    </button>
                    {canCreateMissingProject ? (
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => setProjectCreationRequest(request)}
                        disabled={isCreatingProject || isModerating || isDeletingRequest}
                      >
                        {isCreatingProject ? "Створення..." : "Створити проєкт"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button button-danger"
                      onClick={() => deleteRequest(request)}
                      disabled={isDeletingRequest || isModerating || isCreatingProject}
                    >
                      {isDeletingRequest ? "Видалення..." : "Видалити заявку"}
                    </button>
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

      <section className="panel admin-board" id="admin-projects">
        <div className="admin-section-head">
          <div>
            <p className="hero-kicker">Керування проєктами</p>
            <h2 className="panel-title">Керування проєктами</h2>
          </div>
          <input
            type="search"
            className="admin-filter"
            placeholder="Пошук проєктів..."
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          />
        </div>

        <section className="panel panel-alt">
          <h3 className="panel-title">Створення проєкту</h3>
          <form className="form-grid three-col" onSubmit={createProjectFromAdmin}>
            <label className="field">
              <span>Назва</span>
              <input
                type="text"
                name="title"
                value={projectCreateForm.title}
                onChange={updateProjectCreateField}
                required
                maxLength={255}
              />
            </label>

            <label className="field field-wide">
              <span>Опис</span>
              <textarea
                name="description"
                rows={2}
                value={projectCreateForm.description}
                onChange={updateProjectCreateField}
                maxLength={4000}
              />
            </label>

            <div className="field field-wide member-picker-grid">
              <MemberPicker
                label="Студенти"
                users={users}
                selectedIds={projectCreateForm.studentIds}
                onChange={(studentIds) => setProjectCreateForm((current) => ({ ...current, studentIds }))}
                audience="student"
                placeholder="Пошук студента за іменем, кодом або email"
                helperText="Додайте студентів, які вже сформували команду для нового проєкту."
                emptySelectedTitle="Студентів ще не додано"
                emptySelectedDescription="Проєкт можна створити й без студентів, якщо команда формуватиметься пізніше."
                disabled={creatingProjectDirect}
              />
              <MemberPicker
                label="Викладачі / ментори"
                users={users}
                selectedIds={projectCreateForm.teacherIds}
                onChange={(teacherIds) => setProjectCreateForm((current) => ({ ...current, teacherIds }))}
                audience="teacher"
                placeholder="Пошук викладача за іменем, кодом або email"
                helperText="Можна додати викладачів і адміністраторів, які будуть менторити проєкт."
                emptySelectedTitle="Менторів ще не додано"
                emptySelectedDescription="За потреби менторів можна призначити пізніше через картку проєкту."
                disabled={creatingProjectDirect}
              />
            </div>

            <div className="toolbar align-end field-wide">
              <button type="submit" className="button button-primary" disabled={creatingProjectDirect}>
                {creatingProjectDirect ? "Створення..." : "Створити проєкт"}
              </button>
            </div>
          </form>
        </section>

        {!filteredProjects.length ? (
          <EmptyState
            title="Проєктів за фільтром не знайдено"
            description="Спробуйте інший пошуковий запит або створіть новий проєкт вручну."
          />
        ) : (
          <div className="list-stack">
            {filteredProjects.map((project) => {
              const draft = resolveLifecycleDraft(project, lifecycleDrafts[project.id]);
              const memberDraft = memberDrafts[project.id] || { userId: "", memberRole: "STUDENT" };
              const lifecycleSaving = savingLifecycleProjectId === project.id;
              const memberSaving = upsertingMemberProjectId === project.id;
              const deletingProject = deletingProjectId === project.id;
              const purgingProject = purgingProjectId === project.id;
              const isCompleted = project.status === "COMPLETED";

              return (
                <article key={project.id} className="list-card admin-work-card">
                  <div className="admin-row-head">
                    <h3>
                      {project.title} <span className="mono">#{project.id}</span>
                    </h3>
                    <span className={statusClass(project.status)}>{formatProjectStatus(project.status)}</span>
                  </div>

                  <p>{project.description || "Без опису."}</p>
                  <div className="meta-grid">
                    <span>Початок <strong>{formatDateTime(project.startAt)}</strong></span>
                    <span>Завершення <strong>{formatDateTime(project.endAt)}</strong></span>
                    <span>Оцінювання до <strong>{formatDateTime(project.feedbackDeadlineAt)}</strong></span>
                  </div>

                  <form className="form-grid three-col" onSubmit={(event) => submitLifecycle(project, event)}>
                    <label className="field">
                      <span>Статус</span>
                      <select
                        value={draft.status}
                        onChange={(event) => updateLifecycleDraft(project, "status", event.target.value)}
                        disabled={isCompleted || lifecycleSaving || memberSaving || deletingProject || purgingProject}
                      >
                        <option value="ACTIVE">Активний</option>
                        <option value="COMPLETED">Завершений</option>
                        <option value="ARCHIVED">Архів</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Дата завершення проєкту</span>
                      <input
                        type="datetime-local"
                        value={draft.endAt}
                        onChange={(event) => updateLifecycleDraft(project, "endAt", event.target.value)}
                        disabled={isCompleted || lifecycleSaving || memberSaving || deletingProject || purgingProject}
                      />
                    </label>

                    <div className="toolbar field-wide">
                      <button
                        type="submit"
                        className="button button-primary"
                        disabled={isCompleted || lifecycleSaving || memberSaving || deletingProject || purgingProject}
                      >
                        {lifecycleSaving ? "Збереження..." : "Зберегти"}
                      </button>
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => quickCompleteProject(project)}
                        disabled={isCompleted || lifecycleSaving || memberSaving || deletingProject || purgingProject}
                      >
                        {isCompleted ? "Проєкт уже завершено" : "Завершити негайно (+24 год)"}
                      </button>
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => deleteProject(project)}
                        disabled={lifecycleSaving || memberSaving || deletingProject || purgingProject}
                      >
                        {deletingProject ? "Видалення..." : "Видалити проєкт"}
                      </button>
                      {project.status === "ARCHIVED" ? (
                        <button
                          type="button"
                          className="button button-danger"
                          onClick={() => purgeProject(project)}
                          disabled={lifecycleSaving || memberSaving || deletingProject || purgingProject}
                        >
                          {purgingProject ? "Знищення..." : "Видалити безповоротно"}
                        </button>
                      ) : null}
                    </div>
                  </form>

                  <div className="admin-members">
                    <h4 className="panel-title">Учасники</h4>
                    {!project.members?.length ? (
                      <EmptyState
                        compact
                        title="У проєкті поки немає учасників"
                        description="Додайте студентів, власника або ментора нижче, щоб відкрити командну роботу."
                      />
                    ) : null}

                    <div className="chip-row">
                      {(project.members || []).map((member) => {
                        const removeKey = `${project.id}:${member.userId}`;
                        const removing = removingMemberKey === removeKey;
                        return (
                          <div key={removeKey} className="admin-member-chip">
                            <Link to={profileLink(member.userCode)} className="chip-link">
                              {member.fullName} <span className="mono">{member.userCode}</span> {formatMemberRole(member.memberRole)}
                            </Link>
                            <button
                              type="button"
                              className="button button-soft"
                              onClick={() => removeProjectMember(project.id, member.userId)}
                              disabled={removing || lifecycleSaving || memberSaving || deletingProject || purgingProject}
                            >
                              {removing ? "..." : "Видалити"}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="form-grid three-col admin-member-form">
                      <label className="field">
                        <span>Додати користувача</span>
                        <select
                          value={memberDraft.userId}
                          onChange={(event) => updateMemberDraft(project.id, "userId", event.target.value)}
                        >
                          <option value="">Оберіть користувача</option>
                          {users.map((user) => (
                            <option key={`${project.id}-${user.userId}`} value={user.userId}>
                              {user.fullName} ({user.code})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Роль у проєкті</span>
                        <select
                          value={memberDraft.memberRole}
                          onChange={(event) => updateMemberDraft(project.id, "memberRole", event.target.value)}
                        >
                          {MEMBER_ROLE_OPTIONS.map((role) => (
                            <option key={`${project.id}-${role}`} value={role}>
                              {formatMemberRole(role)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="toolbar align-end">
                        <button
                          type="button"
                          className="button button-primary"
                          onClick={() => upsertProjectMember(project)}
                          disabled={memberSaving || lifecycleSaving || deletingProject || purgingProject}
                        >
                          {memberSaving ? "Оновлення..." : "Додати або оновити"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel admin-board" id="admin-users">
        <div className="admin-section-head">
          <div>
            <p className="hero-kicker">Користувачі та доступ</p>
            <h2 className="panel-title">Користувачі та ролі</h2>
          </div>
          <input
            type="search"
            className="admin-filter"
            placeholder="Пошук користувачів..."
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
          />
        </div>

        <div className="admin-split-grid">
          <section className="panel panel-alt">
            <h3 className="panel-title">Ролі користувачів</h3>
            {!filteredUsers.length ? (
              <EmptyState
                title="Користувачів за фільтром не знайдено"
                description="Спробуйте іншу частину імені, email або коду користувача."
              />
            ) : (
              <div className="list-stack">
                {filteredUsers.map((user) => {
                  const savingRole = savingRoleUserId === user.userId;
                  return (
                    <article key={user.userId} className="list-card admin-work-card">
                      <h4>
                        {user.fullName} <span className="mono">({user.code})</span>
                      </h4>
                      <p className="muted">{user.email}</p>
                      <div className="toolbar">
                        <select
                          value={roleDrafts[user.userId] || user.role}
                          onChange={(event) => updateRoleDraft(user.userId, event.target.value)}
                        >
                          {roles.map((role) => (
                            <option key={`${user.userId}-${role}`} value={role}>
                              {formatRoleLabel(role)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="button button-primary"
                          onClick={() => saveUserRole(user)}
                          disabled={savingRole}
                        >
                          {savingRole ? "Збереження..." : "Зберегти роль"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel panel-alt">
            <h3 className="panel-title">Створити обліковий запис викладача</h3>
            <form onSubmit={createTeacherAccount} className="form-grid">
              <label className="field">
                <span>Електронна пошта</span>
                <input type="email" name="email" value={teacherForm.email} onChange={updateTeacherField} required />
              </label>

              <label className="field">
                <span>Пароль</span>
                <input
                  type="password"
                  name="password"
                  value={teacherForm.password}
                  onChange={updateTeacherField}
                  minLength={8}
                  required
                />
              </label>

              <label className="field">
                <span>ПІБ</span>
                <input type="text" name="fullName" value={teacherForm.fullName} onChange={updateTeacherField} required />
              </label>

              <label className="field">
                <span>Інституція</span>
                <input type="text" name="institution" value={teacherForm.institution} onChange={updateTeacherField} />
              </label>

              <label className="field">
                <span>Кафедра/група</span>
                <input type="text" name="groupName" value={teacherForm.groupName} onChange={updateTeacherField} />
              </label>

              <label className="field">
                <span>Короткі відомості про себе</span>
                <textarea name="about" rows={4} value={teacherForm.about} onChange={updateTeacherField} />
              </label>

              <button type="submit" className="button button-primary" disabled={creatingTeacher}>
                {creatingTeacher ? "Створення..." : "Створити обліковий запис"}
              </button>
            </form>
          </section>
        </div>
      </section>

      <CreateProjectFromRequestModal
        key={projectCreationRequest?.id || "admin-project-request-modal"}
        open={Boolean(projectCreationRequest)}
        request={projectCreationRequest}
        users={users}
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
