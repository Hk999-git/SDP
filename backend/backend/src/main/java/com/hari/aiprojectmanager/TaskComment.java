package com.hari.aiprojectmanager;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "task_comments", indexes = @Index(name = "idx_task_comments_task", columnList = "task_id"))
class TaskComment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private WorkItem task;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TeamMember author;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String body;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected TaskComment() {}

    TaskComment(WorkItem task, TeamMember author, String body) {
        this.task = task;
        this.author = author;
        this.body = body;
        this.createdAt = Instant.now();
    }

    Long id() { return id; }
    TeamMember author() { return author; }
    String body() { return body; }
    Instant createdAt() { return createdAt; }
}
