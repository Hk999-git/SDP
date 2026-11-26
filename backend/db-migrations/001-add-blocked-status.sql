-- Run against the existing AI Project Manager database before starting the updated backend.
ALTER TABLE work_items
    MODIFY COLUMN status ENUM('BLOCKED', 'DONE', 'IN_PROGRESS', 'IN_REVIEW', 'TO_DO') NOT NULL;

ALTER TABLE task_status_changes
    MODIFY COLUMN previous_status ENUM('BLOCKED', 'DONE', 'IN_PROGRESS', 'IN_REVIEW', 'TO_DO') NOT NULL,
    MODIFY COLUMN status ENUM('BLOCKED', 'DONE', 'IN_PROGRESS', 'IN_REVIEW', 'TO_DO') NOT NULL;
