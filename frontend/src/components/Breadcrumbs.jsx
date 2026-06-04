import { Link } from "react-router-dom";

export default function Breadcrumbs({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <nav className="breadcrumbs" aria-label="Шлях сторінки">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="breadcrumbs-item">
            {item.to && !isLast ? (
              <Link to={item.to} className="breadcrumbs-link">
                {item.label}
              </Link>
            ) : (
              <span className="breadcrumbs-current">{item.label}</span>
            )}
            {!isLast ? <span className="breadcrumbs-separator">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
