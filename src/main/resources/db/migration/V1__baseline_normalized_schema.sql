CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(32) NOT NULL UNIQUE,
    role ENUM('STUDENT', 'TEACHER', 'ADMIN') NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    institution VARCHAR(255) NULL,
    group_name VARCHAR(64) NULL,
    about TEXT NULL,
    token_version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS category_types (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL UNIQUE,
    audience ENUM('STUDENT', 'TEACHER') NOT NULL,
    dimension ENUM('TECHNICAL', 'SUBJECTIVE') NOT NULL,
    description VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(255) NULL,
    category_type_id BIGINT NOT NULL,
    self_declared_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_categories_type FOREIGN KEY (category_type_id) REFERENCES category_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_requests (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    author_user_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    admin_comment TEXT NULL,
    reviewed_by_user_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    CONSTRAINT fk_project_requests_author FOREIGN KEY (author_user_id) REFERENCES users(id),
    CONSTRAINT fk_project_requests_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS projects (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    status ENUM('ACTIVE', 'COMPLETED', 'ARCHIVED') NOT NULL,
    created_from_request_id BIGINT NULL,
    start_at DATETIME NULL,
    end_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_request FOREIGN KEY (created_from_request_id) REFERENCES project_requests(id),
    CONSTRAINT ck_projects_dates CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_members (
    project_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    member_role ENUM('OWNER', 'STUDENT', 'TEACHER', 'MENTOR') NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id),
    CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS review_windows (
    project_id BIGINT PRIMARY KEY,
    open_at DATETIME NOT NULL,
    close_at DATETIME NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_review_windows_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT ck_review_windows_range CHECK (close_at > open_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    author_user_id BIGINT NOT NULL,
    target_user_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    delta DECIMAL(6,2) NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reviews_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_author FOREIGN KEY (author_user_id) REFERENCES users(id),
    CONSTRAINT fk_reviews_target FOREIGN KEY (target_user_id) REFERENCES users(id),
    CONSTRAINT fk_reviews_category FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT uq_reviews_unique_vote UNIQUE (project_id, author_user_id, target_user_id, category_id),
    CONSTRAINT ck_reviews_not_self CHECK (author_user_id <> target_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS category_scores (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    score DECIMAL(6,2) NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_category_scores_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_category_scores_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    CONSTRAINT uq_category_scores UNIQUE (user_id, category_id),
    CONSTRAINT ck_category_scores_range CHECK (score >= 0 AND score <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS score_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    source_type ENUM('SELF_DECLARED', 'PROJECT_REVIEW', 'ADMIN_ADJUSTMENT') NOT NULL,
    source_ref_id BIGINT NULL,
    delta DECIMAL(6,2) NOT NULL,
    result_score DECIMAL(6,2) NOT NULL,
    is_verified_after_event BOOLEAN NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_score_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_score_events_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    CONSTRAINT ck_score_events_result_range CHECK (result_score >= 0 AND result_score <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    token_jti VARCHAR(128) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    family_id VARCHAR(128) NOT NULL,
    replaced_by_jti VARCHAR(128) NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    revoked_reason VARCHAR(255) NULL,
    created_ip VARCHAR(64) NULL,
    created_user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auth_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT ck_auth_refresh_tokens_dates CHECK (revoked_at IS NULL OR revoked_at <= expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_users_code ON users(code);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_project_requests_status_created ON project_requests(status, created_at);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_reviews_target_created ON reviews(target_user_id, created_at);
CREATE INDEX idx_category_scores_user ON category_scores(user_id);
CREATE INDEX idx_auth_refresh_tokens_user_expires ON auth_refresh_tokens(user_id, expires_at);
CREATE INDEX idx_auth_refresh_tokens_family ON auth_refresh_tokens(family_id);
