import { useState } from "react";
import { taskStatuses } from "./taskStatuses";

const statusesById = new Map(taskStatuses.map((entry) => [entry.status, entry]));
function MemberWorkload({ member, tasks, projects }) {
  const name = member?.name ?? "Unassigned";
  const completed = tasks.filter((task) => task.status === "DONE").length;

  return (
    <section className="panel workload-card" aria-label={name}>
      <header className="workload-card-header">
        <span className="workload-avatar" data-role={member?.role} aria-hidden="true">
          {member ? name.split(" ").map((word) => word[0]).join("") : "—"}
        </span>
        <h2>{name}</h2>
      </header>

      {member?.skills.length > 0 && (
        <ul className="skill-list" aria-label={name + " skills"}>
          {member.skills.map((skill) => <li key={skill}>{skill}</li>)}
        </ul>
      )}

      {tasks.length > 0 ? (
        <>
          <div className="workload-progress">
            <span>{completed} of {tasks.length} done</span>
            <progress value={completed} max={tasks.length} aria-label={name + " completion"} />
          </div>
          <ul className="workload-tasks">
            {tasks.map((task) => (
              <li key={task.id}>
                <div className="workload-task-name">
                  <a href={"#task/" + task.id}>
                    {task.title}
                  </a>
                  <span>#{task.requirementId} · {projects.get(task.requirementId) ?? "Requirement"}</span>
                </div>
                <span className="workload-status" data-status={task.status}>
                  {statusesById.get(task.status)?.label ?? task.status}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="workload-empty">No assigned tasks.</p>
      )}
    </section>
  );
}

export default function TeamWorkload({ members, requirements, workItems }) {
  const [requirementId, setRequirementId] = useState("");
  const projects = new Map(requirements.map(({ id, projectName }) => [id, projectName]));
  const tasks = workItems.filter((item) =>
    item.type === "TASK" && (!requirementId || String(item.requirementId) === requirementId)
  );
  const tasksByMember = new Map(members.map(({ id }) => [id, []]));
  const unassigned = [];

  for (const task of tasks) {
    const assigned = tasksByMember.get(task.assignee);
    (assigned ?? unassigned).push(task);
  }

  return (
    <div className="team-workload">
      <div className="workload-toolbar">
        <div className="requirement-picker">
          <label htmlFor="teamRequirement">Requirement</label>
          <select
            id="teamRequirement"
            value={requirementId}
            onChange={(event) => setRequirementId(event.target.value)}
          >
            <option value="">All saved requirements</option>
            {requirements.map((requirement) => (
              <option key={requirement.id} value={String(requirement.id)}>
                #{requirement.id} — {requirement.projectName}
              </option>
            ))}
          </select>
        </div>
        <p>{tasks.length} {tasks.length === 1 ? "task" : "tasks"} · {unassigned.length} unassigned</p>
      </div>

      <dl className="workload-summary" aria-label="Tasks by status">
        {taskStatuses.map(({ status, label, color }) => (
          <div className="panel" key={status} style={{ "--status-color": color }}>
            <dt>{label}</dt>
            <dd>{tasks.filter((task) => task.status === status).length}</dd>
          </div>
        ))}
      </dl>

      <div className="team-grid">
        {members.map((member) => (
          <MemberWorkload
            key={member.id}
            member={member}
            tasks={tasksByMember.get(member.id)}
            projects={projects}
          />
        ))}
        {unassigned.length > 0 && (
          <MemberWorkload tasks={unassigned} projects={projects} />
        )}
      </div>
      {members.length === 0 && unassigned.length === 0 && <p className="panel">No team members available.</p>}
    </div>
  );
}
