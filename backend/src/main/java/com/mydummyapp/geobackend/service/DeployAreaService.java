package com.mydummyapp.geobackend.service;

import com.mydummyapp.geobackend.entity.DeployAreaEntity;
import com.mydummyapp.geobackend.model.CreateDeployAreaRequest;
import com.mydummyapp.geobackend.model.DeployAreaDto;
import com.mydummyapp.geobackend.model.UpdateDeployAreaRequest;
import com.mydummyapp.geobackend.repository.DeployAreaRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DeployAreaService {

    private final DeployAreaRepository deployAreaRepository;

    public DeployAreaService(DeployAreaRepository deployAreaRepository) {
        this.deployAreaRepository = deployAreaRepository;
    }

    @Transactional(readOnly = true)
    public List<DeployAreaDto> listDeployAreas() {
        return deployAreaRepository.findAllByOrderByCreatedAtAsc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public DeployAreaDto createDeployArea(CreateDeployAreaRequest request) {
        validateCreateRequest(request);

        if (deployAreaRepository.findByAreaKey(request.id()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Deploy area already exists: " + request.id());
        }

        DeployAreaEntity entity = new DeployAreaEntity();
        entity.setAreaKey(request.id());
        entity.setLongitude(request.longitude());
        entity.setLatitude(request.latitude());
        entity.setRadiusX(request.radiusX());
        entity.setRadiusY(request.radiusY());
        entity.setRotation(request.rotation());
        entity.setVertices(request.vertices());

        return toDto(deployAreaRepository.save(entity));
    }

    @Transactional
    public DeployAreaDto updateDeployArea(String areaKey, UpdateDeployAreaRequest request) {
        DeployAreaEntity entity = deployAreaRepository
                .findByAreaKey(areaKey)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Deploy area not found"));

        entity.setLongitude(request.longitude());
        entity.setLatitude(request.latitude());
        entity.setRadiusX(request.radiusX());
        entity.setRadiusY(request.radiusY());
        entity.setRotation(request.rotation());
        if (request.vertices() != null) {
            entity.setVertices(request.vertices());
        }

        return toDto(deployAreaRepository.save(entity));
    }

    @Transactional
    public void deleteDeployArea(String areaKey) {
        if (!deployAreaRepository.findByAreaKey(areaKey).isPresent()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Deploy area not found");
        }
        deployAreaRepository.deleteByAreaKey(areaKey);
    }

    private DeployAreaDto toDto(DeployAreaEntity entity) {
        return new DeployAreaDto(
                entity.getAreaKey(),
                entity.getLongitude(),
                entity.getLatitude(),
                entity.getRadiusX(),
                entity.getRadiusY(),
                entity.getRotation(),
                entity.getVertices());
    }

    private void validateCreateRequest(CreateDeployAreaRequest request) {
        if (request.id() == null || request.id().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "id is required");
        }

        if (request.radiusX() <= 0 || request.radiusY() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "radiusX and radiusY must be greater than 0");
        }
    }
}
