import { useState } from "react";

import { taskStatuses as columns } from "./taskStatuses";
import { Avatar, DueDate } from "./WorkspaceVisuals";

const priorityLabels = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

export default function WorkItemBoard({
  workItems = [],
  teamMembers = [],
  taskUpdatesDisabled,
  taskUpdateError,
  onTaskUpdate,
}) {
  const [completion, setCompletion] = useState(null);
  const itemsById = new Map(workItems.map((item) => [item.id, item]));
  const membersById = new Map(teamMembers.map((member) => [member.id, member]));
  const tasks = workItems.filter((item) => item.type === "TASK");

  function changeStatus(id, status, assignee) {
    if (status === "DONE") {
      setCompletion({ id, member: assignee ?? "" });
    } else {
      setCompletion(null);
      onTaskUpdate(id, "status", status);
    }
  }

  async function confirmCompletion(event) {
    event.preventDefault();
    const saved = await onTaskUpdate(completion.id, "status", "DONE", {
      completedBy: completion.member || null,
    });
    if (saved) setCompletion(null);
  }

  return (
    <section className="work-item-board" aria-label="Work board">
      {taskUpdateError && <p role="alert">{taskUpdateError}</p>}

      <div className="work-item-board__columns">
        {columns.map(({ status, label, color }) => {
          const items = tasks.filter((item) => item.status === status);
          return (
            <section
              className="work-item-board__column"
              data-status={status}
              style={{ "--column-color": color }}
              key={status}
            >
              <h3>
                {label}
                <span className="board-count" aria-label={items.length + " tasks"}>{items.length}</span>
              </h3>
              {items.length === 0 ? (
                <p className="board-empty">No tasks</p>
              ) : (
                <ul className="work-item-board__cards">
                  {items.map((task) => {
                    const { id, title, priority, parentId, assignee, contributorName } = task;
                    const parent = itemsById.get(parentId);
                    const member = membersById.get(assignee);
                    return (
                      <li className="work-item-board__card" key={id}>
                        <div className="board-card-meta">
                          <span className="task-key">TASK-{id}</span>
                          {priority && <span className="priority-pill" data-priority={priority}>
                            {priorityLabels[priority] ?? priority}
                          </span>}
                        </div>
                        <h4><a className="task-card-link" href={"#task/" + id}>{title}</a></h4>
                        {parent && (
                          <p className="work-item-board__parent">
                            Story: {parent.title}
                          </p>
                        )}
                        {contributorName && (
                          <p className="work-item-board__parent">Contributed by: {contributorName}</p>
                        )}
                        <div className="board-card-footer">
                          <DueDate task={task} empty={null} />
                          <span className="board-assignee" role="img" aria-label={member?.name ?? "Unassigned"}>
                            <Avatar name={member?.name} role={member?.role} />
                          </span>
                        </div>
                        {onTaskUpdate && (
                          <details className="board-card-controls" open={completion?.id === id || undefined}>
                            <summary>Quick edit</summary>
                            <label className="work-item-board__field">
                              Assignee
                              <select
                                aria-label={`Assignee for ${title}`}
                                value={assignee ?? ""}
                                disabled={taskUpdatesDisabled}
                                onChange={(event) => onTaskUpdate(id, "assignee", event.target.value)}
                              >
                                <option value="" disabled>Unassigned</option>
                                {teamMembers.map((member) => (
                                  <option key={member.id} value={member.id}>{member.name}</option>
                                ))}
                              </select>
                            </label>
                            <label className="work-item-board__field">
                              Status
                              <select
                                aria-label={`Status for ${title}`}
                                value={completion?.id === id ? "DONE" : status}
                                disabled={taskUpdatesDisabled}
                                onChange={(event) => changeStatus(id, event.target.value, assignee)}
                              >
                                {columns.map((column) => (
                                  <option key={column.status} value={column.status}>{column.label}</option>
                                ))}
                              </select>
                            </label>
                          {completion?.id === id && (
                            <form className="task-completion-form" onSubmit={confirmCompletion}>
                              <label htmlFor={"completedBy-" + id}>Completed by</label>
                              <select id={"completedBy-" + id} value={completion.member} disabled={taskUpdatesDisabled}
                                onChange={(event) => setCompletion({ id, member: event.target.value })}>
                                <option value="">Select a team member</option>
                                {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                              </select>
                              <button type="submit" disabled={taskUpdatesDisabled || !completion.member}>Mark done</button>
                              <button type="button" className="secondary-button" disabled={taskUpdatesDisabled}
                                onClick={() => setCompletion(null)}>Cancel</button>
                            </form>
                          )}
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
