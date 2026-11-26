package com.hari.aiprojectmanager;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

// ADDED: Database operations for epics, stories, and tasks.
public interface WorkItemRepository
        extends JpaRepository<WorkItem, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<WorkItem> findForUpdateById(Long id);

    List<WorkItem> findByTypeAndAssigneeOrderByIdAsc(WorkItem.Type type, TeamMember assignee);

    List<WorkItem> findByRequirement_IdAndTypeAndAssigneeOrderByIdAsc(
            Long requirementId, WorkItem.Type type, TeamMember assignee);

    List<WorkItem> findByRequirement_IdAndTypeOrderByIdAsc(Long requirementId, WorkItem.Type type);

    @Query("""
            select item.id from WorkItem item
            where item.type = :type and item.status <> :done
              and item.dueDate < :today and item.assignee is not null
            """)
    List<Long> findOverdueIds(WorkItem.Type type, WorkItem.Status done, LocalDate today);

    // ADDED: Get all work items for a business requirement.
    List<WorkItem> findByRequirement_IdOrderByIdAsc(
            Long requirementId
    );

    // ADDED: Get children of an epic or story.
    List<WorkItem> findByParent_IdOrderByIdAsc(
            Long parentId
    );
}
