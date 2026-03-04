package com.max.pract.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class StudentCategoryId implements Serializable {

    @Getter
    @Setter
    private Integer studentId;
    private Integer categoryId;

    public StudentCategoryId() {}

    public StudentCategoryId(Integer studentId, Integer categoryId) {
        this.studentId = studentId;
        this.categoryId = categoryId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        StudentCategoryId that = (StudentCategoryId) o;
        return Objects.equals(studentId, that.studentId) && Objects.equals(categoryId, that.categoryId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(studentId, categoryId);
    }
}