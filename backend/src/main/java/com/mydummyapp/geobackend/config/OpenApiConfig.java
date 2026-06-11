package com.mydummyapp.geobackend.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI geoBackendOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("DRDO POC Plans API")
                        .description("REST API for saving mission plans and loading the output dashboard.")
                        .version("1.0.0")
                        .contact(new Contact().name("geo-backend")));
    }
}
