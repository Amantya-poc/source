package com.mydummyapp.geobackend.entity;

import com.mydummyapp.geobackend.model.WaypointDto;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "plans", schema = "public")
public class PlanEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plan_key", nullable = false, unique = true, length = 32)
    private String planKey;

    @Column(name = "plane_name", nullable = false)
    private String planeName;

    @Column(nullable = false)
    private double speed;

    @Column(name = "starting_date", nullable = false)
    private Instant startingDate;

    @Column(name = "marker_shape", nullable = false, length = 20)
    private String markerShape;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "route_waypoints", nullable = false, columnDefinition = "jsonb")
    private List<WaypointDto> routeWaypoints = new ArrayList<>();

    @Column(name = "distance_meters", nullable = false)
    private double distanceMeters;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getPlanKey() {
        return planKey;
    }

    public void setPlanKey(String planKey) {
        this.planKey = planKey;
    }

    public String getPlaneName() {
        return planeName;
    }

    public void setPlaneName(String planeName) {
        this.planeName = planeName;
    }

    public double getSpeed() {
        return speed;
    }

    public void setSpeed(double speed) {
        this.speed = speed;
    }

    public Instant getStartingDate() {
        return startingDate;
    }

    public void setStartingDate(Instant startingDate) {
        this.startingDate = startingDate;
    }

    public String getMarkerShape() {
        return markerShape;
    }

    public void setMarkerShape(String markerShape) {
        this.markerShape = markerShape;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public List<WaypointDto> getRouteWaypoints() {
        return routeWaypoints;
    }

    public void setRouteWaypoints(List<WaypointDto> routeWaypoints) {
        this.routeWaypoints = routeWaypoints;
    }

    public double getDistanceMeters() {
        return distanceMeters;
    }

    public void setDistanceMeters(double distanceMeters) {
        this.distanceMeters = distanceMeters;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
