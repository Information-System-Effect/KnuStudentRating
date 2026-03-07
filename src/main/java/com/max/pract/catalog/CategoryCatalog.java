package com.max.pract.catalog;

import java.util.List;
import java.util.Set;

public final class CategoryCatalog {

    public static final String AUDIENCE_STUDENT = "STUDENT";
    public static final String AUDIENCE_TEACHER = "TEACHER";
    public static final String DIMENSION_TECHNICAL = "TECHNICAL";
    public static final String DIMENSION_SUBJECTIVE = "SUBJECTIVE";

    public static final String TYPE_STUDENT_TECHNICAL = "STUDENT_TECHNICAL";
    public static final String TYPE_STUDENT_SUBJECTIVE = "STUDENT_SUBJECTIVE";
    public static final String TYPE_TEACHER_TECHNICAL = "TEACHER_TECHNICAL";
    public static final String TYPE_TEACHER_SUBJECTIVE = "TEACHER_SUBJECTIVE";

    // Student author can rate teamwork + shared subjective categories.
    public static final Set<String> STUDENT_SUBJECTIVE_ALLOWED_CODES = Set.of(
            "TEAMWORK",
            "COMMUNICATION",
            "RESPONSIBILITY",
            "INITIATIVE",
            "STUDENT_TEAMWORK",
            "STUDENT_COMMUNICATION",
            "STUDENT_RESPONSIBILITY",
            "STUDENT_INITIATIVE",
            "TEACHER_TEAMWORK",
            "TEACHER_COMMUNICATION",
            "TEACHER_RESPONSIBILITY",
            "TEACHER_INITIATIVE"
    );

    // Teacher author can rate system design + shared subjective categories.
    public static final Set<String> TEACHER_SUBJECTIVE_ALLOWED_CODES = Set.of(
            "SYSTEM_DESIGN",
            "COMMUNICATION",
            "RESPONSIBILITY",
            "INITIATIVE",
            "STUDENT_SYSTEM_DESIGN",
            "STUDENT_COMMUNICATION",
            "STUDENT_RESPONSIBILITY",
            "STUDENT_INITIATIVE",
            "TEACHER_SYSTEM_DESIGN",
            "TEACHER_COMMUNICATION",
            "TEACHER_RESPONSIBILITY",
            "TEACHER_INITIATIVE"
    );

    private CategoryCatalog() {
    }

    public static List<CategoryTypeDef> typeDefs() {
        return List.of(
                new CategoryTypeDef(TYPE_STUDENT_TECHNICAL, AUDIENCE_STUDENT, DIMENSION_TECHNICAL, "Student technical criteria"),
                new CategoryTypeDef(TYPE_STUDENT_SUBJECTIVE, AUDIENCE_STUDENT, DIMENSION_SUBJECTIVE, "Student subjective criteria"),
                new CategoryTypeDef(TYPE_TEACHER_TECHNICAL, AUDIENCE_TEACHER, DIMENSION_TECHNICAL, "Teacher technical criteria"),
                new CategoryTypeDef(TYPE_TEACHER_SUBJECTIVE, AUDIENCE_TEACHER, DIMENSION_SUBJECTIVE, "Teacher subjective criteria")
        );
    }

    public static List<CategoryDef> categoryDefs() {
        return List.of(
                // Student audience: technical.
                new CategoryDef("STUDENT_LANG_JAVA", "Java", "Knowledge of Java", TYPE_STUDENT_TECHNICAL, true),
                new CategoryDef("STUDENT_LANG_CPP_CSHARP", "C++ / C#", "Knowledge of C++ and C#", TYPE_STUDENT_TECHNICAL, true),
                new CategoryDef("STUDENT_LANG_PYTHON", "Python", "Knowledge of Python", TYPE_STUDENT_TECHNICAL, true),
                new CategoryDef("STUDENT_DB_MYSQL", "MySQL", "Knowledge of MySQL", TYPE_STUDENT_TECHNICAL, true),
                new CategoryDef("STUDENT_DB_POSTGRESQL", "PostgreSQL", "Knowledge of PostgreSQL", TYPE_STUDENT_TECHNICAL, true),
                new CategoryDef("STUDENT_OS_WINDOWS", "Windows", "Knowledge of Windows OS", TYPE_STUDENT_TECHNICAL, true),
                new CategoryDef("STUDENT_OS_LINUX", "Linux", "Knowledge of Linux OS", TYPE_STUDENT_TECHNICAL, true),
                new CategoryDef("STUDENT_TESTING", "Testing", "Ability to write and maintain tests", TYPE_STUDENT_TECHNICAL, true),
                new CategoryDef("STUDENT_PARADIGMS_ARCHITECTURE", "Paradigms and Architecture", "Programming paradigms and code architecture", TYPE_STUDENT_TECHNICAL, true),

                // Student audience: subjective.
                new CategoryDef("STUDENT_TEAMWORK", "Teamwork", "Ability to work in a team", TYPE_STUDENT_SUBJECTIVE, false),
                new CategoryDef("STUDENT_SYSTEM_DESIGN", "System Design", "Ability to design complex systems", TYPE_STUDENT_SUBJECTIVE, false),
                new CategoryDef("STUDENT_COMMUNICATION", "Communication", "Communication and discussion quality", TYPE_STUDENT_SUBJECTIVE, false),
                new CategoryDef("STUDENT_RESPONSIBILITY", "Responsibility", "Responsibility and deadlines discipline", TYPE_STUDENT_SUBJECTIVE, false),
                new CategoryDef("STUDENT_INITIATIVE", "Initiative", "Initiative and proactivity", TYPE_STUDENT_SUBJECTIVE, false),

                // Teacher audience: technical.
                new CategoryDef("TEACHER_LANG_JAVA", "Java", "Knowledge of Java", TYPE_TEACHER_TECHNICAL, true),
                new CategoryDef("TEACHER_LANG_CPP_CSHARP", "C++ / C#", "Knowledge of C++ and C#", TYPE_TEACHER_TECHNICAL, true),
                new CategoryDef("TEACHER_LANG_PYTHON", "Python", "Knowledge of Python", TYPE_TEACHER_TECHNICAL, true),
                new CategoryDef("TEACHER_DB_MYSQL", "MySQL", "Knowledge of MySQL", TYPE_TEACHER_TECHNICAL, true),
                new CategoryDef("TEACHER_DB_POSTGRESQL", "PostgreSQL", "Knowledge of PostgreSQL", TYPE_TEACHER_TECHNICAL, true),
                new CategoryDef("TEACHER_OS_WINDOWS", "Windows", "Knowledge of Windows OS", TYPE_TEACHER_TECHNICAL, true),
                new CategoryDef("TEACHER_OS_LINUX", "Linux", "Knowledge of Linux OS", TYPE_TEACHER_TECHNICAL, true),
                new CategoryDef("TEACHER_TESTING", "Testing", "Ability to write and maintain tests", TYPE_TEACHER_TECHNICAL, true),
                new CategoryDef("TEACHER_PARADIGMS_ARCHITECTURE", "Paradigms and Architecture", "Programming paradigms and code architecture", TYPE_TEACHER_TECHNICAL, true),

                // Teacher audience: subjective.
                new CategoryDef("TEACHER_TEAMWORK", "Teamwork", "Ability to work in a team", TYPE_TEACHER_SUBJECTIVE, false),
                new CategoryDef("TEACHER_SYSTEM_DESIGN", "System Design", "Ability to design complex systems", TYPE_TEACHER_SUBJECTIVE, false),
                new CategoryDef("TEACHER_COMMUNICATION", "Communication", "Communication and discussion quality", TYPE_TEACHER_SUBJECTIVE, false),
                new CategoryDef("TEACHER_RESPONSIBILITY", "Responsibility", "Responsibility and deadlines discipline", TYPE_TEACHER_SUBJECTIVE, false),
                new CategoryDef("TEACHER_INITIATIVE", "Initiative", "Initiative and proactivity", TYPE_TEACHER_SUBJECTIVE, false)
        );
    }

    public record CategoryTypeDef(String code, String audience, String dimension, String description) {
    }

    public record CategoryDef(
            String code,
            String name,
            String description,
            String typeCode,
            boolean selfDeclaredAllowed
    ) {
    }
}
