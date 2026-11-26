package com.hari.aiprojectmanager;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static com.hari.aiprojectmanager.WorkspaceAccount.SESSION_KEY;

@RestController
@RequestMapping("/api/requirements")
public class RequirementController {

    private final AiRequirementService aiRequirementService;

    // ADDED: Repository for saving requirements in MySQL.
    private final RequirementRepository requirementRepository;

    // CHANGED: Inject both the AI service and database repository.
    public RequirementController(
            AiRequirementService aiRequirementService,
            RequirementRepository requirementRepository) {

        this.aiRequirementService = aiRequirementService;
        this.requirementRepository = requirementRepository;
    }

    public record RequirementRequest(
            String projectName,
            String requirement
    ) {}

    public record RequirementResponse(
            String message,
            String projectName,
            String requirement
    ) {}

    public record AnalysisResponse(
            String projectName,
            String analysis
    ) {}

    // ADDED: Save a requirement in MySQL.
    // Endpoint: POST /api/requirements
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Requirement save(
            @RequestBody RequirementRequest request, @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {

        account.requireManager();

        validate(request);

        Requirement requirement = new Requirement();
        requirement.setProjectName(request.projectName().trim());
        requirement.setDescription(request.requirement().trim());

        return requirementRepository.save(requirement);
    }

    @PostMapping("/preview")
    public RequirementResponse preview(
            @RequestBody RequirementRequest request, @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {

        account.requireManager();

        validate(request);

        return new RequirementResponse(
                "Requirement received by the backend!",
                request.projectName(),
                request.requirement()
        );
    }

    @PostMapping("/analyze")
    public AnalysisResponse analyze(
            @RequestBody RequirementRequest request, @SessionAttribute(SESSION_KEY) WorkspaceAccount account) {

        account.requireManager();

        validate(request);

        String analysis = aiRequirementService.analyze(
                request.projectName(),
                request.requirement()
        );

        return new AnalysisResponse(
                request.projectName(),
                analysis
        );
    }
    // ADDED: Retrieve saved requirements, newest first.
// Endpoint: GET /api/requirements
    @GetMapping
    public List<Requirement> getAll() {
        return requirementRepository.findAll(
                org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC,
                        "id"
                )
        );
    }
    // CHANGED: Shared validation for save, preview, and analyze.
    private void validate(RequirementRequest request) {

        if (request.projectName() == null
                || request.projectName().isBlank()
                || request.requirement() == null
                || request.requirement().isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Project name and requirement are required"
            );
        }
    }
}