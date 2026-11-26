import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

// ADDED: Import the status board for the selected requirement.
import WorkItemBoard from "./WorkItemBoard";
import TeamWorkload from "./TeamWorkload";
import TaskDetails from "./TaskDetails";
import ProgressReports from "./ProgressReports";
import DraftPreview from "./DraftPreview";
import { Avatar, BrandMark, Icon } from "./WorkspaceVisuals";
import { NewTask, SignIn, TaskDashboard, TaskTable } from "./WorkspaceHome";

const API_URL = "http://localhost:8080/api";
const REQUIREMENTS_URL = API_URL + "/requirements";
const WORK_ITEMS_URL = API_URL + "/work-items";
const AUTH_URL = API_URL + "/auth";

// ADDED: Shared request handling.
async function requestJson(url, options = {}) {
  const headers = new Headers(options.headers);
  if (options.method && options.method !== "GET") headers.set("X-Workspace-Request", "1");
  const response = await fetch(url, { ...options, credentials: "include", headers });
  if (response.status === 401 && !url.startsWith(AUTH_URL + "/")) {
    window.dispatchEvent(new Event("workspace-session-expired"));
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.detail || body?.message;

    const error = new Error(message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? null : response.json();
}

function errorMessage(error) {
  return error instanceof TypeError
    ? "Cannot reach the backend. Check that Spring Boot is running on port 8080."
    : error.message;
}

function isValidDraft(analysis) {
  const isText = (value) => typeof value === "string";
  const isListOf = (value, check) => Array.isArray(value) && value.every(check);

  return (
    isListOf(analysis?.epics, (epic) =>
      isText(epic?.title) &&
      isListOf(epic.stories, (story) =>
        isText(story?.title) &&
        isText(story.description ?? "") &&
        isListOf(story.acceptanceCriteria ?? [], isText) &&
        isListOf(story.tasks ?? [], (task) => isText(task?.title) && isText(task.description ?? ""))
      )
    ) && isListOf(analysis.clarificationQuestions ?? [], isText)
  );
}

function hasDraftTitles({ epics }) {
  const valid = ({ title }) => title.trim().length > 0 && title.trim().length <= 255;
  return epics.length > 0 && epics.every((epic) => valid(epic) && epic.stories.every(
    (story) => valid(story) && (story.tasks ?? []).every(valid)
  ));
}

function TaskDrawer({ taskId, title, returnView, children }) {
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  function closeDrawer() {
    window.location.hash = returnView;
  }

  return (
    <dialog ref={dialog} className="task-drawer" aria-labelledby="task-drawer-heading" onCancel={(event) => {
      event.preventDefault();
      closeDrawer();
    }}>
      <header className="task-drawer-header">
        <div><span className="task-key">TASK-{taskId}</span><h2 id="task-drawer-heading">{title}</h2></div>
        <button type="button" className="drawer-close" onClick={closeDrawer} aria-label="Close task details"><Icon name="close" /></button>
      </header>
      {children}
    </dialog>
  );
}

const sharedViews = { dashboard: "Dashboard", "my-tasks": "My Tasks", "new-task": "Create new task" };
const managerViews = {
  board: "Board",
  "work-packages": "Work Packages",
  requirements: "Requirements",
  team: "Team",
  reports: "Reports",
};

function selectedView(isManager) {
  const hash = window.location.hash.slice(1);
  const allowed = Object.hasOwn(sharedViews, hash) || (isManager && Object.hasOwn(managerViews, hash));
  return allowed || /^task\/[1-9]\d*$/.test(hash) ? hash : "dashboard";
}

function App() {
  const [account, setAccount] = useState(null);
  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const expired = () => { setAccount(null); setLoginError("Your session ended. Sign in again."); };
    window.addEventListener("workspace-session-expired", expired);
    requestJson(AUTH_URL + "/session", { signal: controller.signal })
      .then((profile) => { if (!controller.signal.aborted) setAccount(profile); })
      .catch((error) => { if (!controller.signal.aborted && error.status !== 401) setLoginError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => {
      controller.abort();
      window.removeEventListener("workspace-session-expired", expired);
    };
  }, []);

  async function login(username, password) {
    setSigningIn(true);
    setLoginError("");
    setLogoutError("");
    try {
      const profile = await requestJson(AUTH_URL + "/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      window.location.hash = "dashboard";
      setAccount(profile);
    } catch (error) {
      setLoginError(error.status === 401 ? "Invalid username or password." : errorMessage(error));
    } finally {
      setSigningIn(false);
    }
  }

  async function logout() {
    setLogoutError("");
    try {
      await requestJson(AUTH_URL + "/logout", { method: "POST" });
      setAccount(null);
    } catch (error) {
      if (error.status === 401) setAccount(null);
      else setLogoutError(errorMessage(error));
    }
  }

  if (checking) return <main className="sign-in-page"><p role="status">Checking your session…</p></main>;
  if (!account) return <SignIn onLogin={login} busy={signingIn} error={loginError} />;
  return <Workspace account={account} onLogout={logout} logoutError={logoutError} />;
}

function Workspace({ account, onLogout, logoutError }) {
  const isManager = account.role === "MANAGER";
  const [{ view, taskId }, setNavigation] = useState(() => {
    const route = selectedView(isManager);
    return route.startsWith("task/")
      ? { view: isManager ? "board" : "my-tasks", taskId: route.slice(5) }
      : { view: route, taskId: null };
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarScroll = useRef(null);
  const [canScrollSidebar, setCanScrollSidebar] = useState(false);
  const [taskProject, setTaskProject] = useState("");

  useEffect(() => {
    const region = sidebarScroll.current;
    if (!region) return;

    const updateScrollButton = () => {
      setCanScrollSidebar(region.scrollHeight - region.scrollTop - region.clientHeight > 1);
    };
    const observer = new ResizeObserver(updateScrollButton);
    observer.observe(region);
    for (const group of region.children) observer.observe(group);
    region.addEventListener("scroll", updateScrollButton, { passive: true });
    return () => {
      observer.disconnect();
      region.removeEventListener("scroll", updateScrollButton);
    };
  }, []);

  useEffect(() => {
    const updateView = () => {
      const route = selectedView(isManager);
      setNavigation((previous) => route.startsWith("task/")
        ? { ...previous, taskId: route.slice(5) }
        : { view: route, taskId: null });
    };
    window.addEventListener("hashchange", updateView);
    return () => window.removeEventListener("hashchange", updateView);
  }, [isManager]);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const [projectName, setProjectName] = useState("");
  const [requirement, setRequirement] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState("");

  const [requirements, setRequirements] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");

  // ADDED: Work-package data and form state.
  const [workItems, setWorkItems] = useState([]);
  const updateCommentCount = useCallback((id, commentCount) => {
    setWorkItems((items) => items.map((item) => item.id === id && item.commentCount !== commentCount
      ? { ...item, commentCount }
      : item));
  }, []);
  const openTask = taskId
    ? workItems.find((item) => item.type === "TASK" && String(item.id) === taskId)
    : null;
  const [teamMembers, setTeamMembers] = useState([]);
  const [updatingTask, setUpdatingTask] = useState(false);
  const [taskUpdateError, setTaskUpdateError] = useState("");
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
        const [savedRequirements, savedWorkItems, roster] =
          await Promise.all([
            requestJson(REQUIREMENTS_URL, {
              signal: controller.signal,
            }),
            requestJson(WORK_ITEMS_URL, {
              signal: controller.signal,
            }),
            isManager ? requestJson(`${WORK_ITEMS_URL}/team-members`, {
              signal: controller.signal,
            }) : Promise.resolve([]),
          ]);

        if (controller.signal.aborted) return;

        setRequirements(
          [...savedRequirements].sort((a, b) => b.id - a.id)
        );
        setWorkItems(savedWorkItems);
        setTeamMembers(roster);

        const taskRequirementIds = new Set(
          savedWorkItems.filter((item) => item.type === "TASK").map((item) => item.requirementId)
        );
        const openRoute = selectedView(isManager);
        const linkedTask = openRoute.startsWith("task/")
          ? savedWorkItems.find((item) => item.type === "TASK" && String(item.id) === openRoute.slice(5))
          : null;
        setSelectedRequirementId((current) =>
          savedRequirements.some(
            (item) => String(item.id) === current
          )
            ? current
            : String((savedRequirements.find((entry) => entry.id === linkedTask?.requirementId)
                ?? savedRequirements.find((entry) => taskRequirementIds.has(entry.id))
                ?? savedRequirements[0])?.id ?? "")
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
  }, [reload, isManager]);

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
      const fileText = await file.text();
      setDraft(null);
      setRequirement(fileText);
    } catch {
      setError("Could not read the file. Please try again.");
    }
  }

  // DRAFT GENERATION: Send the current form to the analysis endpoint and parse its response.
  async function handleGenerateDraft() {
    const inputs = {
      projectName: projectName.trim(),
      requirement: requirement.trim(),
    };

    setError("");
    setDraftSaveError("");
    setDraft(null);
    setGenerating(true);

    try {
      const data = await requestJson(`${REQUIREMENTS_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });

      const analysis = JSON.parse(data?.analysis);
      if (!isValidDraft(analysis)) {
        throw new Error("The backend returned an unexpected draft format.");
      }

      setDraft({ inputs, analysis, saveId: crypto.randomUUID() });
    } catch (error) {
      setError(
        error instanceof SyntaxError
          ? "The backend returned invalid JSON for the draft."
          : errorMessage(error)
      );
    } finally {
      setGenerating(false);
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

  const busy = listLoading || loading || workSaving || updatingTask || generating || savingDraft;

  // DRAFT GENERATION: Only show a response for the current form values.
  const currentDraft =
    draft?.inputs.projectName === projectName.trim() &&
    draft.inputs.requirement === requirement.trim()
      ? draft
      : null;

  // SAVE DRAFT: Save the reviewed result and put its work items on the board.
  async function handleSaveDraft() {
    if (busy || !currentDraft?.saveId || currentDraft.saved || !hasDraftTitles(currentDraft.analysis)) return;

    setDraft((previous) => ({ ...previous, attempted: true }));
    setDraftSaveError("");
    setSavingDraft(true);
    try {
      const { inputs, analysis, saveId } = currentDraft;
      const { requirement: savedRequirement, workItems: savedItems } =
        await requestJson(`${WORK_ITEMS_URL}/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...inputs,
            saveId,
            requirementId: result?.id ?? null,
            epics: analysis.epics.map((epic) => ({
              ...epic,
              stories: epic.stories.map((story) => ({
                ...story,
                acceptanceCriteria: story.acceptanceCriteria?.map((criterion) => criterion.trim()).filter(Boolean),
                tasks: story.tasks?.map(({ title, requiredRole, requiredSkill, description }) => ({
                  title,
                  requiredRole,
                  requiredSkill,
                  description,
                })),
              })),
            })),
            clarificationQuestions: analysis.clarificationQuestions,
          }),
        });

      setRequirements((previous) =>
        [savedRequirement, ...previous.filter((item) => item.id !== savedRequirement.id)]
          .sort((a, b) => b.id - a.id)
      );
      const savedIds = new Set(savedItems.map((item) => item.id));
      setWorkItems((previous) => [
        ...previous.filter((item) => !savedIds.has(item.id)),
        ...savedItems,
      ]);
      setResult(savedRequirement);
      selectRequirement(String(savedRequirement.id));
      setDraft((previous) => previous?.saveId === saveId ? { ...previous, saved: true } : previous);
    } catch (error) {
      setDraftSaveError(errorMessage(error));
    } finally {
      setSavingDraft(false);
    }
  }

  // TASK STATUS: Move the card only after the backend confirms the update.
  function updateAssignment({ id, assignee, assigneeName, contributor, contributorName }) {
    setWorkItems((items) => items.map((item) => item.id === id
      ? { ...item, assignee, assigneeName, contributor, contributorName }
      : item));
  }

  async function handleUpdateTask(id, field, value, extra = {}) {
    if (busy) return false;
    setTaskUpdateError("");
    setUpdatingTask(true);
    try {
      const updated = await requestJson(`${WORK_ITEMS_URL}/${id}/${field}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value, ...extra }),
      });
      if (field === "assignee") {
        updateAssignment(updated);
      } else {
        setWorkItems((previous) => previous.map((item) =>
          item.id === id ? { ...item, [field]: updated[field] } : item
        ));
      }
      return true;
    } catch (error) {
      setTaskUpdateError(`Could not update ${field} for task #${id}. ${errorMessage(error)}`);
      return false;
    } finally {
      setUpdatingTask(false);
    }
  }

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

  function selectRequirement(id) {
    setSelectedRequirementId(id);
    setParentId("");
    setWorkError("");
    setWorkSuccess("");
    setTaskUpdateError("");
  }

  // ADDED: Read-only backlog card.
  function renderWorkItem(item) {
    return (
      <div>
        <strong>
          {item.type} #{item.id}: {item.type === "TASK"
            ? <a href={"#task/" + item.id}>{item.title}</a>
            : item.title}
        </strong>

        <p>
          Status: {item.status.replaceAll("_", " ")}
          {" · "}
          Priority: {item.priority}
          {item.type === "STORY" && item.storyPoints != null && ` · ${item.storyPoints} story points`}
        </p>

        {item.description && (
          <details>
            <summary>Details</summary>
            <p className="preserve-text">{item.description}</p>
          </details>
        )}
      </div>
    );
  }

  const projectView = view === "board" || view === "work-packages";
  const activeProject = projectView ? selectedRequirement : null;
  const assignedIds = new Set(selectedItems.filter((item) => item.type === "TASK").map((item) => item.assignee));
  const visibleTeam = activeProject ? teamMembers.filter((member) => assignedIds.has(member.id)) : teamMembers;
  const pageTitle = isManager && view === "my-tasks" ? "Tasks" : sharedViews[view] ?? managerViews[view];
  const managerNav = [
    ["board", "board"], ["work-packages", "packages"], ["requirements", "spark"],
    ["team", "team"], ["reports", "reports"],
  ];

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <a className="workspace-brand" href="#dashboard"><BrandMark /> <span>Planova</span></a>
        <button type="button" className="workspace-menu-toggle" aria-expanded={menuOpen}
          aria-controls="workspace-menu" onClick={() => setMenuOpen((open) => !open)}>Menu</button>
        <nav ref={sidebarScroll} id="workspace-menu" data-expanded={menuOpen} aria-label="Workspace"
          onClick={(event) => { if (event.target.closest("a")) setMenuOpen(false); }}>
          <div className="nav-group">
            <p className="nav-heading">Workspace</p>
            <a href="#dashboard" aria-current={view === "dashboard" ? "page" : undefined}><Icon name="dashboard" /> Dashboard</a>
            <a href="#my-tasks" onClick={() => setTaskProject("")} aria-current={view === "my-tasks" ? "page" : undefined}>
              <Icon name="tasks" /> {isManager ? "Tasks" : "My Tasks"}
            </a>
            {isManager && managerNav.map(([key, icon]) => (
              <a key={key} href={`#${key}`} aria-current={view === key ? "page" : undefined}>
                <Icon name={icon} /> {managerViews[key]}
              </a>
            ))}
          </div>
          <details className="workspace-projects" open>
            <summary>Projects</summary>
            {requirements.map((item) => (
              <a key={item.id} href={isManager ? "#board" : "#my-tasks"}
                data-selected={(projectView && selectedRequirementId === String(item.id))
                  || (view === "my-tasks" && taskProject === String(item.id))}
                onClick={() => {
                  selectRequirement(String(item.id));
                  setTaskProject(String(item.id));
                }}>
                <span className="project-dot" /> {item.projectName}
              </a>
            ))}
            {!requirements.length && <p>No saved projects.</p>}
          </details>
        </nav>
        <button type="button" className="workspace-scroll-down" aria-label="Scroll sidebar down"
          disabled={!canScrollSidebar}
          onClick={() => sidebarScroll.current?.scrollBy({ top: 180 })}>
          <span aria-hidden="true">⌄</span>
        </button>
        <details className="workspace-identity">
          <summary><Avatar name={account.name} />
            <span className="account-copy"><strong>{account.name}</strong><small>{isManager ? "Manager" : "Team member"}</small></span>
          </summary>
          <button type="button" onClick={onLogout}>Sign out</button>
          {logoutError && <p role="alert">{logoutError}</p>}
        </details>
      </aside>

      <main className="workspace-main">
        <header className="page-header workspace-header">
          <div className="workspace-header-title">
            {activeProject && <p className="page-context">Projects / {pageTitle}</p>}
            <h1>{activeProject?.projectName ?? pageTitle}</h1>
          </div>
          <div className="header-actions">
            {visibleTeam.length > 0 && <ul className="avatar-stack" aria-label={activeProject ? "Assigned team" : "Workspace team"}>
              {visibleTeam.slice(0, 5).map((member) => <li key={member.id} aria-label={member.name}><Avatar name={member.name} role={member.role} /></li>)}
              {visibleTeam.length > 5 && <li className="avatar-overflow" aria-label={`${visibleTeam.length - 5} more team members`}>+{visibleTeam.length - 5}</li>}
            </ul>}
            {isManager && view !== "requirements" && <a className="action-link action-secondary" href="#requirements">
              <Icon name="spark" /> Generate with AI
            </a>}
            {view !== "new-task" && <a className="action-link" href="#new-task"><Icon name="plus" /> New Task</a>}
          </div>
        </header>

        {projectView && (
          <div className="project-toolbar">
            <div className="project-tabs" aria-label="Project views">
              <a href="#board" aria-current={view === "board" ? "page" : undefined}><Icon name="board" /> Board</a>
              <a href="#work-packages" aria-current={view === "work-packages" ? "page" : undefined}><Icon name="packages" /> Work packages</a>
            </div>
            <div className="inline-filter">
              <label htmlFor="boardProject">Project</label>
              <select id="boardProject" value={selectedRequirementId} disabled={busy || Boolean(listError)}
                onChange={(event) => selectRequirement(event.target.value)}>
                <option value="">Select a project</option>
                {requirements.map((item) => <option key={item.id} value={String(item.id)}>{item.projectName}</option>)}
              </select>
            </div>
          </div>
        )}

        {listLoading && <p role="status">Loading saved data…</p>}
        {listError && (
          <div className="panel" role="alert">
            <p>{listError}</p>
            <button type="button" disabled={busy} onClick={() => setReload((value) => value + 1)}>
              Retry loading
            </button>
          </div>
        )}

        {view === "dashboard" && !listLoading && !listError && (
          <TaskDashboard
            tasks={workItems.filter((item) => item.type === "TASK")}
            requirements={requirements}
            isManager={isManager}
            commentsUrl={WORK_ITEMS_URL + "/recent-comments"}
            requestJson={requestJson}
          />
        )}

        {view === "my-tasks" && !listLoading && !listError && (
          <section className="panel" aria-label={isManager ? "Project tasks" : "My tasks"}>
            <div className="task-list-header">
              <label htmlFor="taskProject">Project</label>
              <select id="taskProject" value={taskProject} onChange={(event) => setTaskProject(event.target.value)}>
                <option value="">All projects</option>
                {requirements.map((item) => <option key={item.id} value={item.id}>{item.projectName}</option>)}
              </select>
            </div>
            {taskUpdateError && <p role="alert">{taskUpdateError}</p>}
            <TaskTable
              tasks={workItems.filter((item) => item.type === "TASK" && (!taskProject || String(item.requirementId) === taskProject))}
              projects={new Map(requirements.map((item) => [item.id, item.projectName]))}
              onUpdateStatus={isManager ? undefined : handleUpdateTask}
              updatesDisabled={busy}
            />
          </section>
        )}

        {view === "new-task" && !listLoading && !listError && (
          <NewTask requirements={requirements} initialProject={selectedRequirementId} workItemsUrl={WORK_ITEMS_URL} requestJson={requestJson}
            onCreated={(task) => {
              setWorkItems((items) => [...items, task]);
              const projectId = String(task.requirementId);
              selectRequirement(projectId);
              setTaskProject(projectId);
              setNavigation({ view: isManager ? "board" : "my-tasks", taskId: String(task.id) });
              window.location.hash = "task/" + task.id;
            }} />
        )}

        {view === "board" && !listLoading && !listError && (
          selectedRequirement ? (
            <WorkItemBoard
              key={selectedRequirementId}
              workItems={selectedItems}
              teamMembers={teamMembers}
              taskUpdatesDisabled={busy}
              taskUpdateError={taskUpdateError}
              onTaskUpdate={handleUpdateTask}
            />
          ) : <p className="panel">Select a saved requirement to view its tasks.</p>
        )}

        {view === "work-packages" && !listLoading && !listError && (
          selectedRequirement ? (
            <div className="split-layout">
              <section className="panel" aria-label="Backlog">
                <h2>Backlog <span className="section-count">{selectedItems.length}</span></h2>
              {epics.length === 0 && <p>No epics yet.</p>}

              {epics.map((epic) => {
                const stories = selectedItems.filter(
                  (item) =>
                    item.type === "STORY" && item.parentId === epic.id
                );

                return (
                  <article
                    key={epic.id}
                    className="backlog-card backlog-epic"
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
                          className="backlog-card backlog-story"
                        >
                          {renderWorkItem(story)}

                          {tasks.length === 0 && <p>No tasks yet.</p>}

                          {tasks.map((task) => (
                            <article
                              key={task.id}
                              className="backlog-card backlog-task"
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
              <section className="panel" aria-label="New work package">
                <h2>New work package</h2>
              <form onSubmit={handleCreateWorkItem}>
                <label htmlFor="workType">Type</label>
                <select
                  id="workType"
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
                  value={priority}
                  disabled={busy}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>

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
            </div>
          ) : <p className="panel">Select a saved requirement to view its work packages.</p>
        )}

        {view === "requirements" && (
          <div className="split-layout">
            <section className="panel" aria-label="Saved requirements">
              <h2>Saved requirements <span className="section-count">{requirements.length}</span></h2>
              {!listLoading && !listError && requirements.length === 0 && <p>No requirements saved yet.</p>}
              {requirements.map((item) => (
                <details key={item.id} className="requirement-entry">
                  <summary><span>#{item.id}</span> {item.projectName}</summary>
                  <p className="preserve-text">{item.description}</p>
                  {item.clarificationQuestions && (
                    <>
                      <h3>Clarification questions</h3>
                      <p className="preserve-text">{item.clarificationQuestions}</p>
                    </>
                  )}
                  <a href="#board" onClick={() => selectRequirement(String(item.id))}>Open board</a>
                </details>
              ))}
            </section>
            <section className="panel" aria-label="New requirement">
              <h2>New requirement</h2>
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
                    setDraft(null);
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
                    setDraft(null);
                  }}
                />


                {error && <p role="alert">{error}</p>}

                <div className="requirement-actions">
                  <button
                    type="button"
                    onClick={handleGenerateDraft}
                    disabled={busy || !projectName.trim() || !requirement.trim() || currentDraft?.saved}
                  >
                    <Icon name="spark" /> {generating ? "Generating…" : "Generate with AI"}
                  </button>
                  <button
                    type="submit"
                    className="secondary-button"
                    disabled={busy || !projectName.trim() || !requirement.trim() || Boolean(result)}
                  >
                    {loading ? "Saving…" : "Save requirement"}
                  </button>
                </div>
              </form>
              {result && (
                <p role="status">
                  Requirement #{result.id} saved successfully for{" "}
                  <strong>{result.projectName}</strong>.
                </p>
              )}
            </section>
            {currentDraft && (
              <DraftPreview analysis={currentDraft.analysis} editable={!currentDraft.attempted} disabled={busy}
                onEdit={(path, value) => {
                  setDraft((previous) => {
                    const analysis = structuredClone(previous.analysis);
                    const parent = path.slice(0, -1).reduce((node, key) => node[key], analysis);
                    parent[path.at(-1)] = value;
                    return { ...previous, analysis };
                  });
                }}>
                {!hasDraftTitles(currentDraft.analysis) && currentDraft.analysis.epics.length > 0 && (
                  <p role="status">Give every epic, story, and task a title of up to 255 characters.</p>
                )}
                <div className="requirement-actions">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={busy || currentDraft.saved || !hasDraftTitles(currentDraft.analysis)}
                  >
                    {savingDraft ? "Saving draft…" : currentDraft.saved ? "Saved to board" : "Save draft to board"}
                  </button>
                  {currentDraft.saved && <a href="#board">Open board</a>}
                </div>
                {draftSaveError && <p role="alert">{draftSaveError}</p>}
              </DraftPreview>
            )}
          </div>
        )}

        {view === "team" && !listLoading && !listError && (
          <TeamWorkload
            members={teamMembers}
            requirements={requirements}
            workItems={workItems}
          />
        )}
        {view === "reports" && !listLoading && !listError && (
          <ProgressReports items={workItems} requirements={requirements}
            workItemsUrl={WORK_ITEMS_URL} requestJson={requestJson} />
        )}
      </main>
      {taskId && <TaskDrawer key={taskId} taskId={taskId} title={openTask?.title ?? "Task details"} returnView={view}>
        {listLoading ? <p role="status">Loading task…</p> : listError ? <p role="alert">{listError}</p> : openTask ? (
          <TaskDetails
            key={openTask.id}
            task={openTask}
            account={account}
            teamMembers={teamMembers}
            taskUrl={WORK_ITEMS_URL + "/" + openTask.id}
            requestJson={requestJson}
            onCommentCount={updateCommentCount}
            onUpdated={({ id, description, dueDate, estimatedHours }) => setWorkItems((items) =>
              items.map((item) => item.id === id ? { ...item, description, dueDate, estimatedHours } : item)
            )}
            onAssignmentUpdated={updateAssignment}
          />
        ) : <p className="panel">Task not found.</p>}
      </TaskDrawer>}
    </div>
  );
}

export default App;
