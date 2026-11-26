import { useEffect, useState } from "react";
import { taskStatuses } from "./taskStatuses";

const commentDateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function SignIn({ onLogin, error, busy }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="sign-in-page">
      <section className="panel sign-in-panel">
        <h1>Planova</h1>
        <h2>Sign in to your workspace</h2>
        <form onSubmit={(event) => { event.preventDefault(); onLogin(username.trim(), password); }}>
          <label htmlFor="loginUser">Username</label>
          <input id="loginUser" autoComplete="username" value={username} required disabled={busy}
            onChange={(event) => setUsername(event.target.value)} />
          <label htmlFor="loginPassword">Password</label>
          <input id="loginPassword" type="password" autoComplete="current-password" value={password} required disabled={busy}
            onChange={(event) => setPassword(event.target.value)} />
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={busy || !username.trim() || !password}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}

export function TaskDashboard({ tasks, requirements, isManager, commentsUrl, requestJson }) {
  const names = new Map(requirements.map((requirement) => [requirement.id, requirement.projectName]));

  return (
    <>
      <dl className="workload-summary dashboard-summary" aria-label="Task totals">
        <div className="panel"><dt>Total tasks</dt><dd>{tasks.length}</dd></div>
        {taskStatuses.map(({ status, label, color }) => (
          <div className="panel" key={status} style={{ "--status-color": color }}>
            <dt>{label}</dt><dd>{tasks.filter((task) => task.status === status).length}</dd>
          </div>
        ))}
      </dl>
      <div className="dashboard-content">
        <section className="panel" aria-label="Task list">
          <h2>{isManager ? "Project tasks" : "My tasks"}</h2>
          <TaskTable tasks={tasks} projects={names} />
        </section>
        <RecentComments url={commentsUrl} requestJson={requestJson} />
      </div>
    </>
  );
}

function RecentComments({ url, requestJson }) {
  const [comments, setComments] = useState([]);
  const [nextBeforeId, setNextBeforeId] = useState(null);
  const [page, setPage] = useState({ beforeId: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const endpoint = page.beforeId === null ? url : url + "?beforeId=" + page.beforeId;
    requestJson(endpoint, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setComments((previous) => page.beforeId === null ? result.comments : [...previous, ...result.comments]);
        setNextBeforeId(result.nextBeforeId);
      })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, requestJson, url]);

  function loadPage(beforeId) {
    setLoading(true);
    setError("");
    setPage({ beforeId });
  }

  return (
    <section className="panel" aria-labelledby="dashboard-comments-heading">
      <header className="dashboard-comments-header">
        <h2 id="dashboard-comments-heading">Recent comments</h2>
        <button type="button" className="secondary-button" disabled={loading} onClick={() => loadPage(null)}>Refresh</button>
      </header>
      {comments.length > 0 && (
        <ol className="task-comments">
          {comments.map((comment) => (
            <li key={comment.id}>
              <a className="dashboard-comment-task" href={"#task/" + comment.taskId}>#{comment.taskId} {comment.taskTitle}</a>
              <div className="task-comment-meta">
                <strong>{comment.authorName}</strong>
                <time dateTime={comment.createdAt}>{commentDateTime.format(new Date(comment.createdAt))}</time>
              </div>
              <p className="preserve-text">{comment.body}</p>
            </li>
          ))}
        </ol>
      )}
      {loading && <p role="status">Loading comments…</p>}
      {!loading && !error && comments.length === 0 && <p>No task comments yet.</p>}
      {error && (
        <div>
          <p role="alert">{error}</p>
          <button type="button" className="secondary-button" onClick={() => loadPage(page.beforeId)}>Retry</button>
        </div>
      )}
      {!error && nextBeforeId !== null && (
        <button type="button" className="secondary-button" disabled={loading} onClick={() => loadPage(nextBeforeId)}>
          Show older comments
        </button>
      )}
    </section>
  );
}

export function TaskTable({ tasks, projects, onUpdateStatus, updatesDisabled }) {
  if (!tasks.length) return <p>No tasks to show.</p>;
  return (
    <div className="task-table-scroll">
      <table className="workspace-task-table">
        <thead><tr><th>Task</th><th>Project</th><th>Status</th><th>Due date</th><th>Contributed by</th><th>Comments</th></tr></thead>
        <tbody>{tasks.map((task) => (
          <tr key={task.id}>
            <td><a href={"#task/" + task.id}>#{task.id} {task.title}</a></td>
            <td>{projects.get(task.requirementId) ?? "—"}</td>
            <td>{onUpdateStatus ? (
              <select aria-label={"Status for " + task.title} value={task.status} disabled={updatesDisabled}
                onChange={(event) => onUpdateStatus(task.id, "status", event.target.value)}>
                {taskStatuses.map(({ status, label }) => <option key={status} value={status}>{label}</option>)}
              </select>
            ) : (
              <span className="workload-status" data-status={task.status}>
                {taskStatuses.find(({ status }) => status === task.status)?.label ?? task.status}
              </span>
            )}</td>
            <td>{task.dueDate ?? "—"}</td>
            <td>{task.contributorName ?? "—"}</td>
            <td>{task.commentCount ?? 0}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function NewTask({ requirements, workItemsUrl, requestJson, onCreated }) {
  const [project, setProject] = useState("");
  const [parents, setParents] = useState([]);
  const [parent, setParent] = useState("");
  const [loadingParents, setLoadingParents] = useState(false);
  const [parentError, setParentError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!project) return;
    const controller = new AbortController();
    requestJson(workItemsUrl + "/task-parents?requirementId=" + encodeURIComponent(project), { signal: controller.signal })
      .then((stories) => { if (!controller.signal.aborted) setParents(stories); })
      .catch((failure) => { if (!controller.signal.aborted) setParentError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingParents(false); });
    return () => controller.abort();
  }, [project, requestJson, workItemsUrl]);

  async function createTask(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const task = await requestJson(workItemsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TASK", requirementId: Number(project), parentId: Number(parent),
          title: title.trim(), description: description.trim(), priority,
        }),
      });
      onCreated(task);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel new-task-panel" aria-label="New task">
      <form onSubmit={createTask}>
        <label htmlFor="newTaskProject">Project</label>
        <select id="newTaskProject" value={project} required disabled={saving} onChange={(event) => {
          setProject(event.target.value);
          setParent("");
          setParents([]);
          setParentError("");
          setLoadingParents(Boolean(event.target.value));
        }}>
          <option value="">Select a project</option>
          {requirements.map((item) => <option key={item.id} value={item.id}>#{item.id} — {item.projectName}</option>)}
        </select>
        <label htmlFor="newTaskStory">Parent story</label>
        <select id="newTaskStory" value={parent} required disabled={saving || loadingParents || !project}
          onChange={(event) => setParent(event.target.value)}>
          <option value="">{loadingParents ? "Loading stories…" : "Select a story"}</option>
          {parents.map((story) => <option key={story.id} value={story.id}>#{story.id} — {story.title}</option>)}
        </select>
        {project && !loadingParents && !parentError && !parents.length && <p>This project has no stories yet.</p>}
        {parentError && <p role="alert">{parentError}</p>}
        <label htmlFor="newTaskTitle">Title</label>
        <input id="newTaskTitle" maxLength={255} value={title} required disabled={saving} onChange={(event) => setTitle(event.target.value)} />
        <label htmlFor="newTaskDescription">Description</label>
        <textarea id="newTaskDescription" rows={5} value={description} disabled={saving} onChange={(event) => setDescription(event.target.value)} />
        <label htmlFor="newTaskPriority">Priority</label>
        <select id="newTaskPriority" value={priority} disabled={saving} onChange={(event) => setPriority(event.target.value)}>
          <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
        </select>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={saving || !parent || !title.trim()}>{saving ? "Creating…" : "Create task"}</button>
      </form>
    </section>
  );
}
