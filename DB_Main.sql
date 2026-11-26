USE ai_project_manager;

SELECT id, project_name, description
FROM requirements
ORDER BY id DESC
LIMIT 10;

SELECT id, requirement_id, parent_id, type, title, status, description
FROM work_items
ORDER BY id DESC
LIMIT 30;

SHOW COLUMNS FROM ai_project_manager.work_items LIKE 'assignee';

SELECT id, requirement_id, title, assignee, status
FROM ai_project_manager.work_items
WHERE type = 'TASK'
ORDER BY id DESC;