export default function EmptyState({ title, description = "", action = null, compact = false, className = "" }) {
  const classes = ["empty-state", compact ? "empty-state-compact" : "", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state-actions">{action}</div> : null}
    </div>
  );
}
