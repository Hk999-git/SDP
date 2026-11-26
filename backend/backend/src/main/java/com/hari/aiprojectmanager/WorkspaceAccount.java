package com.hari.aiprojectmanager;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

record WorkspaceAccount(String username, String name, TeamMember member) {
    static final String SESSION_KEY = "workspaceAccount";

    boolean isManager() {
        return member == null;
    }

    void requireManager() {
        if (!isManager()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This action requires a project manager.");
        }
    }

    void requireTaskAccess(WorkItem task) {
        if (!isManager() && task.getAssignee() != member) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found.");
        }
    }
}
