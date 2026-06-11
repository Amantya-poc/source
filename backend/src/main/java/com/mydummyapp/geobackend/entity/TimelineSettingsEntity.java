package com.mydummyapp.geobackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "timeline_settings", schema = "public")
public class TimelineSettingsEntity {

    @Id
    private Long id = 1L;

    @Column(name = "slider_start_time")
    private Instant sliderStartTime;

    @Column(name = "slider_end_time")
    private Instant sliderEndTime;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touchUpdatedAt() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Instant getSliderStartTime() {
        return sliderStartTime;
    }

    public void setSliderStartTime(Instant sliderStartTime) {
        this.sliderStartTime = sliderStartTime;
    }

    public Instant getSliderEndTime() {
        return sliderEndTime;
    }

    public void setSliderEndTime(Instant sliderEndTime) {
        this.sliderEndTime = sliderEndTime;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
