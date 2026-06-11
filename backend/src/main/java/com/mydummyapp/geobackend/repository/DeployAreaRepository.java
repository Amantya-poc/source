package com.mydummyapp.geobackend.repository;

import com.mydummyapp.geobackend.entity.DeployAreaEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeployAreaRepository extends JpaRepository<DeployAreaEntity, Long> {

    List<DeployAreaEntity> findAllByOrderByCreatedAtAsc();

    Optional<DeployAreaEntity> findByAreaKey(String areaKey);

    void deleteByAreaKey(String areaKey);
}
