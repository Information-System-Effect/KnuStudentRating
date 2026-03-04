package com.max.pract.config;

import com.max.pract.catalog.CategoryCatalog;
import com.max.pract.catalog.CategoryCatalog.CategoryDef;
import com.max.pract.catalog.CategoryCatalog.CategoryTypeDef;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class CategoryCatalogBootstrap implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CategoryCatalogBootstrap.class);

    private final JdbcTemplate jdbcTemplate;

    public CategoryCatalogBootstrap(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public void run(String... args) {
        try {
            bootstrapCategoryTypes();
            bootstrapCategories();
        } catch (BadSqlGrammarException ex) {
            // Allows local boot even if schema is not yet created.
            log.warn("Category bootstrap skipped because schema is not ready: {}", ex.getMessage());
        }
    }

    private void bootstrapCategoryTypes() {
        for (CategoryTypeDef type : CategoryCatalog.typeDefs()) {
            jdbcTemplate.update(
                    """
                            INSERT INTO category_types(code, audience, dimension, description)
                            VALUES (?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE
                                audience = VALUES(audience),
                                dimension = VALUES(dimension),
                                description = VALUES(description)
                            """,
                    type.code(),
                    type.audience(),
                    type.dimension(),
                    type.description()
            );
        }
    }

    private void bootstrapCategories() {
        for (CategoryDef category : CategoryCatalog.categoryDefs()) {
            Long typeId = jdbcTemplate.queryForObject(
                    "SELECT id FROM category_types WHERE code = ? LIMIT 1",
                    Long.class,
                    category.typeCode()
            );
            if (typeId == null) {
                throw new IllegalStateException("Category type was not bootstrapped: " + category.typeCode());
            }

            jdbcTemplate.update(
                    """
                            INSERT INTO categories(code, name, description, category_type_id, self_declared_allowed)
                            VALUES (?, ?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE
                                name = VALUES(name),
                                description = VALUES(description),
                                category_type_id = VALUES(category_type_id),
                                self_declared_allowed = VALUES(self_declared_allowed)
                            """,
                    category.code(),
                    category.name(),
                    category.description(),
                    typeId,
                    category.selfDeclaredAllowed()
            );
        }
    }
}
