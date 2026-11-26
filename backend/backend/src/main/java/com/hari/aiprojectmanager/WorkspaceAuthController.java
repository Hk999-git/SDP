package com.hari.aiprojectmanager;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
class WorkspaceAuthController {
    private final Environment environment;

    WorkspaceAuthController(Environment environment) {
        this.environment = environment;
    }

    record Credentials(String username, String password) {}
    record Profile(String name, String role, TeamMember member) {}

    @PostMapping("/login")
    Profile login(@RequestBody Credentials credentials, HttpServletRequest request) {
        String username = credentials.username() == null ? "" : credentials.username().strip().toLowerCase(Locale.ROOT);
        WorkspaceAccount account = findAccount(username);
        String password = credentials.password();
        String expected = account == null ? null
                : environment.getProperty("APP_PASSWORD_" + account.username().toUpperCase(Locale.ROOT));
        if (expected == null || expected.isBlank() || password == null || !MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8), password.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password.");
        }
        var previous = request.getSession(false);
        if (previous != null) previous.invalidate();
        var session = request.getSession(true);
        session.setAttribute(WorkspaceAccount.SESSION_KEY, account);
        session.setMaxInactiveInterval(3600);
        return profile(account);
    }

    @GetMapping("/session")
    Profile session(@SessionAttribute(WorkspaceAccount.SESSION_KEY) WorkspaceAccount account) {
        return profile(account);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest request) {
        var session = request.getSession(false);
        if (session != null) session.invalidate();
    }

    private Profile profile(WorkspaceAccount account) {
        return new Profile(account.name(), account.isManager() ? "MANAGER" : "MEMBER", account.member());
    }

    private WorkspaceAccount findAccount(String username) {
        if (username.equals("manager")) return new WorkspaceAccount(username, "Project Manager", null);
        for (var member : TeamMember.roster()) {
            if (member.id().name().toLowerCase(Locale.ROOT).equals(username)) {
                return new WorkspaceAccount(username, member.name(), member.id());
            }
        }
        return null;
    }
}
