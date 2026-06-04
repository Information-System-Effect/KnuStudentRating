export default function LoadingState({ title = "Завантаження даних", description = "", cards = 3, className = "" }) {
  return (
    <div className={["loading-state", className].filter(Boolean).join(" ")} role="status" aria-live="polite">
      <div className="empty-state empty-state-compact">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="loading-card-grid">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={`loading-card-${index}`} className="loading-card">
            <span className="loading-line loading-line-short" />
            <span className="loading-line" />
            <span className="loading-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
