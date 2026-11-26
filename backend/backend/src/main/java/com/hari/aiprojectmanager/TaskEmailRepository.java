package com.hari.aiprojectmanager;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

interface TaskEmailRepository extends JpaRepository<TaskEmail, Long> {
    boolean existsByEventKey(String eventKey);

    @Query("""
            select email.id from TaskEmail email
            where email.sentAt is null and email.nextAttemptAt <= :now
            order by email.id
            """)
    List<Long> findReadyIds(Instant now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<TaskEmail> findForUpdateById(Long id);
}
