package com.hari.aiprojectmanager;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "task_status_changes")
class TaskStatusChange {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private WorkItem task;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WorkItem.Status previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WorkItem.Status status;

    @Enumerated(EnumType.STRING)
    private TeamMember completedBy;

    @Column(nullable = false, updatable = false)
    private Instant changedAt;

    protected TaskStatusChange() {}

    TaskStatusChange(WorkItem task, WorkItem.Status status, TeamMember completedBy) {
        this.task = task;
        this.previousStatus = task.getStatus();
        this.status = status;
        this.completedBy = completedBy;
        this.changedAt = Instant.now();
    }

    Long taskId() { return task.getId(); }
    WorkItem.Status previousStatus() { return previousStatus; }
    WorkItem.Status status() { return status; }
    TeamMember completedBy() { return completedBy; }
    Instant changedAt() { return changedAt; }
}
