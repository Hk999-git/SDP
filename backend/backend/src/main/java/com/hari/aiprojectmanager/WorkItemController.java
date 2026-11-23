package com.hari.aiprojectmanager;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/work-items")
@CrossOrigin(origins = "http://localhost:5173")
public class WorkItemController {

    private final WorkItemRepository workItemRepository;
    private final RequirementRepository requirementRepository;

    public WorkItemController(
            WorkItemRepository workItemRepository,
            RequirementRepository requirementRepository) {

        this.workItemRepository = workItemRepository;
        this.requirementRepository = requirementRepository;
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
            Long parentId
    ) {}

    // ADDED: Create an epic, story, or task.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public WorkItemResponse create(
            @RequestBody CreateWorkItemRequest request) {

        if (request.title() == null
                || request.title().isBlank()
                || request.type() == null
                || request.requirementId() == null) {

            throw badRequest(
                    "Title, type, and requirementId are required."
            );
        }

        if (request.title().trim().length() > 255) {
            throw badRequest(
                    "Title must contain no more than 255 characters."
            );
        }

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

        WorkItem item = new WorkItem();
        item.setTitle(request.title().trim());
        item.setDescription(request.description());
        item.setType(request.type());
        item.setRequirement(requirement);
        item.setParent(parent);

        // Use the entity's MEDIUM default if priority is omitted.
        if (request.priority() != null) {
            item.setPriority(request.priority());
        }

        return toResponse(workItemRepository.save(item));
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
            ) Long requirementId) {

        List<WorkItem> items;

        if (requirementId == null) {
            items = workItemRepository.findAll();
        } else {
            items = workItemRepository
                    .findByRequirement_IdOrderByIdAsc(requirementId);
        }

        return items.stream()
                .map(this::toResponse)
                .toList();
    }

    // ADDED: Convert the entity into a dashboard response.
    private WorkItemResponse toResponse(WorkItem item) {
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
                        : item.getParent().getId()
        );
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }
}