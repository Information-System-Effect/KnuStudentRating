import { useMemo, useState } from "react";
import { formatRoleLabel } from "../lib/format";
import EmptyState from "./EmptyState";

function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

function matchAudience(user, audience) {
  const role = normalizeRole(user?.role);
  if (audience === "student") {
    return role === "STUDENT";
  }
  return role === "TEACHER" || role === "ADMIN";
}

function userSearchText(user) {
  return [
    user?.fullName,
    user?.code,
    user?.email,
    user?.groupName,
    user?.institution,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function userMeta(user) {
  return [user?.code, user?.email, user?.groupName || user?.institution].filter(Boolean).join(" • ");
}

export default function MemberPicker({
  label,
  users,
  selectedIds,
  onChange,
  audience,
  placeholder,
  helperText,
  emptySelectedTitle,
  emptySelectedDescription,
  disabled = false,
}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const availableUsers = useMemo(
    () =>
      (users || [])
        .filter((user) => matchAudience(user, audience))
        .sort((left, right) => String(left.fullName || "").localeCompare(String(right.fullName || ""))),
    [audience, users],
  );

  const selectedUsers = useMemo(() => {
    const usersById = new Map(availableUsers.map((user) => [user.userId, user]));
    return (selectedIds || []).map((userId) => usersById.get(userId)).filter(Boolean);
  }, [availableUsers, selectedIds]);

  const suggestions = useMemo(() => {
    const selectedSet = new Set(selectedIds || []);
    const needle = query.trim().toLowerCase();
    return availableUsers
      .filter((user) => !selectedSet.has(user.userId))
      .filter((user) => (needle ? userSearchText(user).includes(needle) : true))
      .slice(0, 10);
  }, [availableUsers, query, selectedIds]);

  function addUser(userId) {
    if (disabled || (selectedIds || []).includes(userId)) {
      return;
    }
    onChange([...(selectedIds || []), userId]);
    setQuery("");
  }

  function removeUser(userId) {
    if (disabled) {
      return;
    }
    onChange((selectedIds || []).filter((value) => value !== userId));
  }

  const showMenu = isFocused && !disabled;

  return (
    <div className="field member-picker">
      <span>{label}</span>
      <input
        type="search"
        value={query}
        disabled={disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setIsFocused(false), 120);
        }}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
      />
      {helperText ? <p className="muted member-picker-hint">{helperText}</p> : null}
      {showMenu ? (
        <div className="picker-menu">
          {!suggestions.length ? (
            <p className="muted">Нічого не знайдено. Спробуйте інше ім'я, код або email.</p>
          ) : null}
          {suggestions.map((user) => (
            <button
              key={`${audience}-${user.userId}`}
              type="button"
              className="picker-option member-picker-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addUser(user.userId)}
            >
              <span className="member-picker-option-title">
                {user.fullName} <small>{formatRoleLabel(user.role)}</small>
              </span>
              <span className="mono">{userMeta(user)}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="picker-selected member-picker-selected">
        {!selectedUsers.length ? (
          <EmptyState
            compact
            title={emptySelectedTitle}
            description={emptySelectedDescription}
            className="member-picker-empty"
          />
        ) : null}
        {selectedUsers.map((user) => (
          <div key={`selected-${audience}-${user.userId}`} className="picker-chip member-chip">
            <span>
              {user.fullName} <small>{user.code}</small>
            </span>
            <span className="member-chip-meta">{formatRoleLabel(user.role)}</span>
            <button type="button" className="picker-chip-remove" onClick={() => removeUser(user.userId)}>
              Прибрати
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
