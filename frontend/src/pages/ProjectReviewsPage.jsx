import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import { useToast } from "../components/ToastProvider";
import { getErrorMessage } from "../lib/errors";
import { formatCategoryLabel, formatDateTime, formatDelta, formatProjectStatus, profileLink } from "../lib/format";

function createReviewForm() {
  return {
    projectId: "",
    targetUserId: "",
    categoryId: "",
    delta: "0",
    comment: "",
  };
}

function clampDelta(value, maxAbsDelta) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-maxAbsDelta, Math.min(maxAbsDelta, value));
}

function resolveProjectReviewDeadline(project) {
  if (!project) {
    return "";
  }
  if (project.feedbackDeadlineAt) {
    return project.feedbackDeadlineAt;
  }
  if (project.status !== "COMPLETED" || !project.endAt) {
    return "";
  }

  const endTime = new Date(project.endAt).getTime();
  if (!Number.isFinite(endTime)) {
    return "";
  }
  return new Date(endTime + 24 * 60 * 60 * 1000).toISOString();
}

function hasOpenReviewWindow(project) {
  const deadlineValue = resolveProjectReviewDeadline(project);
  if (!deadlineValue || project?.status !== "COMPLETED") {
    return false;
  }
  const deadline = new Date(deadlineValue).getTime();
  return Number.isFinite(deadline) && deadline > Date.now();
}

function formatProjectOption(project) {
  const deadline = resolveProjectReviewDeadline(project);
  const reviewWindowLabel = hasOpenReviewWindow(project)
    ? "вікно оцінювання відкрите"
    : "вікно оцінювання закрите";
  return `${project.title} (#${project.id}) | статус: ${formatProjectStatus(project.status)} | ${reviewWindowLabel}${
    deadline ? ` до ${formatDateTime(deadline)}` : ""
  }`;
}

function toReviewOption(category) {
  if (!category) {
    return null;
  }
  return {
    categoryId: category.categoryId,
    categoryCode: category.categoryCode,
    categoryName: category.categoryName,
    dimension: category.dimension,
    maxAbsDelta: category.maxAbsDelta,
    remainingSubjectiveBudget: category.remainingSubjectiveBudget,
  };
}

function formatRemainingTime(deadlineValue) {
  if (!deadlineValue) {
    return "";
  }

  const deltaMs = new Date(deadlineValue).getTime() - Date.now();
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return "Строк сплив";
  }

  const totalMinutes = Math.floor(deltaMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days} дн ${hours} год`;
  }
  if (hours > 0) {
    return `${hours} год ${minutes} хв`;
  }
  return `${minutes} хв`;
}

export default function ProjectReviewsPage() {
  const { api, authApi, isAuthenticated, me } = useAuth();
  const toast = useToast();

  const [reviews, setReviews] = useState([]);
  const [projects, setProjects] = useState([]);
  const [targets, setTargets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [authoredReviews, setAuthoredReviews] = useState([]);
  const [targetReviewCounts, setTargetReviewCounts] = useState({});
  const [editingReviewId, setEditingReviewId] = useState("");
  const [form, setForm] = useState(createReviewForm);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPublicReviews = useCallback(async () => {
    const data = await api("/api/site/projects/reviews?limit=100", { method: "GET" });
    setReviews(data);
  }, [api]);

  const loadMyProjects = useCallback(async () => {
    if (!isAuthenticated || !me?.userId) {
      setProjects([]);
      return [];
    }

    const allProjects = await authApi("/api/projects", { method: "GET" });
    const myProjects = allProjects.filter((project) => (project.members || []).some((member) => member.userId === me.userId));
    setProjects(myProjects);

    setForm((current) => {
      const nextProjectId = myProjects.length > 0 ? String(myProjects[0].id) : "";
      const shouldKeepProject = myProjects.some((project) => String(project.id) === current.projectId);
      return {
        ...current,
        projectId: shouldKeepProject ? current.projectId : nextProjectId,
        targetUserId: shouldKeepProject ? current.targetUserId : "",
        categoryId: shouldKeepProject ? current.categoryId : "",
      };
    });

    return myProjects;
  }, [authApi, isAuthenticated, me?.userId]);

  const loadReviewContext = useCallback(
    async (projectId, targetUserId) => {
      if (!projectId || !targetUserId) {
        setCategories([]);
        setAuthoredReviews([]);
        setEditingReviewId("");
        setForm((current) => ({ ...current, categoryId: "", delta: "0", comment: "" }));
        return;
      }

      setIsContextLoading(true);
      setFormError("");
      try {
        const [nextCategories, nextAuthoredReviews] = await Promise.all([
          authApi(
            `/api/projects/${encodeURIComponent(projectId)}/reviews/options?targetUserId=${encodeURIComponent(targetUserId)}`,
            { method: "GET" },
          ),
          authApi(
            `/api/projects/${encodeURIComponent(projectId)}/reviews/mine?targetUserId=${encodeURIComponent(targetUserId)}`,
            { method: "GET" },
          ),
        ]);

        setCategories(nextCategories);
        setAuthoredReviews(nextAuthoredReviews);
        setEditingReviewId("");
        setForm((current) => {
          const firstCategory = nextCategories[0] || null;
          const nextLimit = Number(firstCategory?.maxAbsDelta || 5);
          return {
            ...current,
            projectId: String(projectId),
            targetUserId: String(targetUserId),
            categoryId: firstCategory ? String(firstCategory.categoryId) : "",
            delta: firstCategory ? String(clampDelta(0, nextLimit)) : "0",
            comment: "",
          };
        });
      } catch (error) {
        setCategories([]);
        setAuthoredReviews([]);
        setEditingReviewId("");
        setForm((current) => ({ ...current, categoryId: "", delta: "0", comment: "" }));
        setFormError(getErrorMessage(error, "Не вдалося оновити контекст оцінювання для цього учасника."));
      } finally {
        setIsContextLoading(false);
      }
    },
    [authApi],
  );

  const loadReviewProgress = useCallback(
    async (projectId, projectTargets) => {
      if (!projectId || !projectTargets.length) {
        setTargetReviewCounts({});
        return;
      }

      setIsProgressLoading(true);
      try {
        const entries = await Promise.all(
          projectTargets.map(async (target) => {
            const data = await authApi(
              `/api/projects/${encodeURIComponent(projectId)}/reviews/mine?targetUserId=${encodeURIComponent(target.userId)}`,
              { method: "GET" },
            );
            return [target.userId, data.length];
          }),
        );
        setTargetReviewCounts(Object.fromEntries(entries));
      } catch {
        setTargetReviewCounts({});
      } finally {
        setIsProgressLoading(false);
      }
    },
    [authApi],
  );

  const selectedProject = useMemo(() => {
    const currentId = Number(form.projectId);
    return projects.find((project) => project.id === currentId) || null;
  }, [form.projectId, projects]);

  const isSelectedProjectReviewable = useMemo(() => hasOpenReviewWindow(selectedProject), [selectedProject]);

  const selectedTarget = useMemo(() => {
    const currentId = Number(form.targetUserId);
    return targets.find((target) => target.userId === currentId) || null;
  }, [form.targetUserId, targets]);

  const selectedCategory = useMemo(() => {
    const currentId = Number(form.categoryId);
    return categories.find((category) => category.categoryId === currentId) || null;
  }, [categories, form.categoryId]);

  const editingReview = useMemo(() => {
    const currentId = Number(editingReviewId);
    return authoredReviews.find((review) => review.reviewId === currentId) || null;
  }, [authoredReviews, editingReviewId]);

  const activeConstraint = useMemo(() => {
    if (editingReview) {
      return toReviewOption(editingReview);
    }
    return selectedCategory;
  }, [editingReview, selectedCategory]);

  const subjectiveRemainingBudget = useMemo(() => {
    if (!activeConstraint || activeConstraint.dimension !== "SUBJECTIVE") {
      return null;
    }
    const parsed = Number(activeConstraint.remainingSubjectiveBudget);
    return Number.isFinite(parsed) ? parsed : null;
  }, [activeConstraint]);

  const deltaLimit = useMemo(() => {
    const parsed = Number(activeConstraint?.maxAbsDelta);
    return Number.isFinite(parsed) ? parsed : 5;
  }, [activeConstraint?.maxAbsDelta]);

  const reviewedTargetsCount = useMemo(
    () => Object.values(targetReviewCounts).filter((count) => Number(count) > 0).length,
    [targetReviewCounts],
  );

  const currentTargetReviewedCount = useMemo(
    () => (selectedTarget ? Number(targetReviewCounts[selectedTarget.userId] || 0) : 0),
    [selectedTarget, targetReviewCounts],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setLoadError("");
      try {
        await loadPublicReviews();
        if (isAuthenticated) {
          await loadMyProjects();
        }
      } catch (error) {
        if (active) {
          setLoadError(getErrorMessage(error, "Не вдалося завантажити сторінку оцінювання."));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [isAuthenticated, loadMyProjects, loadPublicReviews]);

  useEffect(() => {
    if (!selectedProject || !me?.userId || !isSelectedProjectReviewable) {
      setTargets([]);
      setCategories([]);
      setAuthoredReviews([]);
      setTargetReviewCounts({});
      setEditingReviewId("");
      setForm((current) => ({ ...current, targetUserId: "", categoryId: "", delta: "0", comment: "" }));
      return;
    }

    const nextTargets = (selectedProject.members || []).filter((member) => member.userId !== me.userId);
    setTargets(nextTargets);
    setCategories([]);
    setAuthoredReviews([]);
    setEditingReviewId("");

    setForm((current) => {
      const shouldKeepTarget = nextTargets.some((target) => String(target.userId) === current.targetUserId);
      return {
        ...current,
        targetUserId: shouldKeepTarget ? current.targetUserId : nextTargets[0] ? String(nextTargets[0].userId) : "",
        categoryId: "",
        delta: "0",
        comment: "",
      };
    });
  }, [isSelectedProjectReviewable, me?.userId, selectedProject]);

  useEffect(() => {
    if (!selectedProject || !selectedTarget || !isSelectedProjectReviewable) {
      setCategories([]);
      setAuthoredReviews([]);
      setEditingReviewId("");
      return;
    }

    void loadReviewContext(selectedProject.id, selectedTarget.userId);
  }, [isSelectedProjectReviewable, loadReviewContext, selectedProject, selectedTarget]);

  useEffect(() => {
    if (!selectedProject || !targets.length || !isSelectedProjectReviewable) {
      setTargetReviewCounts({});
      return;
    }

    void loadReviewProgress(selectedProject.id, targets);
  }, [isSelectedProjectReviewable, loadReviewProgress, selectedProject, targets]);

  function updateField(event) {
    const { name, value } = event.target;
    setFormError("");

    if (name === "projectId") {
      setEditingReviewId("");
      setForm((current) => ({ ...current, projectId: value, targetUserId: "", categoryId: "", delta: "0", comment: "" }));
      return;
    }

    if (name === "categoryId") {
      setForm((current) => {
        const option = categories.find((category) => String(category.categoryId) === value);
        const nextLimit = Number(option?.maxAbsDelta || 5);
        return {
          ...current,
          categoryId: value,
          delta: String(clampDelta(Number(current.delta), nextLimit)),
        };
      });
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  }

  function selectTarget(targetUserId) {
    setFormError("");
    setEditingReviewId("");
    setForm((current) => ({
      ...current,
      targetUserId: String(targetUserId),
      categoryId: "",
      delta: "0",
      comment: "",
    }));
  }

  function startEditing(review) {
    setFormError("");
    setEditingReviewId(String(review.reviewId));
    setForm((current) => ({
      ...current,
      categoryId: String(review.categoryId),
      delta: String(review.delta),
      comment: review.comment || "",
    }));
  }

  function stopEditing() {
    setEditingReviewId("");
    setForm((current) => {
      const firstCategory = categories[0] || null;
      return {
        ...current,
        categoryId: firstCategory ? String(firstCategory.categoryId) : "",
        delta: "0",
        comment: "",
      };
    });
  }

  async function refreshCurrentContext() {
    await Promise.all([
      loadPublicReviews(),
      selectedProject && selectedTarget ? loadReviewContext(selectedProject.id, selectedTarget.userId) : Promise.resolve(),
      selectedProject && targets.length ? loadReviewProgress(selectedProject.id, targets) : Promise.resolve(),
    ]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const parsedDelta = Number(form.delta);
    if (!Number.isFinite(parsedDelta)) {
      setFormError("Вкажіть коректне числове значення для оцінки.");
      return;
    }
    if (Math.abs(parsedDelta) > deltaLimit) {
      setFormError(`Коригування перевищує дозволену межу для категорії (+/-${deltaLimit}).`);
      return;
    }
    if (!form.projectId || !form.targetUserId) {
      setFormError("Спочатку оберіть проєкт і конкретного учасника команди.");
      return;
    }
    if (!editingReviewId && !form.categoryId) {
      setFormError("Для цього учасника наразі немає доступних категорій для нового відгуку.");
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingReviewId) {
        await authApi(`/api/projects/${encodeURIComponent(form.projectId)}/reviews/${encodeURIComponent(editingReviewId)}`, {
          method: "PUT",
          body: {
            delta: parsedDelta,
            comment: form.comment.trim(),
          },
        });
        toast.success("Відгук оновлено", "Зміни збережено для поточного учасника.");
      } else {
        await authApi(`/api/projects/${encodeURIComponent(form.projectId)}/reviews`, {
          method: "POST",
          body: {
            targetUserId: Number(form.targetUserId),
            categoryId: Number(form.categoryId),
            delta: parsedDelta,
            comment: form.comment.trim(),
          },
        });
        toast.success("Відгук збережено", "Нова оцінка додана до проєкту.");
      }

      await refreshCurrentContext();
    } catch (error) {
      const message = getErrorMessage(error, "Не вдалося зберегти відгук. Перевірте дані та повторіть спробу.");
      setFormError(message);
      toast.error("Не вдалося зберегти відгук", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const projectDeadline = resolveProjectReviewDeadline(selectedProject);
  const timeRemainingLabel = formatRemainingTime(projectDeadline);
  const canCreateNewReview = categories.length > 0;

  const reviewSteps = [
    {
      key: "project",
      number: "1",
      title: "Оберіть проєкт",
      detail: selectedProject ? selectedProject.title : "Виберіть проєкт зі списку",
      state: form.projectId ? "done" : "current",
    },
    {
      key: "target",
      number: "2",
      title: "Оберіть учасника",
      detail: selectedTarget ? selectedTarget.fullName : "Позначте колегу для відгуку",
      state: form.targetUserId ? "done" : form.projectId ? "current" : "upcoming",
    },
    {
      key: "category",
      number: "3",
      title: "Вкажіть категорію й оцінку",
      detail: activeConstraint
        ? `${formatCategoryLabel(activeConstraint.categoryCode, activeConstraint.categoryName)} • +/-${deltaLimit}`
        : "Оберіть категорію та коригування",
      state: activeConstraint ? "done" : form.targetUserId ? "current" : "upcoming",
    },
    {
      key: "submit",
      number: "4",
      title: editingReviewId ? "Оновіть відгук" : "Збережіть відгук",
      detail: editingReviewId ? "Редагування існуючого відгуку" : "Після збереження прогрес оновиться",
      state: form.comment.trim() || editingReviewId ? "current" : "upcoming",
    },
  ];

  return (
    <div className="page-stack reviews-page">
      <Breadcrumbs
        items={[
          { to: "/", label: "Головна" },
          { label: "Оцінювання проєктів" },
        ]}
      />

      <section className="page-hero">
        <div>
          <p className="hero-kicker">Студія оцінювання</p>
          <h1 className="hero-title">Оцінювання в межах проєктів</h1>
          <p className="hero-text">
            Залишайте відгуки по команді крок за кроком: оберіть колегу, оцініть категорії, додайте коментар і збережіть результат.
          </p>
        </div>
        <div className="hero-actions">
          <a href="#review-studio" className="button button-primary">
            Відкрити студію
          </a>
          <a href="#recent-reviews" className="button button-soft">
            Останні відгуки
          </a>
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
          <button type="button" className="button button-soft" onClick={refreshCurrentContext}>
            Спробувати ще раз
          </button>
        </section>
      ) : null}

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Публічні відгуки</span>
          <strong className="stat-value">{reviews.length}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Мої проєкти</span>
          <strong className="stat-value">{projects.length}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Оцінені учасники</span>
          <strong className="stat-value">{reviewedTargetsCount}</strong>
        </article>
      </section>

      {isAuthenticated ? (
        <section className="review-studio" id="review-studio">
          <aside className="panel review-context-card review-side-stack">
            <div>
              <p className="hero-kicker">Контекст</p>
              <h2 className="panel-title">Стан оцінювання</h2>
            </div>

            <div className="detail-grid compact-detail">
              <div>
                <span>Проєкт</span>
                <strong>{selectedProject?.title || "-"}</strong>
              </div>
              <div>
                <span>Учасник</span>
                <strong>{selectedTarget?.fullName || "-"}</strong>
              </div>
              <div>
                <span>Дедлайн</span>
                <strong>{formatDateTime(projectDeadline)}</strong>
              </div>
              <div>
                <span>Залишилось</span>
                <strong>{timeRemainingLabel || "-"}</strong>
              </div>
            </div>

            <div className="review-progress-card">
              <div className="review-progress-head">
                <span>Прогрес по команді</span>
                <strong>
                  {reviewedTargetsCount} з {targets.length || 0}
                </strong>
              </div>
              <div className="review-progress-track" aria-hidden="true">
                <span
                  style={{
                    width: `${targets.length ? Math.min(100, Math.round((reviewedTargetsCount / targets.length) * 100)) : 0}%`,
                  }}
                />
              </div>
              <p className="muted">
                {targets.length
                  ? `Ви вже залишили щонайменше один відгук для ${reviewedTargetsCount} учасників команди.`
                  : "Після вибору проєкту тут з'явиться прогрес по всій команді."}
              </p>
            </div>

            {targets.length ? (
              <div className="review-target-summary">
                {targets.map((target) => {
                  const reviewed = Number(targetReviewCounts[target.userId] || 0) > 0;
                  const selected = selectedTarget?.userId === target.userId;
                  return (
                    <button
                      key={`target-summary-${target.userId}`}
                      type="button"
                      className={selected ? "review-target-chip active" : "review-target-chip"}
                      onClick={() => selectTarget(target.userId)}
                    >
                      <span>{target.fullName}</span>
                      <small>{reviewed ? "Є відгук" : "Ще не оцінено"}</small>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </aside>

          <section className="panel review-main-panel">
            <div className="section-heading">
              <div>
                <p className="hero-kicker">Форма відгуку</p>
                <h2 className="panel-title">Мої відгуки по команді</h2>
              </div>
            </div>

            {!projects.length ? (
              <EmptyState
                title="Ви ще не є учасником жодного проєкту"
                description="Коли вас додадуть до завершеного проєкту з відкритим вікном оцінювання, тут з'явиться студія відгуків."
                action={
                  <Link to="/site/projects/completed" className="button button-soft">
                    Переглянути проєкти
                  </Link>
                }
              />
            ) : (
              <>
                <div className="review-stepper">
                  {reviewSteps.map((step) => (
                    <article key={step.key} className={`review-step-card review-step-${step.state}`}>
                      <span className="review-step-number">{step.number}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="form-grid">
                  <div className="review-flow-grid">
                    <section className="review-stage-card">
                      <p className="review-stage-kicker">Крок 1</p>
                      <h3>Оберіть проєкт</h3>
                      <label className="field">
                        <span>Проєкт</span>
                        <select name="projectId" value={form.projectId} onChange={updateField} required>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {formatProjectOption(project)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="inline-insight">
                        <span>Вікно оцінювання</span>
                        <strong>{isSelectedProjectReviewable ? "Відкрите" : "Закрите"}</strong>
                      </div>
                    </section>

                    <section className="review-stage-card">
                      <p className="review-stage-kicker">Крок 2</p>
                      <h3>Оберіть колегу</h3>
                      {!targets.length ? (
                        <EmptyState
                          compact
                          title="Немає доступних учасників"
                          description="У цьому проєкті немає інших учасників або вікно оцінювання вже закрите."
                        />
                      ) : (
                        <div className="review-target-grid">
                          {targets.map((target) => {
                            const reviewed = Number(targetReviewCounts[target.userId] || 0) > 0;
                            const isSelected = selectedTarget?.userId === target.userId;
                            return (
                              <button
                                key={`target-${target.userId}`}
                                type="button"
                                className={isSelected ? "button button-select active review-target-card" : "button button-select review-target-card"}
                                onClick={() => selectTarget(target.userId)}
                                disabled={!isSelectedProjectReviewable}
                              >
                                <span>{target.fullName}</span>
                                <small>
                                  {target.userCode} • {reviewed ? "є відгуки" : "ще без відгуку"}
                                </small>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {isProgressLoading ? <p className="muted">Оновлюємо прогрес по команді...</p> : null}
                    </section>
                  </div>

                  <div className="review-flow-grid">
                    <section className="review-stage-card">
                      <p className="review-stage-kicker">Крок 3</p>
                      <h3>Оцініть категорію</h3>
                      <label className="field">
                        <span>Категорія</span>
                        <select
                          name="categoryId"
                          value={form.categoryId}
                          onChange={updateField}
                          required={!editingReviewId}
                          disabled={Boolean(editingReviewId) || !isSelectedProjectReviewable || (!categories.length && !editingReview)}
                        >
                          {editingReview ? (
                            <option value={editingReview.categoryId}>
                              {formatCategoryLabel(editingReview.categoryCode, editingReview.categoryName)} | +/-{editingReview.maxAbsDelta}
                            </option>
                          ) : !categories.length ? (
                            <option value="">Категорії відсутні</option>
                          ) : (
                            categories.map((category) => (
                              <option key={category.categoryId} value={category.categoryId}>
                                {formatCategoryLabel(category.categoryCode, category.categoryName)} | +/-{category.maxAbsDelta}
                              </option>
                            ))
                          )}
                        </select>
                      </label>

                      <label className="field">
                        <span>Коригування оцінки (-{deltaLimit}..{deltaLimit})</span>
                        <input
                          type="number"
                          min={-deltaLimit}
                          max={deltaLimit}
                          step="0.1"
                          name="delta"
                          value={form.delta}
                          onChange={updateField}
                          disabled={!activeConstraint || !isSelectedProjectReviewable}
                        />
                      </label>

                      {subjectiveRemainingBudget != null ? (
                        <p className="inline-insight">
                          <span>Залишок суб'єктивного бюджету</span>
                          <strong>{subjectiveRemainingBudget}</strong>
                        </p>
                      ) : null}

                      {editingReviewId ? (
                        <p className="inline-insight">
                          <span>Режим редагування</span>
                          <strong>Категорію змінити не можна, але оцінку і коментар можна оновити.</strong>
                        </p>
                      ) : null}
                    </section>

                    <section className="review-stage-card">
                      <p className="review-stage-kicker">Крок 4</p>
                      <h3>{editingReviewId ? "Оновіть відгук" : "Додайте коментар і збережіть"}</h3>
                      <label className="field">
                        <span>Коментар</span>
                        <textarea name="comment" rows={4} value={form.comment} onChange={updateField} maxLength={2000} />
                      </label>

                      <div className="inline-insight">
                        <span>Поточний учасник</span>
                        <strong>
                          {selectedTarget?.fullName || "Не вибрано"} • {currentTargetReviewedCount} збережених відгуків
                        </strong>
                      </div>

                      {formError ? <div className="message message-error">{formError}</div> : null}

                      <div className="toolbar">
                        <button
                          type="submit"
                          className="button button-primary"
                          disabled={
                            isSubmitting ||
                            !isSelectedProjectReviewable ||
                            !form.projectId ||
                            !form.targetUserId ||
                            (!editingReviewId && !form.categoryId)
                          }
                        >
                          {isSubmitting ? "Збереження..." : editingReviewId ? "Оновити відгук" : "Зберегти відгук"}
                        </button>
                        {editingReviewId ? (
                          <button type="button" className="button button-soft" onClick={stopEditing} disabled={isSubmitting}>
                            Перейти до нового відгуку
                          </button>
                        ) : null}
                      </div>
                    </section>
                  </div>
                </form>

                {isContextLoading ? (
                  <LoadingState
                    title="Оновлення контексту оцінювання"
                    description="Підтягуємо доступні категорії та ваші попередні відгуки."
                    cards={2}
                    className="loading-state-compact"
                  />
                ) : null}

                {targets.length > 0 && !canCreateNewReview && !authoredReviews.length ? (
                  <EmptyState
                    compact
                    title="Немає доступних категорій для нового відгуку"
                    description="Для цього учасника поки що не відкрито категорій оцінювання."
                  />
                ) : null}

                {targets.length > 0 && !canCreateNewReview && authoredReviews.length ? (
                  <p className="inline-insight">
                    <span>Статус категорій</span>
                    <strong>Усі доступні категорії вже використано, але існуючі відгуки ще можна редагувати до дедлайну.</strong>
                  </p>
                ) : null}

                {targets.length > 0 ? (
                  <div className="list-stack authored-review-stack">
                    <div className="section-heading">
                      <div>
                        <h3 className="panel-title">Мої відгуки для обраного учасника</h3>
                        <p className="muted">Усього відгуків: {authoredReviews.length}</p>
                      </div>
                    </div>

                    {!authoredReviews.length ? (
                      <EmptyState
                        compact
                        title="Ви ще не залишали відгуків цьому учасникові"
                        description="Після збереження перший відгук з'явиться тут і його можна буде відредагувати."
                      />
                    ) : (
                      authoredReviews.map((review) => (
                        <article key={review.reviewId} className="list-card review-card">
                          <div className="project-card-head">
                            <h3>{formatCategoryLabel(review.categoryCode, review.categoryName)}</h3>
                            <span className="category-pill">{formatDelta(review.delta)}</span>
                          </div>
                          <p className="muted">Створено {formatDateTime(review.createdAt)}</p>
                          <p>{review.comment || "Коментар відсутній."}</p>
                          <div className="toolbar">
                            <button
                              type="button"
                              className="button button-soft"
                              onClick={() => startEditing(review)}
                              disabled={isSubmitting}
                            >
                              {editingReviewId === String(review.reviewId) ? "Редагується" : "Редагувати"}
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </section>
      ) : null}

      <section className="workspace-section" id="recent-reviews">
        <div className="section-heading">
          <div>
            <p className="hero-kicker">Публічна активність</p>
            <h2 className="panel-title">Останні відгуки</h2>
          </div>
        </div>

        {isLoading ? (
          <LoadingState
            title="Завантаження відгуків"
            description="Формуємо стрічку останніх оцінювань у системі."
            cards={3}
          />
        ) : !reviews.length ? (
          <EmptyState
            title="Відгуків поки немає"
            description="Коли користувачі почнуть оцінювати команди, останні записи з'являться тут."
          />
        ) : (
          <div className="request-card-grid">
            {reviews.map((review) => (
              <article key={review.reviewId} className="list-card review-card request-card-emphasis">
                <div className="project-card-head">
                  <h3>{review.projectTitle}</h3>
                  <span className="category-pill">{formatDelta(review.delta)}</span>
                </div>
                <p>
                  <Link to={profileLink(review.authorCode)}>{review.authorCode}</Link> для{" "}
                  <Link to={profileLink(review.targetCode)}>{review.targetCode}</Link> |{" "}
                  <span className="category-pill">{formatCategoryLabel(review.categoryCode)}</span>
                </p>
                <p>{review.comment || "Коментар відсутній."}</p>
                <p className="muted">{formatDateTime(review.createdAt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
