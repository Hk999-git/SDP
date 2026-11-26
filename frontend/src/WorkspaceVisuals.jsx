import brandMark from "./assets/workspace-mark.svg";
import { isOverdue } from "./progressMetrics";

const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  tasks: "m3 7 2 2 4-4m3 3h9M3 15l2 2 4-4m3 3h9",
  board: "M3 4h18v16H3zM9 4v16m6-16v16",
  packages: "m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
  spark: "M12 2l2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z",
  team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-4a4 4 0 0 1 0 8",
  reports: "M3 3v18h18M8 16v-4m5 4V8m5 8V5",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2",
  alert: "M12 8v5m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  done: "m5 12 4 4L19 6",
  calendar: "M3 5h18v16H3zM3 10h18M8 3v4m8-4v4",
};

const dueDateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

export function Icon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function BrandMark() {
  return <img className="workspace-mark" src={brandMark} alt="" width="36" height="36" />;
}

export function Avatar({ name, role }) {
  const initials = name?.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return <span className="workload-avatar" data-role={role} aria-hidden="true" title={name}>{initials || "—"}</span>;
}

export function DueDate({ task, empty = "—" }) {
  if (!task.dueDate) return empty;
  const overdue = isOverdue(task);

  return (
    <span className="due-date" data-overdue={overdue}>
      <Icon name="calendar" />
      {overdue && "Overdue · "}
      <time dateTime={task.dueDate}>{dueDateFormat.format(new Date(task.dueDate + "T00:00:00Z"))}</time>
    </span>
  );
}
