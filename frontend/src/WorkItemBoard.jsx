import { useState } from "react";

import { taskStatuses as columns } from "./taskStatuses";

const priorityLabels = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

const styles = `
  .work-item-board { color: #172033; text-align: left; }
  .work-item-board > header { margin-bottom: .65rem; }
  .work-item-board h2, .work-item-board h3, .work-item-board h4 { margin: 0; }
  .work-item-board__columns {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    align-items: start;
  }
  .work-item-board__column {
    min-height: 10rem;
    min-width: 0;
    padding: .9rem;
    border: 1px solid #e0e6ee;
    border-top: 3px solid var(--column-color);
    border-radius: .625rem;
    background: #edf1f6;
  }
  .work-item-board__column h3 {
    display: flex;
    justify-content: space-between;
    gap: .5rem;
    font-size: .95rem;
  }
  .work-item-board__cards { list-style: none; padding: 0; margin: .75rem 0 0; display: grid; gap: .55rem; }
  .work-item-board__card {
    padding: .75rem;
    border: 1px solid #e0e6ee;
    border-radius: .65rem;
    background: #fff;
    overflow-wrap: anywhere;
  }
  .work-item-board__card h4 { font-size: .95rem; }
  .work-item-board__meta { display: flex; flex-wrap: wrap; gap: .35rem .65rem; margin-top: .55rem; }
  .work-item-board__muted { color: #526179; font-size: .8rem; }
  .work-item-board__priority--HIGH { color: #a3212c; font-weight: 600; }
  .work-item-board__parent { margin: .45rem 0 0; }
  .work-item-board__field { display: block; margin: .65rem 0 0; font-size: .8rem; }
  .work-item-board__field select { display: block; width: 100%; margin-top: .25rem; font: inherit; }
  @media (max-width: 1100px) {
    .work-item-board__columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 550px) {
    .work-item-board__columns { grid-template-columns: minmax(0, 1fr); }
  }
`;

export default function WorkItemBoard({
  workItems = [],
  teamMembers = [],
  taskUpdatesDisabled,
  taskUpdateError,
  onTaskUpdate,
}) {
  const [completion, setCompletion] = useState(null);
  const itemsById = new Map(workItems.map((item) => [item.id, item]));
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
      <style>{styles}</style>
      <header>
        <span className="work-item-board__muted">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </header>

      {taskUpdateError && <p role="alert">{taskUpdateError}</p>}

      <div className="work-item-board__columns">
        {columns.map(({ status, label, color }) => {
          const items = tasks.filter((item) => item.status === status);
          return (
            <section
              className="work-item-board__column"
              style={{ "--column-color": color }}
              key={status}
            >
              <h3>
                {label}
                <span className="work-item-board__muted">{items.length}</span>
              </h3>
              {items.length === 0 ? (
                <p className="work-item-board__muted">No tasks</p>
              ) : (
                <ul className="work-item-board__cards">
                  {items.map(({ id, title, priority, parentId, assignee, contributorName }) => {
                    const parent = itemsById.get(parentId);
                    return (
                      <li className="work-item-board__card" key={id}>
                        <h4><a className="task-card-link" href={"#task/" + id}>{title}</a></h4>
                        <div className="work-item-board__meta work-item-board__muted">
                          <span>#{id}</span>
                          {priority && (
                            <span className={`work-item-board__priority--${priority}`}>
                              {priorityLabels[priority] ?? priority} priority
                            </span>
                          )}
                        </div>
                        {parent && (
                          <p className="work-item-board__parent work-item-board__muted">
                            Story: {parent.title}
                          </p>
                        )}
                        {contributorName && (
                          <p className="work-item-board__parent work-item-board__muted">Contributed by: {contributorName}</p>
                        )}
                        {onTaskUpdate && (
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
                        )}
                        {onTaskUpdate && (
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
                        )}
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
