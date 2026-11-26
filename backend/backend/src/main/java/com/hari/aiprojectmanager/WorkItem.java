package com.hari.aiprojectmanager;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "work_items")
public class WorkItem {

    // ADDED: Supported work-package types.
    public enum Type {
        EPIC,
        STORY,
        TASK
    }

    // ADDED: Dashboard workflow statuses.
    public enum Status {
        TO_DO,
        IN_PROGRESS,
        IN_REVIEW,
        DONE
    }

    public enum Priority {
        LOW,
        MEDIUM,
        HIGH
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "LONGTEXT")
    private String description;

    // TASK DETAILS: Nullable for work items created before creation dates were tracked.
    @Column(updatable = false)
    private Instant createdAt;

    private LocalDate dueDate;

    @Column(precision = 8, scale = 2)
    private BigDecimal estimatedHours;

    private Integer storyPoints;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.TO_DO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Priority priority = Priority.MEDIUM;

    // TEAM ASSIGNMENT: Existing and manually created tasks can start unassigned.
    @Enumerated(EnumType.STRING)
    @Column(name = "assignee")
    private TeamMember assignee;

    @Enumerated(EnumType.STRING)
    private TeamMember contributor;

    // ADDED: Original business requirement behind this work item.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requirement_id", nullable = false)
    private Requirement requirement;

    // ADDED: Story points to an epic; task points to a story.
    // Epics have no parent.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private WorkItem parent;

    public WorkItem() {
    }

    @PrePersist
    private void recordCreationDate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Instant getCreatedAt() { return createdAt; }
    public LocalDate getDueDate() { return dueDate; }
    public BigDecimal getEstimatedHours() { return estimatedHours; }
    public Integer getStoryPoints() { return storyPoints; }

    public void updateDetails(String description, LocalDate dueDate, BigDecimal estimatedHours) {
        this.description = description;
        this.dueDate = dueDate;
        this.estimatedHours = estimatedHours;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Type getType() {
        return type;
    }

    public void setType(Type type) {
        this.type = type;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public Priority getPriority() {
        return priority;
    }

    public void setPriority(Priority priority) {
        this.priority = priority;
    }

    public TeamMember getAssignee() {
        return assignee;
    }

    public void setAssignee(TeamMember assignee) {
        this.assignee = assignee;
        if (contributor == assignee) {
            contributor = null;
        }
    }

    public TeamMember getContributor() {
        return contributor;
    }

    public void setContributor(TeamMember contributor) {
        this.contributor = contributor;
    }

    public Requirement getRequirement() {
        return requirement;
    }

    public void setRequirement(Requirement requirement) {
        this.requirement = requirement;
    }

    public WorkItem getParent() {
        return parent;
    }

    public void setParent(WorkItem parent) {
        this.parent = parent;
    }
}
