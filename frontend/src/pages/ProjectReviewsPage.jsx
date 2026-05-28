import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
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

export default function ProjectReviewsPage() {
  const { api, authApi, isAuthenticated, me } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [projects, setProjects] = useState([]);
  const [targets, setTargets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [authoredReviews, setAuthoredReviews] = useState([]);
  const [editingReviewId, setEditingReviewId] = useState("");
  const [form, setForm] = useState(createReviewForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isContextLoading, setIsContextLoading] = useState(false);
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
      setError("");
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
      } catch (loadError) {
        setCategories([]);
        setAuthoredReviews([]);
        setEditingReviewId("");
        setForm((current) => ({ ...current, categoryId: "", delta: "0", comment: "" }));
        setError(loadError.message);
      } finally {
        setIsContextLoading(false);
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

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError("");
      try {
        await loadPublicReviews();
        if (isAuthenticated) {
          await loadMyProjects();
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
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

  function updateField(event) {
    const { name, value } = event.target;

    if (name === "projectId") {
      setError("");
      setMessage("");
      setEditingReviewId("");
      setForm((current) => ({ ...current, projectId: value, targetUserId: "", categoryId: "", delta: "0", comment: "" }));
      return;
    }

    if (name === "targetUserId") {
      setError("");
      setMessage("");
      setEditingReviewId("");
      setForm((current) => ({ ...current, targetUserId: value, categoryId: "", delta: "0", comment: "" }));
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

  function startEditing(review) {
    setMessage("");
    setError("");
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
    ]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const parsedDelta = Number(form.delta);
      if (!Number.isFinite(parsedDelta)) {
        setError("Некоректне значення коригування оцінки.");
        return;
      }
      if (Math.abs(parsedDelta) > deltaLimit) {
        setError(`Коригування перевищує дозволену межу для категорії (+/-${deltaLimit}).`);
        return;
      }
      if (!form.projectId || !form.targetUserId) {
        setError("Оберіть проєкт і отримувача відгуку.");
        return;
      }
      if (!editingReviewId && !form.categoryId) {
        setError("Для цього учасника наразі немає доступних категорій для нового відгуку.");
        return;
      }

      setIsSubmitting(true);

      if (editingReviewId) {
        await authApi(`/api/projects/${encodeURIComponent(form.projectId)}/reviews/${encodeURIComponent(editingReviewId)}`, {
          method: "PUT",
          body: {
            delta: parsedDelta,
            comment: form.comment.trim(),
          },
        });
        setMessage("Відгук успішно оновлено.");
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
        setMessage("Відгук успішно збережено.");
      }

      await refreshCurrentContext();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const projectDeadline = resolveProjectReviewDeadline(selectedProject);
  const canCreateNewReview = categories.length > 0;

  return (
    <div className="page-stack reviews-page">
      <section className="page-hero">
        <div>
          <p className="hero-kicker">Студія оцінювання</p>
          <h1 className="hero-title">Оцінювання в межах проєктів</h1>
          <p className="hero-text">
            Створюйте точні відгуки за категоріями, редагуйте власні оцінки та контролюйте вікна фідбеку.
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

      {message ? <div className="message message-success">{message}</div> : null}
      {error ? (
        <section className="home-error-alert" role="alert">
          <span className="alert-icon" aria-hidden="true" />
          <div>
            <h2>Не вдалося завантажити дані</h2>
            <p>Спробуйте оновити сторінку або повторити запит пізніше.</p>
            <span className="alert-details">{error}</span>
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
          <span className="stat-label">Мої відгуки</span>
          <strong className="stat-value">{authoredReviews.length}</strong>
        </article>
      </section>

      {isAuthenticated ? (
        <section className="review-studio" id="review-studio">
          <aside className="panel review-context-card">
            <p className="hero-kicker">Контекст</p>
            <h2 className="panel-title">Контекст оцінювання</h2>
            <div className="detail-grid compact-detail">
              <div>
                <span>Проєкт</span>
                <strong>{selectedProject?.title || "-"}</strong>
              </div>
              <div>
                <span>Отримувач</span>
                <strong>{selectedTarget?.fullName || "-"}</strong>
              </div>
              <div>
                <span>Дедлайн</span>
                <strong>{formatDateTime(projectDeadline)}</strong>
              </div>
              <div>
                <span>Вікно</span>
                <strong>{isSelectedProjectReviewable ? "Відкрите" : "Закрите"}</strong>
              </div>
            </div>
          </aside>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="hero-kicker">Форма відгуку</p>
                <h2 className="panel-title">Керування моїми відгуками</h2>
              </div>
            </div>

            {!projects.length ? (
              <div className="empty-state">Наразі Ви не є учасником жодного проєкту.</div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="form-grid two-col">
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
                  <span>Кінцевий строк</span>
                  <strong>{formatDateTime(projectDeadline)}</strong>
                </div>

                {!isSelectedProjectReviewable ? (
                  <p className="message message-error field-wide">
                    Надання відгуків доступне лише протягом відкритого вікна оцінювання для обраного проєкту.
                  </p>
                ) : null}

                <label className="field">
                  <span>Отримувач відгуку</span>
                  <select
                    name="targetUserId"
                    value={form.targetUserId}
                    onChange={updateField}
                    required
                    disabled={!isSelectedProjectReviewable}
                  >
                    {targets.map((target) => (
                      <option key={target.userId} value={target.userId}>
                        {target.fullName} ({target.userCode})
                      </option>
                    ))}
                  </select>
                </label>

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
                    Доступний залишок суб&apos;єктивного ліміту для цієї категорії: {subjectiveRemainingBudget}
                  </p>
                ) : null}

                {editingReviewId ? (
                  <p className="inline-insight">
                    Режим редагування: змінювати категорію неможливо, однак дозволено скоригувати оцінку та коментар.
                  </p>
                ) : null}

                <label className="field field-wide">
                  <span>Коментар</span>
                  <textarea name="comment" rows={3} value={form.comment} onChange={updateField} maxLength={2000} />
                </label>

                <div className="toolbar field-wide">
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
                      Перейти до створення нового відгуку
                    </button>
                  ) : null}
                </div>
              </form>

              {isContextLoading ? <div className="empty-state">Оновлення даних щодо відгуків...</div> : null}
              {!targets.length ? <div className="empty-state">У вибраному проєкті немає інших учасників, яким можна надати відгук.</div> : null}
              {targets.length > 0 && !canCreateNewReview && !authoredReviews.length ? (
                <div className="empty-state">Для вибраного учасника наразі немає доступних категорій оцінювання.</div>
              ) : null}
              {targets.length > 0 && !canCreateNewReview && authoredReviews.length ? (
                <p className="inline-insight">
                  Усі доступні категорії вже використано, однак до завершення строку оцінювання Ви можете редагувати наявні
                  відгуки.
                </p>
              ) : null}

              {targets.length > 0 ? (
                <div className="list-stack authored-review-stack">
                  <h3 className="panel-title">Мої відгуки для вибраної пари учасників</h3>
                  {!authoredReviews.length ? (
                    <div className="empty-state">Ви ще не надавали відгуків цьому учасникові в межах вибраного проєкту.</div>
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
        {isLoading ? <div className="empty-state">Завантаження відгуків...</div> : null}
        {!isLoading && !reviews.length ? <div className="empty-state">Відгуки наразі відсутні.</div> : null}

        <div className="request-card-grid">
          {reviews.map((review) => (
            <article key={review.reviewId} className="list-card review-card">
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
      </section>
    </div>
  );
}
