package com.hari.aiprojectmanager;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

// ADDED: Provides database operations for Requirement records.
public interface RequirementRepository
        extends JpaRepository<Requirement, Long> {
    Optional<Requirement> findByDraftSaveId(String draftSaveId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Requirement> findForUpdateById(Long id);
}
