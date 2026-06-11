package com.mydummyapp.geobackend.service;

import com.mydummyapp.geobackend.entity.PlanEntity;
import com.mydummyapp.geobackend.entity.TimelineSettingsEntity;
import com.mydummyapp.geobackend.model.TimelineSettingsDto;
import com.mydummyapp.geobackend.repository.PlanRepository;
import com.mydummyapp.geobackend.repository.TimelineSettingsRepository;
import com.mydummyapp.geobackend.util.PlanTimelineUtil;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TimelineService {

    private final PlanRepository planRepository;
    private final TimelineSettingsRepository timelineSettingsRepository;

    public TimelineService(
            PlanRepository planRepository, TimelineSettingsRepository timelineSettingsRepository) {
        this.planRepository = planRepository;
        this.timelineSettingsRepository = timelineSettingsRepository;
    }

    @Transactional(readOnly = true)
    public TimelineSettingsDto getTimelineSettings() {
        return timelineSettingsRepository
                .findById(1L)
                .map(this::toDto)
                .orElse(new TimelineSettingsDto(null, null));
    }

    @Transactional
    public TimelineSettingsDto recalculateFromPlans() {
        List<PlanEntity> plans = planRepository.findAllByOrderBySortOrderAsc();

        if (plans.isEmpty()) {
            timelineSettingsRepository.deleteAll();
            return new TimelineSettingsDto(null, null);
        }

        Instant sliderStart = plans.stream()
                .map(PlanEntity::getStartingDate)
                .min(Comparator.naturalOrder())
                .orElseThrow();

        Instant sliderEnd = plans.stream()
                .map(plan -> PlanTimelineUtil.planEndTime(
                        plan.getStartingDate(), plan.getDistanceMeters(), plan.getSpeed()))
                .max(Comparator.naturalOrder())
                .orElseThrow();

        TimelineSettingsEntity entity = timelineSettingsRepository
                .findById(1L)
                .orElseGet(TimelineSettingsEntity::new);
        entity.setId(1L);
        entity.setSliderStartTime(sliderStart);
        entity.setSliderEndTime(sliderEnd);

        return toDto(timelineSettingsRepository.save(entity));
    }

    private TimelineSettingsDto toDto(TimelineSettingsEntity entity) {
        return new TimelineSettingsDto(entity.getSliderStartTime(), entity.getSliderEndTime());
    }
}
