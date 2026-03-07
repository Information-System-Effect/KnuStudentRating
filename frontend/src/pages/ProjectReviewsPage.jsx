import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatCategoryLabel, formatDateTime, formatDelta, profileLink } from "../lib/format";

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

function hasOpenReviewWindow(project) {
  if (!project || project.status !== "COMPLETED" || !project.feedbackDeadlineAt) {
    return false;
  }
  const deadline = new Date(project.feedbackDeadlineAt).getTime();
  return Number.isFinite(deadline) && deadline > Date.now();
}

export default function ProjectReviewsPage() {
  const { api, authApi, isAuthenticated, me } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [projects, setProjects] = useState([]);
  const [targets, setTargets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(createReviewForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadPublicReviews = useCallback(async () => {
    const data = await api("/api/site/projects/reviews?limit=100", { method: "GET" });
    setReviews(data);
  }, [api]);

  const loadMyProjects = useCallback(async () => {
    if (!isAuthenticated || !me?.userId) {
      setProjects([]);
      return;
    }

    const allProjects = await authApi("/api/projects", { method: "GET" });
    const myProjects = allProjects.filter(
      (project) => hasOpenReviewWindow(project) && (project.members || []).some((member) => member.userId === me.userId),
    );
    setProjects(myProjects);

    if (myProjects.length > 0) {
      setForm((current) => ({ ...current, projectId: String(myProjects[0].id) }));
    } else {
      setForm((current) => ({ ...current, projectId: "", targetUserId: "", categoryId: "" }));
    }
  }, [authApi, isAuthenticated, me?.userId]);

  const selectedProject = useMemo(() => {
    const currentId = Number(form.projectId);
    return projects.find((project) => project.id === currentId) || null;
  }, [form.projectId, projects]);

  const selectedTarget = useMemo(() => {
    const currentId = Number(form.targetUserId);
    return targets.find((target) => target.userId === currentId) || null;
  }, [form.targetUserId, targets]);

  const selectedCategory = useMemo(() => {
    const currentId = Number(form.categoryId);
    return categories.find((category) => category.categoryId === currentId) || null;
  }, [categories, form.categoryId]);

  const subjectiveRemainingBudget = useMemo(() => {
    if (!selectedCategory) {
      return null;
    }
    if (selectedCategory.dimension !== "SUBJECTIVE") {
      return null;
    }
    const parsed = Number(selectedCategory.remainingSubjectiveBudget);
    return Number.isFinite(parsed) ? parsed : null;
  }, [selectedCategory]);

  const deltaLimit = useMemo(() => {
    if (!selectedCategory?.maxAbsDelta) {
      return 5;
    }
    const parsed = Number(selectedCategory.maxAbsDelta);
    return Number.isFinite(parsed) ? parsed : 5;
  }, [selectedCategory?.maxAbsDelta]);

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
    if (!selectedProject || !me?.userId) {
      setTargets([]);
      setCategories([]);
      setForm((current) => ({ ...current, targetUserId: "", categoryId: "" }));
      return;
    }

    const nextTargets = (selectedProject.members || []).filter((member) => member.userId !== me.userId);
    setTargets(nextTargets);

    if (nextTargets.length > 0) {
      setForm((current) => ({ ...current, targetUserId: String(nextTargets[0].userId), categoryId: "" }));
    } else {
      setForm((current) => ({ ...current, targetUserId: "", categoryId: "" }));
      setCategories([]);
    }
  }, [me?.userId, selectedProject]);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      if (!selectedTarget?.userCode) {
        setCategories([]);
        setForm((current) => ({ ...current, categoryId: "" }));
        return;
      }

      try {
        const list = await authApi(
          `/api/projects/${encodeURIComponent(form.projectId)}/reviews/options?targetUserId=${encodeURIComponent(
            selectedTarget.userId,
          )}`,
          { method: "GET" },
        );
        if (!active) {
          return;
        }
        setCategories(list);
        setForm((current) => ({
          ...current,
          categoryId: list.length > 0 ? String(list[0].categoryId) : "",
          delta: list.length > 0 ? String(clampDelta(Number(current.delta), Number(list[0].maxAbsDelta || 5))) : current.delta,
        }));
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
        }
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, [authApi, form.projectId, selectedTarget?.userCode, selectedTarget?.userId]);

  function updateField(event) {
    const { name, value } = event.target;
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

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const parsedDelta = Number(form.delta);
      if (!Number.isFinite(parsedDelta)) {
        setError("Некоректне значення дельти.");
        return;
      }
      if (Math.abs(parsedDelta) > deltaLimit) {
        setError(`Дельта перевищує дозволений ліміт для категорії (±${deltaLimit}).`);
        return;
      }

      await authApi(`/api/projects/${encodeURIComponent(form.projectId)}/reviews`, {
        method: "POST",
        body: {
          targetUserId: Number(form.targetUserId),
          categoryId: Number(form.categoryId),
          delta: parsedDelta,
          comment: form.comment.trim(),
        },
      });

      setMessage("Оцінювання додано.");
      setForm((current) => ({ ...current, comment: "", delta: "0" }));
      await loadPublicReviews();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <div className="page-stack">
      <section className="hero hero-short">
        <p className="hero-kicker">Відгуки</p>
        <h1 className="hero-title">Оцінювання в межах проєктів</h1>
      </section>

      {message ? <div className="message message-success">{message}</div> : null}
      {error ? <div className="message message-error">{error}</div> : null}

      {isAuthenticated ? (
        <section className="panel">
          <h2 className="panel-title">Додати оцінювання</h2>

          {!projects.length ? (
            <p className="muted">У вас немає завершених проєктів з відкритим вікном оцінювання.</p>
          ) : (
            <form onSubmit={handleSubmit} className="form-grid two-col">
              <label className="field">
                <span>Проєкт</span>
                <select name="projectId" value={form.projectId} onChange={updateField} required>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title} (#{project.id})
                    </option>
                  ))}
                </select>
              </label>

              <p className="muted">Оцінювання для обраного проєкту доступне до: {formatDateTime(selectedProject?.feedbackDeadlineAt)}</p>

              <label className="field">
                <span>Кому</span>
                <select name="targetUserId" value={form.targetUserId} onChange={updateField} required>
                  {targets.map((target) => (
                    <option key={target.userId} value={target.userId}>
                      {target.fullName} ({target.userCode})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Категорія</span>
                <select name="categoryId" value={form.categoryId} onChange={updateField} required>
                  {categories.map((category) => (
                    <option key={category.categoryId} value={category.categoryId}>
                      {formatCategoryLabel(category.categoryCode, category.categoryName)} | ±{category.maxAbsDelta}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>
                  Delta (-{deltaLimit}..{deltaLimit})
                </span>
                <input
                  type="number"
                  min={-deltaLimit}
                  max={deltaLimit}
                  step="0.1"
                  name="delta"
                  value={form.delta}
                  onChange={updateField}
                />
              </label>
              {subjectiveRemainingBudget != null ? (
                <p className="muted">Залишок суб'єктивного бюджету в цьому проєкті: {subjectiveRemainingBudget}</p>
              ) : null}

              <label className="field field-wide">
                <span>Коментар</span>
                <textarea name="comment" rows={3} value={form.comment} onChange={updateField} maxLength={2000} />
              </label>

              <button
                type="submit"
                className="button button-primary"
                disabled={!form.projectId || !form.targetUserId || !form.categoryId}
              >
                Надіслати відгук
              </button>
            </form>
          )}
          {projects.length > 0 && targets.length > 0 && !categories.length ? (
            <p className="muted">Для обраного адресата немає доступних категорій оцінювання.</p>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <h2 className="panel-title">Останні оцінювання</h2>
        {isLoading ? <p>Завантаження відгуків...</p> : null}
        {!isLoading && !reviews.length ? <p className="muted">Відгуків поки немає.</p> : null}

        <div className="list-stack">
          {reviews.map((review) => (
            <article key={review.reviewId} className="list-card">
              <h3>{review.projectTitle}</h3>
              <p>
                <Link to={profileLink(review.authorCode)}>{review.authorCode}</Link> до{" "}
                <Link to={profileLink(review.targetCode)}>{review.targetCode}</Link> |{" "}
                <span className="category-pill">{formatCategoryLabel(review.categoryCode)}</span> | дельта{" "}
                <strong>{formatDelta(review.delta)}</strong>
              </p>
              <p>{review.comment || "Без коментаря."}</p>
              <p className="muted">{formatDateTime(review.createdAt)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
