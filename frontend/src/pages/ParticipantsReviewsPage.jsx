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
      <section className="hero hero-short">
        <p className="hero-kicker">Відгуки</p>
        <h1 className="hero-title">{title}</h1>
      </section>

      {error ? <div className="message message-error">{error}</div> : null}

      <div className="split-layout">
        <aside className="panel side-panel">
          <h2 className="panel-title">Учасники</h2>
          {isLoading ? <p>Завантаження списку...</p> : null}
          {!isLoading && !participants.length ? <p className="muted">Учасників не знайдено.</p> : null}

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

        <section className="panel">
          <h2 className="panel-title">Відгуки</h2>
          {!reviews.length ? <p className="muted">Немає відгуків для обраного учасника.</p> : null}

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


