package com.hari.aiprojectmanager;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

// ADDED: Database operations for epics, stories, and tasks.
public interface WorkItemRepository
        extends JpaRepository<WorkItem, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<WorkItem> findForUpdateById(Long id);

    @Query("""
            select item from WorkItem item
            where item.type = :type and (:requirementId is null or item.requirement.id = :requirementId)
              and (item.assignee = :member or item.contributor = :member)
            order by item.id
            """)
    List<WorkItem> findMemberTasks(Long requirementId, WorkItem.Type type, TeamMember member);

    List<WorkItem> findByRequirement_IdAndTypeOrderByIdAsc(Long requirementId, WorkItem.Type type);

    // ADDED: Get all work items for a business requirement.
    List<WorkItem> findByRequirement_IdOrderByIdAsc(
            Long requirementId
    );

    // ADDED: Get children of an epic or story.
    List<WorkItem> findByParent_IdOrderByIdAsc(
            Long parentId
    );
}
