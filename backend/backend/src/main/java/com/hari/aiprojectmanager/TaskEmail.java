package com.hari.aiprojectmanager;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "task_email_outbox")
class TaskEmail {
    enum Kind { COMMENT, OVERDUE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String eventKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Kind kind;

    @Column(nullable = false)
    private Long taskId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TeamMember recipient;

    @Column(nullable = false)
    private String taskTitle;

    private String commentAuthor;
    private LocalDate dueDate;

    @Column(nullable = false)
    private Instant nextAttemptAt;

    private Instant sentAt;

    protected TaskEmail() {}

    TaskEmail(String eventKey, Kind kind, WorkItem task, String commentAuthor, LocalDate dueDate) {
        this.eventKey = eventKey;
        this.kind = kind;
        this.taskId = task.getId();
        this.recipient = task.getAssignee();
        this.taskTitle = task.getTitle();
        this.commentAuthor = commentAuthor;
        this.dueDate = dueDate;
        this.nextAttemptAt = Instant.now();
    }

    Long id() { return id; }
    Kind kind() { return kind; }
    Long taskId() { return taskId; }
    TeamMember recipient() { return recipient; }
    String taskTitle() { return taskTitle; }
    String commentAuthor() { return commentAuthor; }
    LocalDate dueDate() { return dueDate; }

    boolean readyAt(Instant now) {
        return sentAt == null && !nextAttemptAt.isAfter(now);
    }

    void retryAt(Instant nextAttemptAt) {
        this.nextAttemptAt = nextAttemptAt;
    }

    void markSent(Instant sentAt) {
        this.sentAt = sentAt;
    }
}
