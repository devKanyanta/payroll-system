package com.payroll.scheduler;

import com.payroll.service.PpeRequestService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodically checks PPE requests whose due date has arrived and marks them ELIGIBLE,
 * notifying admins (email + in-app notification) for each newly due request.
 */
@Component
@RequiredArgsConstructor
public class PpeDueDateScheduler {

    private static final Logger log = LoggerFactory.getLogger(PpeDueDateScheduler.class);

    private final PpeRequestService ppeRequestService;

    /** Runs shortly after midnight every day. */
    @Scheduled(cron = "0 5 0 * * *")
    public void processDuePpeRequestsDaily() {
        int count = ppeRequestService.processDuePpeRequests();
        if (count > 0) {
            log.info("PPE due-date check: {} request(s) marked ELIGIBLE", count);
        }
    }

    /** Catch up on any overdue requests right after the application starts. */
    @EventListener(ApplicationReadyEvent.class)
    public void processDuePpeRequestsOnStartup() {
        log.info("Running PPE due-date catch-up after startup");
        processDuePpeRequestsDaily();
    }
}
