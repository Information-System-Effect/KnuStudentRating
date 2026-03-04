function getInitials(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";
}

export default function ParticipantAvatar({ fullName, photoUrl, size = 68 }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={fullName || "Фото користувача"}
        className="avatar"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  return (
    <div className="avatar avatar-fallback" style={{ width: `${size}px`, height: `${size}px` }}>
      {getInitials(fullName)}
    </div>
  );
}
