import { useEffect, useState } from "react";
import { taskStatuses } from "./taskStatuses";

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function TaskDetails({ task, teamMembers, taskUrl, requestJson, onUpdated, onAssignmentUpdated,
  onCommentCount, account }) {
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [hours, setHours] = useState(task.estimatedHours ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentError, setCommentError] = useState("");
  const [commentAttempt, setCommentAttempt] = useState(0);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    requestJson(taskUrl + "/comments", { signal: controller.signal })
      .then((entries) => {
        if (!controller.signal.aborted) {
          setComments(entries);
          onCommentCount(task.id, entries.length);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setCommentError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingComments(false);
      });
    return () => controller.abort();
  }, [task.id, taskUrl, requestJson, commentAttempt, onCommentCount]);

  async function saveDetails(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const updated = await requestJson(taskUrl + "/details", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          dueDate: dueDate || null,
          estimatedHours: hours === "" ? null : Number(hours),
        }),
      });
      setDescription(updated.description ?? "");
      setDueDate(updated.dueDate ?? "");
      setHours(updated.estimatedHours ?? "");
      onUpdated(updated);
      setSaved(true);
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function postComment(event) {
    event.preventDefault();
    setPosting(true);
    setPostError("");
    try {
      const entry = await requestJson(taskUrl + "/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      setComments((current) => [...current, entry]);
      onCommentCount(task.id, entry.commentCount);
      setBody("");
    } catch (error) {
      setPostError(error.message);
    } finally {
      setPosting(false);
    }
  }

  async function changeAssignment(field, value) {
    setAssigning(true);
    setAssignmentError("");
    try {
      const updated = await requestJson(taskUrl + "/" + field, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      onAssignmentUpdated(updated);
    } catch (error) {
      setAssignmentError(error.message);
    } finally {
      setAssigning(false);
    }
  }

  const changed = description.trim() !== (task.description ?? "").trim()
    || dueDate !== (task.dueDate ?? "") || String(hours) !== String(task.estimatedHours ?? "");

  return (
    <div className="task-detail-layout">
      <section className="panel task-detail-panel" aria-label="Task details">
        <h2>Task details</h2>
        <dl className="task-metadata">
          <div><dt>Status</dt><dd>{taskStatuses.find((entry) => entry.status === task.status)?.label ?? task.status}</dd></div>
          {account.role === "MANAGER" ? (
          <div>
            <dt><label htmlFor="taskAssignee">Assignee</label></dt>
            <dd>
              <select id="taskAssignee" value={task.assignee ?? ""} disabled={assigning}
                onChange={(event) => changeAssignment("assignee", event.target.value)}>
                <option value="" disabled>Unassigned</option>
                {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </dd>
          </div>
          ) : <div><dt>Assignee</dt><dd>{task.assigneeName ?? "Unassigned"}</dd></div>}
          {account.role === "MANAGER" ? (
            <div>
              <dt><label htmlFor="taskContributor">Contributed by</label></dt>
              <dd>
                <select id="taskContributor" value={task.contributor ?? ""} disabled={assigning}
                  onChange={(event) => changeAssignment("contributor", event.target.value || null)}>
                  <option value="">No contributor</option>
                  {teamMembers.filter((member) => member.id !== task.assignee).map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </dd>
            </div>
          ) : <div><dt>Contributed by</dt><dd>{task.contributorName ?? "—"}</dd></div>}
          <div><dt>Created</dt><dd>{task.createdAt ? dateTime.format(new Date(task.createdAt)) : "Date unavailable"}</dd></div>
        </dl>
        {assignmentError && <p role="alert">{assignmentError}</p>}

        <form onSubmit={saveDetails}>
          <label htmlFor="taskDescription">Description</label>
          <textarea id="taskDescription" rows={8} value={description} disabled={saving}
            onChange={(event) => { setDescription(event.target.value); setSaved(false); }} />
          <div className="task-planning-fields">
            <div>
              <label htmlFor="taskDueDate">Due date</label>
              <input id="taskDueDate" type="date" min="1000-01-01" max="9999-12-31"
                value={dueDate} disabled={saving} onChange={(event) => { setDueDate(event.target.value); setSaved(false); }} />
            </div>
            <div>
              <label htmlFor="taskEstimatedHours">Estimated effort (hours)</label>
              <input id="taskEstimatedHours" type="number" min="0" max="999999.99" step=".01"
                value={hours} disabled={saving} onChange={(event) => { setHours(event.target.value); setSaved(false); }} />
            </div>
          </div>
          <button type="submit" disabled={saving || !changed}>{saving ? "Saving…" : "Save details"}</button>
          {saveError && <p role="alert">{saveError}</p>}
          {saved && <p role="status">Task details saved.</p>}
        </form>
      </section>

      <section className="panel" aria-label="Comments">
        <h2>Comments <span className="section-count">{comments.length}</span></h2>
        {loadingComments && <p role="status">Loading comments…</p>}
        {commentError && (
          <div role="alert">
            <p>{commentError}</p>
            <button type="button" onClick={() => {
              setCommentError("");
              setLoadingComments(true);
              setCommentAttempt((attempt) => attempt + 1);
            }}>Retry loading comments</button>
          </div>
        )}
        {!loadingComments && !commentError && comments.length === 0 && <p>No comments yet.</p>}
        {comments.length > 0 && (
          <ol className="task-comments">
            {comments.map((comment) => (
              <li key={comment.id}>
                <div className="task-comment-meta">
                  <strong>{comment.authorName}</strong>
                  <time dateTime={comment.createdAt}>{dateTime.format(new Date(comment.createdAt))}</time>
                </div>
                <p className="preserve-text">{comment.body}</p>
              </li>
            ))}
          </ol>
        )}
        <form className="task-comment-form" onSubmit={postComment}>
          <label htmlFor="commentBody">Add a comment</label>
          <textarea id="commentBody" rows={4} value={body} required disabled={posting}
            onChange={(event) => setBody(event.target.value)} />
          <button type="submit" disabled={posting || loadingComments || Boolean(commentError) || !body.trim()}>
            {posting ? "Posting…" : "Post comment"}
          </button>
          {postError && <p role="alert">{postError}</p>}
        </form>
      </section>
    </div>
  );
}
