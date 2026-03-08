import { Link } from "react-router-dom";
import ParticipantAvatar from "./ParticipantAvatar";
import { formatRoleLabel, formatScore, profileLink } from "../lib/format";

export default function ParticipantSummaryCard({ participant }) {
  if (!participant) {
    return null;
  }

  return (
    <section className="panel profile-summary-card">
      <div className="profile-head">
        <ParticipantAvatar fullName={participant.fullName} photoUrl={participant.photoUrl} />
        <div>
          <h2>
            {participant.fullName} <span className="mono">({participant.code})</span>
          </h2>
          <p className="muted">
            {formatRoleLabel(participant.role)} | {participant.institution || "Інституція не вказана"} |{" "}
            {participant.groupName || "-"}
          </p>
          <Link to={profileLink(participant.code)} className="inline-link">
            Переглянути профіль
          </Link>
        </div>
      </div>

      <p>{participant.about || "Короткий опис відсутній."}</p>

      <div className="stats-grid compact">
        <article className="stat-card">
          <span className="stat-label">Середній бал</span>
          <strong className="stat-value">{formatScore(participant.averageScore)}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Сума</span>
          <strong className="stat-value">{formatScore(participant.totalScore)}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Підтверджені</span>
          <strong className="stat-value">{participant.verifiedCategories}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Непідтверджені</span>
          <strong className="stat-value">{participant.unverifiedCategories}</strong>
        </article>
      </div>
    </section>
  );
}

