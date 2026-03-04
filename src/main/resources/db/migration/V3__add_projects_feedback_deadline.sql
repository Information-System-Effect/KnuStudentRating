ALTER TABLE projects
    ADD COLUMN feedback_deadline_at DATETIME NULL AFTER end_at;

CREATE INDEX idx_projects_feedback_deadline ON projects(feedback_deadline_at);
