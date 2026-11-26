package com.hari.aiprojectmanager;

import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

enum TeamMember {
    DEVELOPER_1("Developer 1", Role.DEVELOPER, List.of("Backend APIs", "Databases")),
    DEVELOPER_2("Developer 2", Role.DEVELOPER, List.of("Frontend", "Integration")),
    TESTER_1("Tester 1", Role.TESTER, List.of("Unit testing", "Integration testing")),
    TESTER_2("Tester 2", Role.TESTER, List.of("UI testing", "Regression testing")),
    REPORTING_1("Reporting 1", Role.REPORTING, List.of("Reports", "Dashboards", "Metrics")),
    MANAGER("Project Manager", null, List.of());

    enum Role {
        DEVELOPER, TESTER, REPORTING
    }

    record Profile(TeamMember id, String name, Role role, List<String> skills) {}

    private final Profile profile;

    TeamMember(String name, Role role, List<String> skills) {
        this.profile = new Profile(this, name, role, skills);
    }

    Profile profile() {
        return profile;
    }

    static List<Profile> roster() {
        return Arrays.stream(values()).filter(member -> member != MANAGER).map(TeamMember::profile).toList();
    }

    // Each draft starts with the same order, so the preview and saved tasks agree.
    static final class Assignment {
        private static final Pattern TEST_WORK =
                Pattern.compile("\\b(tests?|testing|qa|regression|test cases?)\\b");
        private static final Pattern REPORTING_WORK =
                Pattern.compile("\\b(reports?|reporting|dashboards?|metrics|analytics)\\b");
        private final EnumMap<TeamMember, Integer> assignedCounts = new EnumMap<>(TeamMember.class);

        TeamMember next(Role role, String skill, String title) {
            Role requiredRole = role == null ? inferRole(title) : role;
            List<TeamMember> matching = Arrays.stream(values())
                    .filter(member -> member.profile.role() == requiredRole)
                    .toList();
            List<TeamMember> specialists = matching.stream()
                    .filter(candidate -> skill != null && candidate.profile.skills().contains(skill))
                    .toList();
            List<TeamMember> candidates = specialists.isEmpty() ? matching : specialists;
            TeamMember member = candidates.stream()
                    .min(Comparator.comparingInt(candidate -> assignedCounts.getOrDefault(candidate, 0)))
                    .orElseThrow();
            assignedCounts.merge(member, 1, Integer::sum);
            return member;
        }

        private static Role inferRole(String title) {
            String text = title == null ? "" : title.toLowerCase(Locale.ROOT);
            if (TEST_WORK.matcher(text).find()) {
                return Role.TESTER;
            }
            if (REPORTING_WORK.matcher(text).find()) {
                return Role.REPORTING;
            }
            return Role.DEVELOPER;
        }
    }
}
