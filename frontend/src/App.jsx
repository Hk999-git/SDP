import { useEffect, useState } from "react";
import "./App.css";

const REQUIREMENTS_URL = "http://localhost:8080/api/requirements";
const WORK_ITEMS_URL = "http://localhost:8080/api/work-items";

const fieldStyle = {
  width: "100%",
  padding: "12px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  font: "inherit",
};

const cardStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "12px",
};

// ADDED: Shared request handling.
async function requestJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.detail || body?.message;

    throw new Error(
      message || `Request failed (${response.status}).`
    );
  }

  return response.json();
}

function errorMessage(error) {
  return error instanceof TypeError
    ? "Cannot reach the backend. Check port 8080 and your React address in @CrossOrigin."
    : error.message;
}

function App() {
  const [projectName, setProjectName] = useState("");
  const [requirement, setRequirement] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [requirements, setRequirements] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");

  // ADDED: Work-package data and form state.
  const [workItems, setWorkItems] = useState([]);
  const [selectedRequirementId, setSelectedRequirementId] =
    useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("EPIC");
  const [priority, setPriority] = useState("MEDIUM");
  const [parentId, setParentId] = useState("");
  const [workSaving, setWorkSaving] = useState(false);
  const [workError, setWorkError] = useState("");
  const [workSuccess, setWorkSuccess] = useState("");
  const [reload, setReload] = useState(0);

  // ADDED: Load requirements and work packages together.
  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setListLoading(true);
      setListError("");

      try {
        const [savedRequirements, savedWorkItems] =
          await Promise.all([
            requestJson(REQUIREMENTS_URL, {
              signal: controller.signal,
            }),
            requestJson(WORK_ITEMS_URL, {
              signal: controller.signal,
            }),
          ]);

        if (controller.signal.aborted) return;

        setRequirements(
          [...savedRequirements].sort((a, b) => b.id - a.id)
        );
        setWorkItems(savedWorkItems);

        setSelectedRequirementId((current) =>
          savedRequirements.some(
            (item) => String(item.id) === current
          )
            ? current
            : String(savedRequirements[0]?.id ?? "")
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setListError(errorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setListLoading(false);
        }
      }
    }

    loadData();

    return () => controller.abort();
  }, [reload]);

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setResult(null);

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setError("Please select a .txt file.");
      event.target.value = "";
      return;
    }

    try {
      setRequirement(await file.text());
    } catch {
      setError("Could not read the file. Please try again.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!projectName.trim() || !requirement.trim()) {
      setError("Please enter a project name and requirement.");
      return;
    }

    setLoading(true);

    try {
      const data = await requestJson(REQUIREMENTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: projectName.trim(),
          requirement: requirement.trim(),
        }),
      });

      setResult(data);

      setRequirements((previous) =>
        [
          data,
          ...previous.filter((item) => item.id !== data.id),
        ].sort((a, b) => b.id - a.id)
      );

      // ADDED: Select the newly saved requirement for work packages.
      setSelectedRequirementId(String(data.id));
      setParentId("");
      setWorkSuccess("");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  // ADDED: Items belonging to the selected requirement.
  const selectedItems = workItems
    .filter(
      (item) =>
        String(item.requirementId) === selectedRequirementId
    )
    .sort((a, b) => a.id - b.id);

  const selectedRequirement = requirements.find(
    (item) => String(item.id) === selectedRequirementId
  );

  // ADDED: Stories need an epic; tasks need a story.
  const expectedParentType = type === "STORY" ? "EPIC" : "STORY";

  const availableParents =
    type === "EPIC"
      ? []
      : selectedItems.filter(
          (item) => item.type === expectedParentType
        );

  const epics = selectedItems.filter(
    (item) => item.type === "EPIC"
  );

  const busy = listLoading || loading || workSaving;

  // ADDED: Save a work package through the new Java API.
  async function handleCreateWorkItem(event) {
    event.preventDefault();
    setWorkError("");
    setWorkSuccess("");

    if (!selectedRequirementId || !title.trim()) {
      setWorkError("Select a requirement and enter a title.");
      return;
    }

    if (
      type !== "EPIC" &&
      !availableParents.some(
        (item) => String(item.id) === parentId
      )
    ) {
      setWorkError("Select a valid parent work package.");
      return;
    }

    setWorkSaving(true);

    try {
      const data = await requestJson(WORK_ITEMS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          type,
          priority,
          requirementId: Number(selectedRequirementId),
          parentId: type === "EPIC" ? null : Number(parentId),
        }),
      });

      setWorkItems((previous) => [...previous, data]);
      setTitle("");
      setDescription("");
      setWorkSuccess(`${data.type} #${data.id} created.`);
    } catch (error) {
      setWorkError(errorMessage(error));
    } finally {
      setWorkSaving(false);
    }
  }

  // ADDED: Read-only backlog card.
  function renderWorkItem(item) {
    return (
      <div>
        <strong>
          {item.type} #{item.id}: {item.title}
        </strong>

        <p>
          Status: {item.status.replaceAll("_", " ")}
          {" · "}
          Priority: {item.priority}
        </p>

        {item.description && (
          <p style={{ whiteSpace: "pre-wrap" }}>
            {item.description}
          </p>
        )}
      </div>
    );
  }

  return (
    <main
      className="container"
      style={{ width: "min(1100px, 94%)" }}
    >
      <h1>AI Project Manager</h1>
      <p>Capture requirements and organize epics, stories, and tasks.</p>

      <section>
        <h2>Capture Requirement</h2>

        <form onSubmit={handleSubmit}>
          <label htmlFor="projectName">Project name</label>
          <input
            id="projectName"
            type="text"
            placeholder="Enter project name"
            value={projectName}
            disabled={busy}
            required
            onChange={(event) => {
              setProjectName(event.target.value);
              setResult(null);
            }}
          />

          <label htmlFor="requirementFile">
            Upload a requirement file
          </label>
          <input
            id="requirementFile"
            type="file"
            accept=".txt,text/plain"
            disabled={busy}
            onChange={handleFileUpload}
          />

          <label htmlFor="requirement">Business requirement</label>
          <textarea
            id="requirement"
            rows={6}
            placeholder="Type your requirement or upload a .txt file..."
            value={requirement}
            disabled={busy}
            required
            onChange={(event) => {
              setRequirement(event.target.value);
              setResult(null);
            }}
          />

          <p>{requirement.length} characters</p>

          {error && <p role="alert">{error}</p>}

          <button
            type="submit"
            disabled={
              busy ||
              !projectName.trim() ||
              !requirement.trim()
            }
          >
            {loading ? "Saving..." : "Save requirement"}
          </button>
        </form>

        {result && (
          <p role="status">
            Requirement #{result.id} saved successfully for{" "}
            <strong>{result.projectName}</strong>.
          </p>
        )}
      </section>

      {listLoading && <p>Loading saved data...</p>}

      {listError && (
        <div role="alert">
          <p>{listError}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => setReload((value) => value + 1)}
          >
            Retry loading
          </button>
        </div>
      )}

      {/* ADDED: Requirement selection for the backlog and form. */}
      <section>
        <h2>Work Packages</h2>

        <label htmlFor="selectedRequirement">
          Select business requirement
        </label>
        <select
          id="selectedRequirement"
          style={fieldStyle}
          value={selectedRequirementId}
          disabled={busy || Boolean(listError)}
          onChange={(event) => {
            setSelectedRequirementId(event.target.value);
            setParentId("");
            setWorkError("");
            setWorkSuccess("");
          }}
        >
          <option value="">Select a requirement</option>
          {requirements.map((item) => (
            <option key={item.id} value={String(item.id)}>
              #{item.id} — {item.projectName}
            </option>
          ))}
        </select>

        {selectedRequirement && (
          <p style={{ whiteSpace: "pre-wrap" }}>
            {selectedRequirement.description}
          </p>
        )}

        <h3>Create Work Package</h3>

        <form onSubmit={handleCreateWorkItem}>
          <label htmlFor="workType">Type</label>
          <select
            id="workType"
            style={fieldStyle}
            value={type}
            disabled={busy}
            onChange={(event) => {
              setType(event.target.value);
              setParentId("");
              setWorkError("");
              setWorkSuccess("");
            }}
          >
            <option value="EPIC">Epic</option>
            <option value="STORY">Story</option>
            <option value="TASK">Task</option>
          </select>

          {type !== "EPIC" && (
            <>
              <label htmlFor="parentId">
                {type === "STORY" ? "Parent epic" : "Parent story"}
              </label>
              <select
                id="parentId"
                style={fieldStyle}
                value={parentId}
                disabled={busy}
                required
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">Select a parent</option>
                {availableParents.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    #{item.id} — {item.title}
                  </option>
                ))}
              </select>

              {availableParents.length === 0 && (
                <p>
                  Create an{" "}
                  {type === "STORY" ? "epic" : "associated story"}{" "}
                  for this requirement first.
                </p>
              )}
            </>
          )}

          <label htmlFor="workTitle">Title</label>
          <input
            id="workTitle"
            value={title}
            maxLength={255}
            placeholder="Enter work-package title"
            disabled={busy}
            required
            onChange={(event) => setTitle(event.target.value)}
          />

          <label htmlFor="workDescription">Description</label>
          <textarea
            id="workDescription"
            rows={4}
            value={description}
            placeholder="Describe the work..."
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
          />

          <label htmlFor="priority">Priority</label>
          <select
            id="priority"
            style={fieldStyle}
            value={priority}
            disabled={busy}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>

          <p>New work packages start with status To Do.</p>

          {workError && <p role="alert">{workError}</p>}
          {workSuccess && <p role="status">{workSuccess}</p>}

          <button
            type="submit"
            disabled={
              busy ||
              Boolean(listError) ||
              !selectedRequirementId ||
              !title.trim() ||
              (type !== "EPIC" && !parentId)
            }
          >
            {workSaving ? "Creating..." : `Create ${type.toLowerCase()}`}
          </button>
        </form>
      </section>

      {/* ADDED: Epic → Story → Task hierarchy. */}
      <section>
        <h2>Backlog ({selectedItems.length} work packages)</h2>

        {!selectedRequirementId && <p>Select a requirement above.</p>}

        {selectedRequirementId &&
          !listLoading &&
          !listError &&
          epics.length === 0 && <p>Create your first epic above.</p>}

        {epics.map((epic) => {
          const stories = selectedItems.filter(
            (item) =>
              item.type === "STORY" && item.parentId === epic.id
          );

          return (
            <article
              key={epic.id}
              style={{
                ...cardStyle,
                borderLeft: "4px solid #7c3aed",
                marginTop: "16px",
              }}
            >
              {renderWorkItem(epic)}

              {stories.length === 0 && <p>No stories yet.</p>}

              {stories.map((story) => {
                const tasks = selectedItems.filter(
                  (item) =>
                    item.type === "TASK" &&
                    item.parentId === story.id
                );

                return (
                  <article
                    key={story.id}
                    style={{
                      ...cardStyle,
                      borderLeft: "4px solid #2563eb",
                    }}
                  >
                    {renderWorkItem(story)}

                    {tasks.length === 0 && <p>No tasks yet.</p>}

                    {tasks.map((task) => (
                      <article
                        key={task.id}
                        style={{
                          ...cardStyle,
                          borderLeft: "4px solid #16a34a",
                        }}
                      >
                        {renderWorkItem(task)}
                      </article>
                    ))}
                  </article>
                );
              })}
            </article>
          );
        })}
      </section>

      <section>
        <h2>Saved Requirements ({requirements.length})</h2>

        {!listLoading &&
          !listError &&
          requirements.length === 0 && (
            <p>No requirements saved yet.</p>
          )}

        {requirements.map((item) => (
          <article key={item.id} style={cardStyle}>
            <h3>
              #{item.id} — {item.projectName}
            </h3>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {item.description}
            </p>
            <small>Created: {item.createdAt}</small>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;