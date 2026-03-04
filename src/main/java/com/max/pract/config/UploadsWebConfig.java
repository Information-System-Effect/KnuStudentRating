package com.max.pract.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

@Configuration
public class UploadsWebConfig implements WebMvcConfigurer {

    private final String uploadsLocation;

    public UploadsWebConfig(@Value("${app.uploads.dir:uploads}") String uploadsDir) {
        this.uploadsLocation = Path.of(uploadsDir).toAbsolutePath().normalize().toUri().toString();
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(uploadsLocation + "/");
    }
}
