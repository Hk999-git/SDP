package com.hari.aiprojectmanager;

import org.springframework.data.jpa.repository.JpaRepository;

// ADDED: Provides database operations for Requirement records.
public interface RequirementRepository
        extends JpaRepository<Requirement, Long> {
}