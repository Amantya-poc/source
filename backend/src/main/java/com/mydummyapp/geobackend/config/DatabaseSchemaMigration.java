package com.mydummyapp.geobackend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseSchemaMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseSchemaMigration.class);

    private final JdbcTemplate jdbcTemplate;

    public DatabaseSchemaMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.execute(
                """
                ALTER TABLE public.plans
                ADD COLUMN IF NOT EXISTS distance_meters DOUBLE PRECISION NOT NULL DEFAULT 0
                """);
        log.info("Ensured public.plans.distance_meters column exists");

        jdbcTemplate.execute(
                """
                CREATE TABLE IF NOT EXISTS public.timeline_settings (
                    id BIGINT PRIMARY KEY,
                    slider_start_time TIMESTAMPTZ,
                    slider_end_time TIMESTAMPTZ,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute(
                """
                INSERT INTO public.timeline_settings (id, updated_at)
                VALUES (1, NOW())
                ON CONFLICT (id) DO NOTHING
                """);
        log.info("Ensured public.timeline_settings table exists");
    }
}
