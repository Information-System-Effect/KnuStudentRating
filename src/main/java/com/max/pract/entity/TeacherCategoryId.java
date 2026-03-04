package com.max.pract.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class TeacherCategoryId implements Serializable {

    @Getter
    @Setter
    private Integer teacherId;
    private Integer categoryId;

    public TeacherCategoryId() {}

    public TeacherCategoryId(Integer teacherId, Integer categoryId) {
        this.teacherId = teacherId;
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
        TeacherCategoryId that = (TeacherCategoryId) o;
        return Objects.equals(teacherId, that.teacherId) && Objects.equals(categoryId, that.categoryId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(teacherId, categoryId);
    }
}