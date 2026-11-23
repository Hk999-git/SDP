package com.hari.aiprojectmanager;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

// ADDED: Database operations for epics, stories, and tasks.
public interface WorkItemRepository
        extends JpaRepository<WorkItem, Long> {

    // ADDED: Get all work items for a business requirement.
    List<WorkItem> findByRequirement_IdOrderByIdAsc(
            Long requirementId
    );

    // ADDED: Get children of an epic or story.
    List<WorkItem> findByParent_IdOrderByIdAsc(
            Long parentId
    );
}