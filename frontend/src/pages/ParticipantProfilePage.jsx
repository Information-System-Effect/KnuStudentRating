import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ChartCard from "../components/ChartCard";
import ParticipantSummaryCard from "../components/ParticipantSummaryCard";
import { useAuth } from "../auth/AuthContext";
import { formatCategoryLabel, formatDateTime, formatDelta, formatDimensionLabel, formatScore, profileLink } from "../lib/format";

function buildScoreChart(categoryScores) {
  return {
    labels: categoryScores.map((item) => formatCategoryLabel(item.categoryCode, item.categoryName)),
    datasets: [
      {
        label: "Оцінка",
        data: categoryScores.map((item) => Number(item.score)),
        backgroundColor: categoryScores.map((item) =>
          item.verified ? "rgba(37, 99, 235, 0.82)" : "rgba(245, 158, 11, 0.72)",
        ),
        borderColor: "rgba(15, 23, 42, 0.14)",
        borderWidth: 1,
        borderRadius: 10,
      },
    ],
  };
}

function buildVerificationChart(rating) {
  return {
    labels: ["Підтверджені", "Непідтверджені"],
    datasets: [
      {
        data: [rating.verifiedCategories, rating.unverifiedCategories],
        backgroundColor: ["rgba(37, 99, 235, 0.86)", "rgba(6, 182, 212, 0.72)"],
        borderWidth: 0,
      },
    ],
  };
}

export default function ParticipantProfilePage() {
  const { code = "" } = useParams();
  const { authApi, api, hasRole, isAuthenticated, session } = useAuth();

  const [rating, setRating] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [skillOptions, setSkillOptions] = useState([]);
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    institution: "",
    groupName: "",
    about: "",
  });
  const [skillForm, setSkillForm] = useState({ categoryId: "", score: "" });
  const [photoFile, setPhotoFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const isOwner = isAuthenticated && session.userCode?.toUpperCase() === code.toUpperCase();
  const canCreateProjectRequests = isAuthenticated && isOwner && (hasRole("STUDENT") || hasRole("TEACHER"));

  const loadPublicData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [ratingData, reviewData] = await Promise.all([
        api(`/api/site/participants/${encodeURIComponent(code)}/rating`, { method: "GET" }),
        api(`/api/site/participants/${encodeURIComponent(code)}/reviews?limit=50`, { method: "GET" }),
      ]);
      setRating(ratingData);
      setReviews(reviewData);
      setProfileForm({
        fullName: ratingData.fullName || "",
        institution: ratingData.institution || "",
        groupName: ratingData.groupName || "",
        about: ratingData.about || "",
      });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [api, code]);

  const loadSkillOptions = useCallback(async () => {
    if (!isOwner) {
      setSkillOptions([]);
      setSkillForm({ categoryId: "", score: "" });
      return;
    }

    try {
      const options = await authApi("/api/participants/me/self-skills/options", { method: "GET" });
      setSkillOptions(options);
      if (options.length > 0) {
        setSkillForm({
          categoryId: String(options[0].categoryId),
          score: options[0].currentScore == null ? "" : String(options[0].currentScore),
        });
      } else {
        setSkillForm({ categoryId: "", score: "" });
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [authApi, isOwner]);

  useEffect(() => {
    loadPublicData();
  }, [loadPublicData]);

  useEffect(() => {
    loadSkillOptions();
  }, [loadSkillOptions]);

  const scoreChartData = useMemo(() => {
    if (!rating?.categoryScores) {
      return null;
    }
    return buildScoreChart(rating.categoryScores);
  }, [rating?.categoryScores]);

  const verificationChartData = useMemo(() => {
    if (!rating) {
      return null;
    }
    return buildVerificationChart(rating);
  }, [rating]);

  function updateProfileField(event) {
    const { name, value } = event.target;
    setProfileForm((current) => ({ ...current, [name]: value }));
  }

  function updateSkillField(event) {
    const { name, value } = event.target;
    setSkillForm((current) => ({ ...current, [name]: value }));
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      await authApi("/api/participants/me", {
        method: "PUT",
        body: {
          fullName: profileForm.fullName.trim(),
          institution: profileForm.institution.trim(),
          groupName: profileForm.groupName.trim(),
          about: profileForm.about.trim(),
        },
      });
      setMessage("Профіль оновлено.");
      await loadPublicData();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handlePhotoUpload(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!photoFile) {
      setError("Оберіть файл перед завантаженням.");
      return;
    }

    const body = new FormData();
    body.append("file", photoFile);

    try {
      await authApi("/api/participants/me/photo", {
        method: "POST",
        body,
      });
      setMessage("Фото профілю оновлено.");
      setPhotoFile(null);
      await loadPublicData();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleUpsertSkill(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      await authApi(`/api/participants/me/self-skills/${encodeURIComponent(skillForm.categoryId)}`, {
        method: "PUT",
        body: {
          score: Number(skillForm.score),
        },
      });
      setMessage("Самодекларовану навичку оновлено.");
      await Promise.all([loadPublicData(), loadSkillOptions()]);
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleDeleteSkill() {
    setMessage("");
    setError("");

    if (!skillForm.categoryId) {
      setError("Спершу оберіть категорію навички.");
      return;
    }

    try {
      await authApi(`/api/participants/me/self-skills/${encodeURIComponent(skillForm.categoryId)}`, {
        method: "DELETE",
      });
      setMessage("Самодекларовану навичку видалено.");
      await Promise.all([loadPublicData(), loadSkillOptions()]);
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <p className="hero-kicker">Профіль учасника</p>
          <h1 className="hero-title">Профіль учасника {code}</h1>
          <p className="hero-text">Рейтинг, категорії, відгуки та персональні налаштування в одному профільному просторі.</p>
        </div>
        <div className="hero-actions">
          {canCreateProjectRequests ? (
            <Link to="/site/projects/requests" className="button button-primary">
              Подати заявку
            </Link>
          ) : null}
          <Link to="/site/projects/reviews" className="button button-soft">
            Перейти до відгуків
          </Link>
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
          <button type="button" className="button button-soft" onClick={loadPublicData}>
            Спробувати ще раз
          </button>
        </section>
      ) : null}

      {isLoading ? <section className="empty-state">Завантаження профілю...</section> : null}

      {!isLoading && rating ? <ParticipantSummaryCard participant={rating} /> : null}

      {!isLoading && rating ? (
        <section className="panel profile-data-panel">
          <div className="section-heading">
            <div>
              <p className="hero-kicker">Матриця навичок</p>
              <h2 className="panel-title">Категорії</h2>
            </div>
          </div>
          {!rating.categoryScores?.length ? <p className="muted">Категорійні бали недоступні.</p> : null}

          {rating.categoryScores?.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Категорія</th>
                  <th>Тип</th>
                  <th>Оцінка</th>
                  <th>Підтверджено</th>
                </tr>
              </thead>
              <tbody>
                {rating.categoryScores.map((item) => (
                  <tr key={`${item.categoryCode}-${item.dimension}`}>
                    <td>
                      <span className="category-pill">{formatCategoryLabel(item.categoryCode, item.categoryName)}</span>
                    </td>
                    <td>{formatDimensionLabel(item.dimension)}</td>
                    <td>{formatScore(item.score)}</td>
                    <td>{item.verified ? "Так" : "Ні"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {!isLoading && rating ? (
        <div className="chart-grid">
          <ChartCard
            title="Розподіл оцінок"
            type="bar"
            data={scoreChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                },
              },
              plugins: {
                legend: {
                  display: false,
                },
              },
            }}
          />
          <ChartCard
            title="Розподіл верифікації"
            type="doughnut"
            data={verificationChartData}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
      ) : null}

      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <p className="hero-kicker">Активність</p>
            <h2 className="panel-title">Відгуки</h2>
          </div>
        </div>
        {!reviews.length ? <p className="muted">Для цього учасника ще немає відгуків.</p> : null}

        <div className="list-stack">
          {reviews.map((review) => (
            <article key={review.reviewId} className="list-card">
              <h3>{review.projectTitle}</h3>
              <p>
                <Link to={profileLink(review.authorCode)}>{review.authorCode}</Link> до{" "}
                <Link to={profileLink(review.targetCode)}>{review.targetCode}</Link> |{" "}
                <span className="category-pill">{formatCategoryLabel(review.categoryCode)}</span>
              </p>
              <p>
                Коригування: <strong>{formatDelta(review.delta)}</strong>
              </p>
              <p>{review.comment || "Коментар відсутній."}</p>
              <p className="muted">{formatDateTime(review.createdAt)}</p>
            </article>
          ))}
        </div>
      </section>

      {isOwner ? (
        <section className="panel owner-panel">
          <div className="section-heading">
            <div>
              <p className="hero-kicker">Керування профілем</p>
              <h2 className="panel-title">Дії власника профілю</h2>
            </div>
          </div>

          <form onSubmit={handleProfileSave} className="form-grid two-col">
            <label className="field">
              <span>ПІБ</span>
              <input type="text" name="fullName" value={profileForm.fullName} onChange={updateProfileField} required />
            </label>

            <label className="field">
              <span>Інституція</span>
              <input type="text" name="institution" value={profileForm.institution} onChange={updateProfileField} />
            </label>

            <label className="field">
              <span>Група/кафедра</span>
              <input type="text" name="groupName" value={profileForm.groupName} onChange={updateProfileField} />
            </label>

            <label className="field field-wide">
              <span>Відомості про себе</span>
              <textarea name="about" rows={4} value={profileForm.about} onChange={updateProfileField} maxLength={2000} />
            </label>

            <button type="submit" className="button button-primary">
              Зберегти профіль
            </button>
          </form>

          <form onSubmit={handlePhotoUpload} className="form-grid">
            <label className="field">
              <span>Завантажити фото профілю</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
              />
            </label>
            <button type="submit" className="button button-soft">
              Завантажити фото
            </button>
          </form>

          <form onSubmit={handleUpsertSkill} className="form-grid two-col">
            <label className="field">
              <span>Категорія самодекларованої навички</span>
              <select name="categoryId" value={skillForm.categoryId} onChange={updateSkillField}>
                {skillOptions.map((option) => (
                  <option key={option.categoryId} value={option.categoryId}>
                    {formatCategoryLabel(option.categoryCode, option.categoryName)}
                    {option.currentScore == null ? "" : ` | поточна ${formatScore(option.currentScore)}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Оцінка (0..100)</span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                name="score"
                value={skillForm.score}
                onChange={updateSkillField}
              />
            </label>

            <div className="toolbar field-wide">
              <button type="submit" className="button button-primary">
                Зберегти навичку
              </button>
              <button type="button" className="button button-soft" onClick={handleDeleteSkill}>
                Видалити навичку
              </button>
              {canCreateProjectRequests ? (
                <Link to="/site/projects/requests" className="button button-soft">
                  Подати заявку на проєкт
                </Link>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}



