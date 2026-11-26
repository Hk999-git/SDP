package com.hari.aiprojectmanager;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Collection;
import java.util.List;

interface TaskCommentRepository extends JpaRepository<TaskComment, Long> {
    List<TaskComment> findByTask_IdOrderByIdAsc(Long taskId);

    long countByTask_Id(Long taskId);

    @Query("""
            select comment from TaskComment comment join fetch comment.task task
            where (:beforeId is null or comment.id < :beforeId)
              and (:manager = true or task.assignee = :member or task.contributor = :member)
            order by comment.id desc
            """)
    List<TaskComment> findRecentComments(boolean manager, TeamMember member, Long beforeId, Pageable limit);

    interface TaskCommentCount {
        Long getTaskId();
        long getTotal();
    }

    @Query("""
            select comment.task.id as taskId, count(comment) as total
            from TaskComment comment
            where comment.task.id in :ids
            group by comment.task.id
            """)
    List<TaskCommentCount> countForTasks(Collection<Long> ids);
}
