import { useEffect, useState } from "react";
import { calculateProgress, calendarDate, offsetDate } from "./progressMetrics";
import { taskStatuses } from "./taskStatuses";
import { TaskTable } from "./WorkspaceHome";

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const monthDay = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "short", day: "numeric" });
const dateLabel = (date) => monthDay.format(new Date(date + "T00:00:00Z"));
const pointLabel = ({ date, opening }) => dateLabel(date) + (opening ? " start" : "");
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function BurndownChart({ points }) {
  if (points.length === 0) return <p>No tracked data for this date range.</p>;

  const left = 50;
  const right = 740;
  const top = 20;
  const bottom = 175;
  const max = Math.max(1, ...points.map(({ open }) => open));
  const x = (index) => points.length === 1 ? left : left + (right - left) * index / (points.length - 1);
  const y = (open) => bottom - (bottom - top) * open / max;
  const labels = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);

  return (
    <>
      <svg className="burndown-chart" viewBox="0 0 775 216" role="img" aria-label="Daily open tasks">
        <title>Daily open tasks</title>
        {[...new Set([0, Math.round(max / 2), max])].map((value) => (
          <g key={value}>
            <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#dce3ee" />
            <text x={left - 9} y={y(value) + 4} textAnchor="end">{number.format(value)}</text>
          </g>
        ))}
        {points.length > 1 && (
          <polyline fill="none" stroke="#4f46e5" strokeWidth="3"
            points={points.map(({ open }, index) => x(index) + "," + y(open)).join(" ")} />
        )}
        {points.map((point, index) => (
          <g key={point.date + point.opening}>
            <circle cx={x(index)} cy={y(point.open)} r="3.5" fill="#4f46e5">
              <title>{pointLabel(point)} · {point.open} open tasks</title>
            </circle>
            {labels.has(index) && <text x={x(index)} y="201" textAnchor="middle">{pointLabel(point)}</text>}
          </g>
        ))}
      </svg>
      <details className="report-data">
        <summary>Daily values</summary>
        <table>
          <thead><tr><th>Date</th><th>Open tasks</th></tr></thead>
          <tbody>{points.map((point) => (
            <tr key={point.date + point.opening}><td>{pointLabel(point)}</td><td>{point.open}</td></tr>
          ))}</tbody>
        </table>
      </details>
    </>
  );
}

function CompletionReport({ tasks, requirements }) {
  const [selectedStatus, setSelectedStatus] = useState("");
  const done = tasks.filter(({ status }) => status === "DONE").length;
  const percent = tasks.length ? Math.round(100 * done / tasks.length) : 0;
  const projects = new Map(requirements.map(({ id, projectName }) => [id, projectName]));
  return (
    <section className="panel completion-report" aria-label="Current task completion">
      <h2>Current task completion</h2>
      <div className="completion-summary">
        <div className="completion-ring" style={{ "--completion": percent + "%" }} aria-hidden="true">
          <div><strong>{percent}%</strong><span>complete</span></div>
        </div>
        <div className="report-breakdown">
          <p>{done} of {tasks.length} tasks complete</p>
          {taskStatuses.map(({ status, label, color }) => (
            <button type="button" key={status} aria-pressed={status === selectedStatus} style={{ "--status-color": color }}
              onClick={() => setSelectedStatus((current) => current === status ? "" : status)}>
              <span>{label}</span><strong>{tasks.filter((task) => task.status === status).length}</strong>
            </button>
          ))}
        </div>
      </div>
      {selectedStatus && (
        <TaskTable tasks={tasks.filter(({ status }) => status === selectedStatus)} projects={projects} />
      )}
    </section>
  );
}

export default function ProgressReports({ items, requirements, workItemsUrl, requestJson }) {
  const today = calendarDate();
  const [start, setStart] = useState(() => offsetDate(today, -13));
  const [end, setEnd] = useState(today);
  const [requirementId, setRequirementId] = useState("");
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    requestJson(workItemsUrl + "/status-history", { signal: controller.signal })
      .then((events) => { if (!controller.signal.aborted) setHistory(events); })
      .catch((error) => { if (!controller.signal.aborted) setHistoryError(error.message); });
    return () => controller.abort();
  }, [workItemsUrl, requestJson, retry]);

  const scopedItems = items.filter((item) => !requirementId || String(item.requirementId) === requirementId);
  const report = history && datePattern.test(start) && datePattern.test(end) && start <= end && end <= today
    ? calculateProgress(scopedItems, history, start, end, today)
    : null;

  return (
    <div className="reports-view">
      <div className="panel report-filters">
        <div className="requirement-picker">
          <label htmlFor="reportRequirement">Requirement</label>
          <select id="reportRequirement" value={requirementId} onChange={(event) => setRequirementId(event.target.value)}>
            <option value="">All saved requirements</option>
            {requirements.map((item) => (
              <option key={item.id} value={String(item.id)}>#{item.id} — {item.projectName}</option>
            ))}
          </select>
        </div>
        <div><label htmlFor="reportFrom">From</label><input id="reportFrom" type="date" max={end || today} value={start} onChange={(event) => setStart(event.target.value)} /></div>
        <div><label htmlFor="reportTo">Through</label><input id="reportTo" type="date" min={start || undefined} max={today} value={end} onChange={(event) => setEnd(event.target.value)} /></div>
      </div>

      <CompletionReport tasks={scopedItems.filter(({ type }) => type === "TASK")} requirements={requirements} />
      {!history && !historyError && <p role="status">Loading progress…</p>}
      {historyError && (
        <div role="alert">
          <p>{historyError}</p>
          <button type="button" onClick={() => { setHistoryError(""); setRetry((count) => count + 1); }}>Retry</button>
        </div>
      )}
      {history && !report && <p>Choose a valid date range.</p>}
      {report && (
        <section className="panel" aria-label="Burndown">
          <h2>Burndown <span className="section-count">Open tasks by day</span></h2>
          <BurndownChart points={report.points} />
          <p className="report-note">Based on recorded status changes. Tasks closed before tracking began have no recorded closure date.</p>
        </section>
      )}
    </div>
  );
}
