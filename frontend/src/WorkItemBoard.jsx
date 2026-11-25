import React from "react";

const columns = [
  { status: "TO_DO", label: "To Do", color: "#64748b" },
  { status: "IN_PROGRESS", label: "In Progress", color: "#2563eb" },
  { status: "IN_REVIEW", label: "In Review", color: "#7c3aed" },
  { status: "DONE", label: "Done", color: "#15803d" },
];

const typeLabels = { EPIC: "Epic", STORY: "Story", TASK: "Task" };
const priorityLabels = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

const styles = `
  .work-item-board { margin-block: 2rem; color: #172033; text-align: left; }
  .work-item-board > header { display: flex; align-items: baseline; gap: .75rem; flex-wrap: wrap; }
  .work-item-board h2, .work-item-board h3, .work-item-board h4 { margin: 0; }
  .work-item-board__columns {
    display: grid;
    grid-template-columns: repeat(4, minmax(12rem, 1fr));
    gap: .75rem;
    overflow-x: auto;
    padding-block: .75rem;
  }
  .work-item-board__column {
    min-height: 10rem;
    padding: .75rem;
    border: 1px solid #dce3eb;
    border-top: 3px solid var(--column-color);
    border-radius: .625rem;
    background: #f5f7fb;
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
    border: 1px solid #dce3eb;
    border-radius: .5rem;
    background: #fff;
    overflow-wrap: anywhere;
  }
  .work-item-board__card h4 { font-size: .95rem; }
  .work-item-board__meta { display: flex; flex-wrap: wrap; gap: .35rem .65rem; margin-top: .55rem; }
  .work-item-board__muted { color: #526179; font-size: .8rem; }
  .work-item-board__priority--HIGH { color: #a3212c; font-weight: 600; }
  .work-item-board__parent { margin: .45rem 0 0; }
`;

export default function WorkItemBoard({ workItems = [] }) {
  const itemsById = new Map(workItems.map((item) => [item.id, item]));

  return (
    <section className="work-item-board" aria-label="Work board">
      <style>{styles}</style>
      <header>
        <h2>Work board</h2>
        <span className="work-item-board__muted">
          {workItems.length} {workItems.length === 1 ? "item" : "items"}
        </span>
      </header>

      <div className="work-item-board__columns">
        {columns.map(({ status, label, color }) => {
          const items = workItems.filter((item) => item.status === status);
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
                <p className="work-item-board__muted">No items</p>
              ) : (
                <ul className="work-item-board__cards">
                  {items.map(({ id, title, type, priority, parentId }) => {
                    const parent = itemsById.get(parentId);
                    return (
                      <li className="work-item-board__card" key={id}>
                        <h4>{title}</h4>
                        <div className="work-item-board__meta work-item-board__muted">
                          <span>#{id}</span>
                          <span>{typeLabels[type] ?? type}</span>
                          {priority && (
                            <span className={`work-item-board__priority--${priority}`}>
                              {priorityLabels[priority] ?? priority} priority
                            </span>
                          )}
                        </div>
                        {parent && (
                          <p className="work-item-board__parent work-item-board__muted">
                            Parent: {parent.title}
                          </p>
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
