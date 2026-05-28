import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

export default function ParticipantsDirectoryPage({ audience }) {
  const { api } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [rating, setRating] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const endpoint = audience === "students" ? "students" : "teachers";
  const title = audience === "students" ? "Профілі студентів" : "Профілі викладачів";

  const loadParticipants = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const list = await api(`/api/site/participants/${endpoint}`, { method: "GET" });
      setParticipants(list);
      if (list.length > 0) {
        setSelectedCode(list[0].code);
      } else {
        setSelectedCode("");
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [api, endpoint]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  useEffect(() => {
    let active = true;

    async function loadParticipantData() {
      if (!selectedCode) {
        setRating(null);
        setReviews([]);
        return;
      }

      try {
        const [ratingData, reviewData] = await Promise.all([
          api(`/api/site/participants/${encodeURIComponent(selectedCode)}/rating`, { method: "GET" }),
          api(`/api/site/participants/${encodeURIComponent(selectedCode)}/reviews?limit=30`, { method: "GET" }),
        ]);

        if (!active) {
          return;
        }

        setRating(ratingData);
        setReviews(reviewData);
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
        }
      }
    }

    loadParticipantData();

    return () => {
      active = false;
    };
  }, [api, selectedCode]);

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

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <p className="hero-kicker">Каталог учасників</p>
          <h1 className="hero-title">{title}</h1>
          <p className="hero-text">Порівнюйте профілі, категорійні бали, графіки верифікації та останні відгуки.</p>
        </div>
        <div className="hero-actions">
          <Link
            to={audience === "students" ? "/site/participants/students/reviews" : "/site/participants/teachers/reviews"}
            className="button button-primary"
          >
            Відгуки аудиторії
          </Link>
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
          <button type="button" className="button button-soft" onClick={loadParticipants}>
            Спробувати ще раз
          </button>
        </section>
      ) : null}

      <div className="split-layout">
        <aside className="panel side-panel directory-rail">
          <p className="hero-kicker">Учасники</p>
          <h2 className="panel-title">Учасники</h2>
          {isLoading ? <div className="empty-state">Завантаження списку...</div> : null}
          {!isLoading && !participants.length ? <div className="empty-state">Учасників не знайдено.</div> : null}

          <div className="button-list">
            {participants.map((participant) => (
              <button
                key={participant.code}
                type="button"
                onClick={() => setSelectedCode(participant.code)}
                className={participant.code === selectedCode ? "button button-select active" : "button button-select"}
              >
                <span>{participant.fullName}</span>
                <span className="mono">{participant.code}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="page-stack">
          {rating ? <ParticipantSummaryCard participant={rating} /> : null}

          {rating ? (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="hero-kicker">Матриця навичок</p>
                  <h3 className="panel-title">Категорійні бали</h3>
                </div>
              </div>
              {!rating.categoryScores?.length ? <p className="muted">Категорійні бали ще не задані.</p> : null}

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

          {rating ? (
            <div className="chart-grid">
              <ChartCard
                title="Оцінки за категоріями"
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
                <p className="hero-kicker">Остання активність</p>
                <h3 className="panel-title">Останні відгуки</h3>
              </div>
            </div>
            {!reviews.length ? <p className="muted">Відгуків не знайдено.</p> : null}

            <div className="list-stack">
              {reviews.map((review) => (
                <article key={review.reviewId} className="list-card">
                  <h4>{review.projectTitle}</h4>
                  <p>
                    <Link to={profileLink(review.authorCode)}>{review.authorCode}</Link> до{" "}
                    <Link to={profileLink(review.targetCode)}>{review.targetCode}</Link> |{" "}
                    <span className="category-pill">{formatCategoryLabel(review.categoryCode)}</span> | коригування{" "}
                    <strong>{formatDelta(review.delta)}</strong>
                  </p>
                  <p>{review.comment || "Коментар відсутній."}</p>
                  <p className="muted">{formatDateTime(review.createdAt)}</p>
                </article>
              ))}
            </div>

            {selectedCode ? (
              <Link to={profileLink(selectedCode)} className="button button-soft inline-action">
                Переглянути повний профіль
              </Link>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

