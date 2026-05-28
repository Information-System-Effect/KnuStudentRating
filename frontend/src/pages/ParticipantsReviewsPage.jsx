import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatCategoryLabel, formatDateTime, formatDelta, profileLink } from "../lib/format";

export default function ParticipantsReviewsPage({ audience }) {
  const { api } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const endpoint = audience === "students" ? "students" : "teachers";
  const title = audience === "students" ? "Відгуки про студентів" : "Відгуки про викладачів";

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

    async function loadReviews() {
      if (!selectedCode) {
        setReviews([]);
        return;
      }

      try {
        const data = await api(`/api/site/participants/${encodeURIComponent(selectedCode)}/reviews?limit=50`, {
          method: "GET",
        });
        if (active) {
          setReviews(data);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
        }
      }
    }

    loadReviews();

    return () => {
      active = false;
    };
  }, [api, selectedCode]);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <p className="hero-kicker">Каталог відгуків</p>
          <h1 className="hero-title">{title}</h1>
          <p className="hero-text">Оберіть учасника, перегляньте контекст відгуків, категорії та останню активність.</p>
        </div>
        <div className="hero-actions">
          {selectedCode ? (
            <Link to={profileLink(selectedCode)} className="button button-primary">
              Переглянути профіль
            </Link>
          ) : null}
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

        <section className="workspace-section">
          <div className="section-heading">
            <div>
              <p className="hero-kicker">Стрічка активності</p>
              <h2 className="panel-title">Відгуки</h2>
            </div>
          </div>
          {!reviews.length ? <div className="empty-state">Немає відгуків для обраного учасника.</div> : null}

          <div className="request-card-grid">
            {reviews.map((review) => (
              <article key={review.reviewId} className="list-card review-card">
                <div className="project-card-head">
                  <h3>{review.projectTitle}</h3>
                  <span className="category-pill">{formatDelta(review.delta)}</span>
                </div>
                <p>
                  <Link to={profileLink(review.authorCode)}>{review.authorCode}</Link> до{" "}
                  <Link to={profileLink(review.targetCode)}>{review.targetCode}</Link> |{" "}
                  <span className="category-pill">{formatCategoryLabel(review.categoryCode)}</span>
                </p>
                <p>{review.comment || "Коментар відсутній."}</p>
                <p className="muted">{formatDateTime(review.createdAt)}</p>
              </article>
            ))}
          </div>

          {selectedCode ? (
            <Link to={profileLink(selectedCode)} className="button button-soft inline-action">
              Переглянути профіль
            </Link>
          ) : null}
        </section>
      </div>
    </div>
  );
}


