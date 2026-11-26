import { Icon } from "./WorkspaceVisuals";

export default function DraftPreview({ analysis, onEdit, editable, disabled, children }) {
  function titleField(value, path, label) {
    return (
      <label>{label}
        <input value={value} maxLength={255} required disabled={disabled}
          aria-invalid={!value.trim()} onChange={(event) => onEdit(path, event.target.value)} />
      </label>
    );
  }

  return (
    <section className="panel draft-panel" aria-labelledby="draft-heading">
      <div className="section-heading">
        <h2 id="draft-heading"><Icon name="spark" /> Review AI draft</h2>
        <span className="section-count">{analysis.epics.length} epics</span>
      </div>
      {analysis.epics.length === 0 && <p>No epics were generated.</p>}
      {analysis.epics.map((epic, epicIndex) => {
        const epicPath = ["epics", epicIndex];
        return (
          <details key={epicIndex} className="generated-epic" open={epicIndex === 0 || undefined}>
            <summary><span className="hierarchy-tag">Epic</span> {epic.title || "Untitled epic"}</summary>
            {editable && titleField(epic.title, [...epicPath, "title"], "Epic title")}
            {epic.stories.map((story, storyIndex) => {
              const storyPath = [...epicPath, "stories", storyIndex];
              const criteria = story.acceptanceCriteria ?? [];
              const tasks = story.tasks ?? [];
              return (
                <details key={storyIndex} className="generated-story">
                  <summary><span className="hierarchy-tag">Story</span> {story.title || "Untitled story"}</summary>
                  {editable ? (
                    <>
                      {titleField(story.title, [...storyPath, "title"], "Story title")}
                      <label>Story description
                        <textarea rows={3} value={story.description ?? ""} disabled={disabled}
                          onChange={(event) => onEdit([...storyPath, "description"], event.target.value)} />
                      </label>
                    </>
                  ) : story.description && <p className="preserve-text">{story.description}</p>}
                  {editable ? (
                    <label>Acceptance criteria (one per line)
                      <textarea rows={3} value={criteria.join("\n")} disabled={disabled}
                        onChange={(event) => onEdit([...storyPath, "acceptanceCriteria"], event.target.value.split("\n"))} />
                    </label>
                  ) : criteria.length > 0 && (
                    <><h4>Acceptance criteria</h4><ul>{criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul></>
                  )}
                  {tasks.map((task, taskIndex) => {
                    const taskPath = [...storyPath, "tasks", taskIndex];
                    return (
                      <details key={taskIndex} className="generated-task">
                        <summary><span className="hierarchy-tag">Task</span> {task.title || "Untitled task"}</summary>
                        {editable ? (
                          <>
                            {titleField(task.title, [...taskPath, "title"], "Task title")}
                            <label>Task description
                              <textarea rows={2} value={task.description ?? ""} disabled={disabled}
                                onChange={(event) => onEdit([...taskPath, "description"], event.target.value)} />
                            </label>
                          </>
                        ) : task.description && <p className="preserve-text">{task.description}</p>}
                        {task.assigneeName && <p>Suggested assignee: {task.assigneeName}</p>}
                      </details>
                    );
                  })}
                </details>
              );
            })}
          </details>
        );
      })}
      {analysis.clarificationQuestions?.length > 0 && (
        <section className="draft-questions">
          <h3>Clarification questions</h3>
          <ul>{analysis.clarificationQuestions.map((question, index) => <li key={index}>{question}</li>)}</ul>
        </section>
      )}
      {children}
    </section>
  );
}
