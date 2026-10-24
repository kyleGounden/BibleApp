CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  google_sub VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  picture VARCHAR(512) NULL,
  password_hash VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_google (google_sub),
  UNIQUE KEY uniq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS churches (
  id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  city VARCHAR(120) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  invite_code VARCHAR(12) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_churches_invite (invite_code),
  CONSTRAINT fk_churches_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS memberships (
  user_id CHAR(36) NOT NULL,
  church_id CHAR(36) NOT NULL,
  role ENUM('pastor', 'member') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_memberships_church (church_id),
  CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_memberships_church FOREIGN KEY (church_id) REFERENCES churches (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sermons (
  id CHAR(36) NOT NULL,
  church_id CHAR(36) NOT NULL,
  author_id CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  passage VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  sermon_date DATE NOT NULL,
  status VARCHAR(8) NOT NULL DEFAULT 'ended',
  current_step INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sermons_church_date (church_id, sermon_date),
  CONSTRAINT fk_sermons_church FOREIGN KEY (church_id) REFERENCES churches (id),
  CONSTRAINT fk_sermons_author FOREIGN KEY (author_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sermon_steps (
  id CHAR(36) NOT NULL,
  sermon_id CHAR(36) NOT NULL,
  position INT NOT NULL,
  heading VARCHAR(160) NOT NULL,
  passage VARCHAR(40) NOT NULL,
  note TEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sermon_steps_sermon (sermon_id, position),
  CONSTRAINT fk_steps_sermon FOREIGN KEY (sermon_id) REFERENCES sermons (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shared_notes (
  id CHAR(36) NOT NULL,
  church_id CHAR(36) NOT NULL,
  author_id CHAR(36) NOT NULL,
  verse_id VARCHAR(32) NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_shared_note (church_id, author_id, verse_id),
  CONSTRAINT fk_notes_church FOREIGN KEY (church_id) REFERENCES churches (id),
  CONSTRAINT fk_notes_author FOREIGN KEY (author_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_refresh_hash (token_hash),
  KEY idx_refresh_user (user_id),
  KEY idx_refresh_expires (expires_at),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
