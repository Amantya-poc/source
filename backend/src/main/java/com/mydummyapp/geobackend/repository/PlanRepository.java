package com.mydummyapp.geobackend.repository;

import com.mydummyapp.geobackend.entity.PlanEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanRepository extends JpaRepository<PlanEntity, Long> {

    List<PlanEntity> findAllByOrderBySortOrderAsc();
}
