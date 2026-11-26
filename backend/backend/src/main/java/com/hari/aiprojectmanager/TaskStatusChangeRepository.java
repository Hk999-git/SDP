package com.hari.aiprojectmanager;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

interface TaskStatusChangeRepository extends JpaRepository<TaskStatusChange, Long> {
    List<TaskStatusChange> findAllByOrderByIdAsc();
    List<TaskStatusChange> findByTask_IdOrderByIdDesc(Long taskId);
}
