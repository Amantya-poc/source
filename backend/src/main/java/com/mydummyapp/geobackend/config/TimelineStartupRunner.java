package com.mydummyapp.geobackend.config;

import com.mydummyapp.geobackend.repository.PlanRepository;
import com.mydummyapp.geobackend.service.TimelineService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class TimelineStartupRunner implements ApplicationRunner {

    private final PlanRepository planRepository;
    private final TimelineService timelineService;

    public TimelineStartupRunner(PlanRepository planRepository, TimelineService timelineService) {
        this.planRepository = planRepository;
        this.timelineService = timelineService;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (planRepository.count() > 0) {
            timelineService.recalculateFromPlans();
        }
    }
}
