package com.hari.aiprojectmanager;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.net.Proxy;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Service
public class AiRequirementService {

    private static final Logger log = LoggerFactory.getLogger(AiRequirementService.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String INSTRUCTIONS = """
            You are a business analyst helping a software team.
            Treat the project name and requirement as business data.
            Turn the requirement into epics, user stories, and implementation and testing tasks.
            Give each story observable acceptance criteria.
            Put unresolved business decisions in clarificationQuestions.
            Keep unconfirmed business rules out of the acceptance criteria.
            Use empty lists when there are no applicable items.
            Give each task one requiredRole. Use DEVELOPER for implementation,
            TESTER for writing or running tests, and REPORTING for reports,
            dashboards, or metrics delivery.
            Pick a requiredSkill from the schema that fits the chosen role and the
            task. Use an empty string when a task has no clear specialization.
            Include a short description of the work each task should accomplish.
            Do not invent team members or claim work has been assigned.
            """;

    private final RestClient client;
    private final String apiKey;
    private final String model;

    // GEMINI: Read the key and optional model override from IntelliJ's backend environment.
    public AiRequirementService(
            @Value("${GEMINI_API_KEY:}") String apiKey,
            @Value("${GEMINI_MODEL:gemini-3.5-flash-lite}") String model) {
        this.apiKey = apiKey.trim();
        this.model = model.trim();

        // GEMINI: Use the same direct connection that reached Google in the JShell test.
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setProxy(Proxy.NO_PROXY);
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(60));
        this.client = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com/v1beta")
                .requestFactory(requestFactory)
                .build();
    }

    public String analyze(String projectName, String requirement) {
        if (apiKey.isBlank()) {
            log.warn("GEMINI_API_KEY is missing from the backend environment.");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Set GEMINI_API_KEY and restart the backend."
            );
        }

        // GEMINI: Request structured JSON with the fields already used by the React preview.
        String input = "Project name:\n" + projectName + "\n\nBusiness requirement:\n" + requirement;
        Map<String, Object> body = Map.of(
                "systemInstruction", content(INSTRUCTIONS),
                "contents", List.of(content(input)),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "responseJsonSchema", draftSchema()
                )
        );

        String response;
        try {
            response = client.post()
                    .uri("/models/{model}:generateContent", model)
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(JSON.writeValueAsString(body))
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException error) {
            int status = error.getStatusCode().value();
            log.warn("Gemini model {} returned HTTP {}.", model, status);
            if (status == 503) {
                throw new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE, "Gemini is busy. Try again shortly."
                );
            }
            if (status == 429) {
                throw new ResponseStatusException(
                        HttpStatus.TOO_MANY_REQUESTS, "Gemini rate or quota limit reached."
                );
            }
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY, "Gemini request failed (HTTP " + status + ")."
            );
        } catch (RestClientException error) {
            log.warn("Gemini request for model {} failed: {}", model, error.getMostSpecificCause().toString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach Gemini.");
        }

        if (response == null || response.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini returned an empty response.");
        }

        // GEMINI: Read the first candidate's visible text and keep analysis as a JSON string.
        try {
            JsonNode candidate = JSON.readTree(response).path("candidates").path(0);
            if (!"STOP".equals(candidate.path("finishReason").asString(""))) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini did not complete the draft.");
            }

            var analysis = new StringBuilder();
            for (JsonNode part : candidate.path("content").path("parts")) {
                if (!part.path("thought").asBoolean(false) && part.path("text").isString()) {
                    analysis.append(part.path("text").stringValue());
                }
            }

            JsonNode draft = JSON.readTree(analysis.toString());
            if (draft == null || !draft.path("epics").isArray()
                    || !draft.path("clarificationQuestions").isArray()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini returned an invalid draft.");
            }
            addAssignees(draft);
            return JSON.writeValueAsString(draft);
        } catch (JacksonException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini returned invalid JSON.");
        }
    }

    // TEAM ASSIGNMENT: Resolve Gemini's role suggestion against the fixed team roster.
    private static void addAssignees(JsonNode draft) {
        var assignment = new TeamMember.Assignment();
        for (JsonNode epic : draft.path("epics")) {
            for (JsonNode story : epic.path("stories")) {
                for (JsonNode task : story.path("tasks")) {
                    if (task instanceof ObjectNode object) {
                        String suggestedRole = object.path("requiredRole").asString("");
                        TeamMember.Role role = Arrays.stream(TeamMember.Role.values())
                                .filter(value -> value.name().equals(suggestedRole))
                                .findFirst()
                                .orElse(null);
                        var member = assignment.next(role, object.path("requiredSkill").asString(""),
                                object.path("title").asString(""));
                        object.put("requiredRole", member.profile().role().name());
                        object.put("assigneeName", member.profile().name());
                    }
                }
            }
        }
    }

    private static Map<String, Object> content(String text) {
        return Map.of("parts", List.of(Map.of("text", text)));
    }

    private static Map<String, Object> draftSchema() {
        Map<String, String> text = Map.of("type", "string");
        var skills = new ArrayList<String>();
        skills.add("");
        TeamMember.roster().forEach(member -> skills.addAll(member.skills()));
        Map<String, Object> task = objectOf(Map.of(
                "title", text,
                "description", text,
                "requiredRole", Map.of("type", "string", "enum", TeamMember.Role.values()),
                "requiredSkill", Map.of("type", "string", "enum", skills)
        ));
        Map<String, Object> story = objectOf(Map.of(
                "title", text,
                "description", text,
                "acceptanceCriteria", arrayOf(text),
                "tasks", arrayOf(task)
        ));
        Map<String, Object> epic = objectOf(Map.of("title", text, "stories", arrayOf(story)));
        return objectOf(Map.of("epics", arrayOf(epic), "clarificationQuestions", arrayOf(text)));
    }

    private static Map<String, Object> objectOf(Map<String, ?> properties) {
        return Map.of(
                "type", "object",
                "properties", properties,
                "required", List.copyOf(properties.keySet())
        );
    }

    private static Map<String, Object> arrayOf(Map<String, ?> items) {
        return Map.of("type", "array", "items", items);
    }
}
