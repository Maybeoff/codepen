CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    html TEXT DEFAULT '',
    css TEXT DEFAULT '',
    js TEXT DEFAULT '',
    library TEXT DEFAULT '',
    projectName TEXT DEFAULT 'Untitled Project',
    tags TEXT DEFAULT '',
    views INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_createdAt ON projects(createdAt);
CREATE INDEX IF NOT EXISTS idx_projects_projectName ON projects(projectName);
