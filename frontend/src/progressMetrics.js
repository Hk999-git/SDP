export function calendarDate(value = new Date()) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export function isOverdue(task, today = calendarDate()) {
  return Boolean(task.dueDate && task.dueDate < today && task.status !== "DONE");
}

export function offsetDate(date, days) {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function calculateProgress(items, history, start, end, today) {
  const tasks = items.filter((item) => item.type === "TASK");
  const eventsByTask = new Map(tasks.map((task) => [task.id, []]));
  let firstTrackedDate = today;

  for (const event of history) {
    const events = eventsByTask.get(event.taskId);
    if (!events) continue;
    const date = calendarDate(new Date(event.changedAt));
    if (date < firstTrackedDate) firstTrackedDate = date;
    events.push({ ...event, date });
  }

  const trackedTasks = tasks.map((task) => {
    const created = task.createdAt ? calendarDate(new Date(task.createdAt)) : null;
    if (created && created < firstTrackedDate) firstTrackedDate = created;
    return { task, created, events: eventsByTask.get(task.id) };
  });

  function remaining(date, opening = false) {
    const day = opening ? offsetDate(date, -1) : date;
    let open = 0;
    for (const { task, created, events } of trackedTasks) {
      if (created && created > day) continue;
      const latest = events.findLast((event) => event.date <= day);
      const status = latest?.status ?? events[0]?.previousStatus ?? task.status;
      if (status !== "DONE") open += 1;
    }
    return { date, opening, open };
  }

  const firstDate = start < firstTrackedDate ? firstTrackedDate : start;
  const points = [];
  if (firstDate <= end) points.push(remaining(firstDate, true));
  for (let date = firstDate; date <= end; date = offsetDate(date, 1)) {
    points.push(remaining(date));
  }

  return { points };
}
