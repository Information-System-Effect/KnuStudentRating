package com.max.pract.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "Category_Teacher")
public class CategoryTeacher {

    @Getter
    @Setter
    @EmbeddedId
    private TeacherCategoryId id;

    @ManyToOne
    @MapsId("teacherId")
    @JoinColumn(name = "teacher_id")
    private Teacher teacher;

    @OneToOne
    @MapsId("categoryId")
    @JoinColumn(name = "category_id")
    private Category category;

    private Float grade;

}