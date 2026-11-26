package com.hari.aiprojectmanager;

import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

@Service
class TaskNotifications {
    private static final Logger log = LoggerFactory.getLogger(TaskNotifications.class);
    private static final Duration RETRY_DELAY = Duration.ofMinutes(5);

    private final TaskEmailRepository emails;
    private final WorkItemRepository tasks;
    private final ObjectProvider<JavaMailSender> mailSender;
    private final TransactionTemplate transactions;
    private final Environment environment;
    private final String from;
    private final String appUrl;
    private final ZoneId zone;

    TaskNotifications(TaskEmailRepository emails, WorkItemRepository tasks,
                      ObjectProvider<JavaMailSender> mailSender, TransactionTemplate transactions,
                      Environment environment, @Value("${app.mail.from:}") String from,
                      @Value("${app.public-url:http://localhost:5173}") String appUrl,
                      @Value("${app.mail.zone:Europe/Berlin}") String zone) {
        this.emails = emails;
        this.tasks = tasks;
        this.mailSender = mailSender;
        this.transactions = transactions;
        this.environment = environment;
        this.from = address(from);
        this.appUrl = appUrl.replaceAll("/+$", "");
        this.zone = ZoneId.of(zone);
    }

    // Called inside the comment transaction so a rolled-back comment cannot send mail.
    void queueComment(WorkItem task, TaskComment comment) {
        TeamMember assignee = task.getAssignee();
        if (from != null && assignee != null && assignee != comment.author() && recipientAddress(assignee) != null) {
            emails.save(new TaskEmail("comment:" + comment.id(), TaskEmail.Kind.COMMENT, task,
                    comment.author().profile().name(), null));
        }
    }

    @Scheduled(fixedDelayString = "${app.mail.poll-ms:30000}", initialDelayString = "${app.mail.poll-ms:30000}")
    void deliverPending() {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null || from == null) return;

        LocalDate today = LocalDate.now(zone);
        for (Long id : tasks.findOverdueIds(WorkItem.Type.TASK, WorkItem.Status.DONE, today)) {
            transactions.executeWithoutResult(status -> tasks.findForUpdateById(id)
                    .ifPresent(task -> queueOverdue(task, today)));
        }

        for (Long id : emails.findReadyIds(Instant.now())) {
            TaskEmail email = transactions.execute(status -> claimEmail(id, today));
            if (email == null) continue;
            try {
                sender.send(messageFor(email));
                transactions.executeWithoutResult(status -> emails.findForUpdateById(email.id())
                        .ifPresent(sent -> sent.markSent(Instant.now())));
            } catch (MailException error) {
                log.warn("Task email {} failed ({}); it will be retried.", email.id(), error.getClass().getSimpleName());
            }
        }
    }

    private void queueOverdue(WorkItem task, LocalDate today) {
        if (!isOverdue(task, today) || recipientAddress(task.getAssignee()) == null) return;
        String key = "overdue:" + task.getId() + ":" + task.getAssignee().name() + ":" + task.getDueDate();
        if (!emails.existsByEventKey(key)) {
            emails.save(new TaskEmail(key, TaskEmail.Kind.OVERDUE, task, null, task.getDueDate()));
        }
    }

    private TaskEmail claimEmail(Long id, LocalDate today) {
        var email = emails.findForUpdateById(id).orElse(null);
        Instant now = Instant.now();
        if (email == null || !email.readyAt(now)) return null;
        if (email.kind() == TaskEmail.Kind.OVERDUE) {
            var task = tasks.findById(email.taskId()).orElse(null);
            if (task == null || !isOverdue(task, today) || task.getAssignee() != email.recipient()
                    || !email.dueDate().equals(task.getDueDate())) {
                emails.delete(email);
                return null;
            }
        }

        // Lease the row before SMTP so two workers do not send it concurrently.
        email.retryAt(now.plus(RETRY_DELAY));
        return recipientAddress(email.recipient()) == null ? null : email;
    }

    private boolean isOverdue(WorkItem task, LocalDate today) {
        return task.getStatus() != WorkItem.Status.DONE && task.getAssignee() != null
                && task.getDueDate() != null && task.getDueDate().isBefore(today);
    }

    private SimpleMailMessage messageFor(TaskEmail email) {
        var message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(recipientAddress(email.recipient()));
        String task = "Task #" + email.taskId() + ": " + email.taskTitle();
        String link = appUrl + "/#task/" + email.taskId();
        if (email.kind() == TaskEmail.Kind.COMMENT) {
            message.setSubject("New comment on task #" + email.taskId());
            message.setText(email.commentAuthor() + " commented on your assigned task.\n\n" + task + "\n" + link);
        } else {
            message.setSubject("Overdue task #" + email.taskId());
            message.setText("Your assigned task is overdue.\n\n" + task + "\nDue date: " + email.dueDate() + "\n" + link);
        }
        return message;
    }

    private String recipientAddress(TeamMember member) {
        return address(environment.getProperty("APP_EMAIL_" + member.name(), ""));
    }

    private static String address(String value) {
        if (value.isBlank()) return null;
        try {
            var address = new InternetAddress(value.strip(), true);
            address.validate();
            return address.getAddress();
        } catch (AddressException error) {
            return null;
        }
    }
}
