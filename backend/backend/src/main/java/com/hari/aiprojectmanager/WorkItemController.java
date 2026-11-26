package com.hari.aiprojectmanager;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import static com.hari.aiprojectmanager.WorkspaceAccount.SESSION_KEY;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/work-items")
public class WorkItemController {

    private static final int COMMENT_PAGE_SIZE = 10;

    private final WorkItemRepository workItemRepository;
    private final RequirementRepository requirementRepository;
    private final TaskCommentRepository taskCommentRepository;
    private final TaskStatusChangeRepository taskStatusChanges;
    private final TaskNotifications notifications;

    public WorkItemController(
            WorkItemRepository workItemRepository,
            RequirementRepository requirementRepository,
            TaskCommentRepository taskCommentRepository,
            TaskStatusChangeRepository taskStatusChanges,
            TaskNotifications notifications) {

        this.workItemRepository = workItemRepository;
        this.requirementRepository = requirementRepository;
        this.taskCommentRepository = taskCommentRepository;
        this.taskStatusChanges = taskStatusChanges;
        this.notifications = notifications;
    }

    // ADDED: Data received when creating a work item.
    public record CreateWorkItemRequest(
            String title,
            String description,
            WorkItem.Type type,
            WorkItem.Priority priority,
            Long requirementId,
            Long parentId
    ) {}

    // ADDED: Return IDs instead of nested entities.
    // This avoids recursive parent objects in JSON.
    public record WorkItemResponse(
            Long id,
            String title,
            String description,
            WorkItem.Type type,
            WorkItem.Status status,
            WorkItem.Priority priority,
            Long requirementId,
            Long parentId,
            TeamMember assignee,
            String assigneeName,
            TeamMember contributor,
            String contributorName,
            Instant createdAt,
            LocalDate dueDate,
            BigDecimal estimatedHours,
            Integer storyPoints,
            long commentCount
    ) {}

    public record AssigneeRequest(TeamMember assignee) {}
    public record ContributorRequest(TeamMember contributor) {}

    public record StatusRequest(WorkItem.Status status, TeamMember completedBy) {}
    public record StatusActivity(Long taskId, WorkItem.Status previousStatus,
                                 WorkItem.Status status, TeamMember completedBy, Instant changedAt) {}

    public record TaskDetailsRequest(String description, LocalDate dueDate, BigDecimal estimatedHours) {}
    public record TaskCommentRequest(String body) {}
    public record TaskCommentResponse(Long id, TeamMember author, String authorName, String body,
                                      Instant createdAt, long commentCount) {}
    public record DashboardComment(Long id, Long taskId, String taskTitle, String authorName,
                                   String body, Instant createdAt) {}
    public record DashboardComments(List<DashboardComment> comments, Long nextBeforeId) {}

    @GetMapping("/recent-comments")
    @Transactional(readOnly = true)
    public DashboardComments recentComments(@RequestParam(required = false) Long beforeId,
                                            @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {
        var entries = taskCommentRepository.findRecentComments(account.isManager(), account.member(),
                beforeId, PageRequest.of(0, COMMENT_PAGE_SIZE + 1));
        var comments = entries.stream().limit(COMMENT_PAGE_SIZE)
                .map(comment -> new DashboardComment(comment.id(), comment.task().getId(), comment.task().getTitle(),
                        comment.author().profile().name(), comment.body(), comment.createdAt()))
                .toList();
        Long nextBeforeId = entries.size() > COMMENT_PAGE_SIZE ? comments.getLast().id() : null;
        return new DashboardComments(comments, nextBeforeId);
    }

    @GetMapping("/status-history")
    @Transactional(readOnly = true)
    public List<StatusActivity> statusHistory(@SessionAttribute(SESSION_KEY) WorkspaceAccount account) {
        account.requireManager();
        return taskStatusChanges.findAllByOrderByIdAsc().stream()
                .map(change -> new StatusActivity(change.taskId(), change.previousStatus(),
                        change.status(), change.completedBy(), change.changedAt()))
                .toList();
    }

    @PutMapping("/{id}/details")
    @Transactional
    public WorkItemResponse updateDetails(@PathVariable Long id, @RequestBody TaskDetailsRequest request, @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {
        LocalDate dueDate = request.dueDate();
        if (dueDate != null && (dueDate.getYear() < 1000 || dueDate.getYear() > 9999)) {
            throw badRequest("Choose a due date between years 1000 and 9999.");
        }
        BigDecimal hours = request.estimatedHours();
        if (hours != null && (hours.signum() < 0 || hours.compareTo(new BigDecimal("999999.99")) > 0
                || hours.stripTrailingZeros().scale() > 2)) {
            throw badRequest("Estimated effort must be 0 to 999999.99 hours with at most two decimal places.");
        }
        WorkItem task = taskForUpdate(id);
        account.requireTaskAccess(task);
        task.updateDetails(request.description(), dueDate, hours);
        return toResponse(task);
    }

    @GetMapping("/{id}/comments")
    @Transactional(readOnly = true)
    public List<TaskCommentResponse> comments(@PathVariable Long id, @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {
        account.requireTaskAccess(requireTask(workItemRepository.findById(id)));
        var comments = taskCommentRepository.findByTask_IdOrderByIdAsc(id);
        return comments.stream()
                .map(comment -> toCommentResponse(comment, comments.size()))
                .toList();
    }

    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public TaskCommentResponse addComment(@PathVariable Long id, @RequestBody TaskCommentRequest request, @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {
        if (request.body() == null || request.body().isBlank()) {
            throw badRequest("Enter a comment.");
        }
        WorkItem task = taskForUpdate(id);
        account.requireTaskAccess(task);
        TeamMember author = account.isManager() ? TeamMember.MANAGER : account.member();
        TaskComment comment = taskCommentRepository.save(new TaskComment(task, author, request.body().trim()));
        notifications.queueComment(task, comment);
        return toCommentResponse(comment, taskCommentRepository.countByTask_Id(id));
    }

    private TaskCommentResponse toCommentResponse(TaskComment comment, long count) {
        return new TaskCommentResponse(comment.id(), comment.author(), comment.author().profile().name(),
                comment.body(), comment.createdAt(), count);
    }

    @GetMapping("/team-members")
    public List<TeamMember.Profile> teamMembers(@SessionAttribute(SESSION_KEY) WorkspaceAccount account) {
        account.requireManager();
        return TeamMember.roster();
    }

    // TEAM ASSIGNMENT: Managers can move a saved task to any member of the roster.
    @PatchMapping("/{id}/assignee")
    @Transactional
    public WorkItemResponse changeAssignee(@PathVariable Long id, @RequestBody AssigneeRequest request, @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {
        account.requireManager();
        if (request.assignee() == null || request.assignee() == TeamMember.MANAGER) {
            throw badRequest("Choose a team member.");
        }
        WorkItem task = taskForUpdate(id);
        account.requireTaskAccess(task);
        task.setAssignee(request.assignee());
        return toResponse(task);
    }

    @PatchMapping("/{id}/contributor")
    @Transactional
    public WorkItemResponse changeContributor(@PathVariable Long id, @RequestBody ContributorRequest request,
                                              @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {
        account.requireManager();
        WorkItem task = taskForUpdate(id);
        TeamMember contributor = request.contributor();
        if (contributor == TeamMember.MANAGER || (contributor != null && contributor == task.getAssignee())) {
            throw badRequest("Choose a team member other than the assignee.");
        }
        task.setContributor(contributor);
        return toResponse(task);
    }

    // TASK STATUS: Save the selected status using the existing work_items status column.
    @PatchMapping("/{id}/status")
    @Transactional
    public WorkItemResponse changeStatus(@PathVariable Long id, @RequestBody StatusRequest request, @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {
        if (request.status() == null) {
            throw badRequest("Choose a task status.");
        }
        WorkItem task = taskForUpdate(id);
        account.requireTaskAccess(task);
        if (task.getStatus() != request.status()) {
            TeamMember completedBy = request.status() == WorkItem.Status.DONE
                    ? (account.isManager()
                        ? (request.completedBy() != null ? request.completedBy() : task.getAssignee())
                        : account.member())
                    : null;
            taskStatusChanges.save(new TaskStatusChange(task, request.status(), completedBy));
            task.setStatus(request.status());
        }
        return toResponse(task);
    }

    // Serialize updates to the same row so status and assignee changes can overlap safely.
    private WorkItem taskForUpdate(Long id) {
        return requireTask(workItemRepository.findForUpdateById(id));
    }

    private WorkItem requireTask(Optional<WorkItem> item) {
        WorkItem task = item
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Work item not found."));
        if (task.getType() != WorkItem.Type.TASK) {
            throw badRequest("Only tasks can be updated on the board.");
        }
        return task;
    }

    // ADDED: Create an epic, story, or task.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public WorkItemResponse create(
            @RequestBody CreateWorkItemRequest request, @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {

        if (request.title() == null
                || request.title().isBlank()
                || request.type() == null
                || request.requirementId() == null) {

            throw badRequest(
                    "Title, type, and requirementId are required."
            );
        }

        if (!account.isManager() && request.type() != WorkItem.Type.TASK) {
            account.requireManager();
        }
        validateTitle(request.title());

        Requirement requirement = requirementRepository
                .findById(request.requirementId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Requirement not found."
                ));

        WorkItem parent = null;

        // ADDED: Epics must have no parent.
        if (request.type() == WorkItem.Type.EPIC) {
            if (request.parentId() != null) {
                throw badRequest("An epic cannot have a parent.");
            }
        } else {
            // ADDED: Stories and tasks require a parent.
            if (request.parentId() == null) {
                throw badRequest(
                        "A story or task must have a parent."
                );
            }

            parent = workItemRepository
                    .findById(request.parentId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Parent work item not found."
                    ));

            // ADDED: Parent and child must share a requirement.
            if (!parent.getRequirement().getId()
                    .equals(requirement.getId())) {

                throw badRequest(
                        "Parent must belong to the same requirement."
                );
            }

            // ADDED: Enforce Epic → Story → Task.
            if (request.type() == WorkItem.Type.STORY
                    && parent.getType() != WorkItem.Type.EPIC) {

                throw badRequest(
                        "A story must belong to an epic."
                );
            }

            if (request.type() == WorkItem.Type.TASK
                    && parent.getType() != WorkItem.Type.STORY) {

                throw badRequest(
                        "A task must belong to a story."
                );
            }
        }

        return toResponse(persistItem(requirement, parent, request.type(), request.title(),
                request.description(), request.priority(), account.member()));
    }

    public record DraftRequest(UUID saveId, Long requirementId, String projectName,
                               String requirement, List<DraftEpic> epics,
                               List<String> clarificationQuestions) {}

    public record DraftEpic(String title, List<DraftStory> stories) {}

    public record DraftStory(String title, String description, List<String> acceptanceCriteria,
                             List<DraftTask> tasks) {}

    public record DraftTask(String title, TeamMember.Role requiredRole, String requiredSkill, String description) {}

    public record SavedDraft(Requirement requirement, List<WorkItemResponse> workItems) {}

    // SAVE DRAFT: Persist the reviewed hierarchy and its requirement in one transaction.
    @PostMapping("/draft")
    @Transactional
    public SavedDraft saveDraft(@RequestBody DraftRequest request, @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {
        account.requireManager();
        if (request.saveId() == null || request.projectName() == null
                || request.projectName().isBlank() || request.projectName().trim().length() > 255
                || request.requirement() == null || request.requirement().isBlank()
                || request.epics() == null || request.epics().isEmpty()) {
            throw badRequest("A save ID, project name (up to 255 characters), requirement, and epic are required.");
        }

        String saveId = request.saveId().toString();
        Requirement requirement = request.requirementId() == null
                ? requirementRepository.findByDraftSaveId(saveId).orElse(null)
                : requirementRepository.findForUpdateById(request.requirementId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Requirement not found."));

        if (requirement == null) {
            requirement = new Requirement();
            requirement.setProjectName(request.projectName().trim());
            requirement.setDescription(request.requirement().trim());
        } else {
            if (!requirement.getProjectName().equals(request.projectName().trim())
                    || !requirement.getDescription().equals(request.requirement().trim())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "The draft does not match the saved requirement.");
            }
            if (saveId.equals(requirement.draftSaveId())) {
                return new SavedDraft(requirement, getAll(requirement.getId(), account));
            }
            if (requirement.draftSaveId() != null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This requirement already has a saved draft.");
            }
        }

        requirement.recordDraftSave(saveId, formatLines(request.clarificationQuestions()));
        try {
            requirement = requirementRepository.saveAndFlush(requirement);
        } catch (DataIntegrityViolationException error) {
            // The unique save ID prevents duplicate writes when two copies of a request overlap.
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Draft save conflicted. Retry the same draft.");
        }

        List<WorkItemResponse> items = new ArrayList<>();
        var assignment = new TeamMember.Assignment();
        for (DraftEpic epic : request.epics()) {
            if (epic == null || epic.stories() == null) {
                throw badRequest("Every epic must include a story list.");
            }
            WorkItem epicItem = persistItem(requirement, null, WorkItem.Type.EPIC, epic.title(), null, null, null);
            items.add(toResponse(epicItem));
            for (DraftStory story : epic.stories()) {
                if (story == null) {
                    throw badRequest("A draft story cannot be empty.");
                }
                String description = story.description() == null ? "" : story.description().trim();
                String criteria = formatLines(story.acceptanceCriteria());
                if (!criteria.isEmpty()) {
                    description = (description.isEmpty() ? "" : description + "\n\n")
                            + "Acceptance criteria\n" + criteria;
                }
                WorkItem storyItem = persistItem(requirement, epicItem, WorkItem.Type.STORY,
                        story.title(), description, null, null);
                items.add(toResponse(storyItem));
                if (story.tasks() != null) {
                    for (DraftTask task : story.tasks()) {
                        if (task == null) {
                            throw badRequest("A draft task cannot be empty.");
                        }
                        var assignee = assignment.next(task.requiredRole(), task.requiredSkill(), task.title());
                        var taskItem = persistItem(requirement, storyItem, WorkItem.Type.TASK,
                                task.title(), task.description(), null, assignee);
                        items.add(toResponse(taskItem, 0));
                    }
                }
            }
        }
        return new SavedDraft(requirement, items);
    }

    private String formatLines(List<String> lines) {
        if (lines == null) {
            return "";
        }
        return String.join("\n", lines.stream()
                .filter(line -> line != null && !line.isBlank())
                .map(line -> "- " + line.trim())
                .toList());
    }

    private WorkItem persistItem(Requirement requirement, WorkItem parent, WorkItem.Type type,
                                 String title, String description, WorkItem.Priority priority, TeamMember assignee) {
        validateTitle(title);
        WorkItem item = new WorkItem();
        item.setTitle(title.trim());
        item.setDescription(description);
        item.setType(type);
        item.setRequirement(requirement);
        item.setParent(parent);
        item.setAssignee(assignee);
        if (priority != null) {
            item.setPriority(priority);
        }
        return workItemRepository.save(item);
    }

    private void validateTitle(String title) {
        if (title == null || title.isBlank() || title.trim().length() > 255) {
            throw badRequest("Each work item needs a title of 1 to 255 characters.");
        }
    }

    // ADDED: List all work items, or filter by requirement.
    // GET /api/work-items
    // GET /api/work-items?requirementId=1
    @GetMapping
    @Transactional(readOnly = true)
    public List<WorkItemResponse> getAll(
            @RequestParam(
                    name = "requirementId",
                    required = false
            ) Long requirementId, @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {

        List<WorkItem> items;

        if (!account.isManager()) {
            items = workItemRepository.findMemberTasks(requirementId, WorkItem.Type.TASK, account.member());
        } else if (requirementId == null) {
            items = workItemRepository.findAll();
        } else {
            items = workItemRepository
                    .findByRequirement_IdOrderByIdAsc(requirementId);
        }

        var counts = new HashMap<Long, Long>();
        var taskIds = items.stream().filter(item -> item.getType() == WorkItem.Type.TASK)
                .map(WorkItem::getId).toList();
        if (!taskIds.isEmpty()) {
            taskCommentRepository.countForTasks(taskIds)
                    .forEach(count -> counts.put(count.getTaskId(), count.getTotal()));
        }
        return items.stream()
                .map(item -> toResponse(item, counts.getOrDefault(item.getId(), 0L)))
                .toList();
    }

    public record TaskParent(Long id, String title) {}

    @GetMapping("/task-parents")
    @Transactional(readOnly = true)
    public List<TaskParent> taskParents(@RequestParam Long requirementId) {
        return workItemRepository.findByRequirement_IdAndTypeOrderByIdAsc(requirementId, WorkItem.Type.STORY)
                .stream()
                .map(item -> new TaskParent(item.getId(), item.getTitle()))
                .toList();
    }

    // ADDED: Convert the entity into a dashboard response.
    private WorkItemResponse toResponse(WorkItem item) {
        return toResponse(item, item.getType() == WorkItem.Type.TASK
                ? taskCommentRepository.countByTask_Id(item.getId()) : 0);
    }

    private WorkItemResponse toResponse(WorkItem item, long commentCount) {
        return new WorkItemResponse(
                item.getId(),
                item.getTitle(),
                item.getDescription(),
                item.getType(),
                item.getStatus(),
                item.getPriority(),
                item.getRequirement().getId(),
                item.getParent() == null
                        ? null
                        : item.getParent().getId(),
                item.getAssignee(),
                memberName(item.getAssignee()),
                item.getContributor(),
                memberName(item.getContributor()),
                item.getCreatedAt(),
                item.getDueDate(),
                item.getEstimatedHours(),
                item.getStoryPoints(),
                commentCount
        );
    }

    private String memberName(TeamMember member) {
        return member == null ? null : member.profile().name();
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }
}
