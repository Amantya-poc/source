package com.mydummyapp.geobackend.controller;

import com.mydummyapp.geobackend.model.CreateDeployAreaRequest;
import com.mydummyapp.geobackend.model.DeployAreaDto;
import com.mydummyapp.geobackend.model.UpdateDeployAreaRequest;
import com.mydummyapp.geobackend.service.DeployAreaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/deploy-areas")
@CrossOrigin(origins = "http://localhost:4200")
@Tag(name = "Deploy Areas", description = "Create, list, update, and delete deploy ellipses stored in drdo_poc")
public class DeployAreaController {

    private final DeployAreaService deployAreaService;

    public DeployAreaController(DeployAreaService deployAreaService) {
        this.deployAreaService = deployAreaService;
    }

    @GetMapping
    @Operation(summary = "List all deploy areas", description = "Returns every saved deploy ellipse ordered by creation time.")
    @ApiResponse(responseCode = "200", description = "Deploy areas returned successfully")
    public List<DeployAreaDto> listDeployAreas() {
        return deployAreaService.listDeployAreas();
    }

    @PostMapping
    @Operation(summary = "Save a deploy area", description = "Persists a deploy ellipse to PostgreSQL.")
    @ApiResponse(responseCode = "200", description = "Deploy area created successfully")
    @ApiResponse(responseCode = "409", description = "Deploy area id already exists")
    public DeployAreaDto createDeployArea(@RequestBody CreateDeployAreaRequest request) {
        return deployAreaService.createDeployArea(request);
    }

    @PutMapping("/{areaKey}")
    @Operation(summary = "Update a deploy area", description = "Updates ellipse geometry after move, resize, or reshape.")
    @ApiResponse(responseCode = "200", description = "Deploy area updated successfully")
    @ApiResponse(responseCode = "404", description = "Deploy area not found")
    public DeployAreaDto updateDeployArea(
            @PathVariable String areaKey, @RequestBody UpdateDeployAreaRequest request) {
        return deployAreaService.updateDeployArea(areaKey, request);
    }

    @DeleteMapping("/{areaKey}")
    @Operation(summary = "Delete a deploy area", description = "Removes a deploy ellipse from the database.")
    @ApiResponse(responseCode = "200", description = "Deploy area deleted")
    @ApiResponse(responseCode = "404", description = "Deploy area not found")
    public void deleteDeployArea(@PathVariable String areaKey) {
        deployAreaService.deleteDeployArea(areaKey);
    }
}
