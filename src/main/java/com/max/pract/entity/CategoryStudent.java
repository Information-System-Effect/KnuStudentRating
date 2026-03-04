package com.max.pract.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "Category_Student")
public class CategoryStudent {

    @Getter
    @Setter
    @EmbeddedId
    private StudentCategoryId id;

    @ManyToOne
    @MapsId("studentId")
    @JoinColumn(name = "student_id")
    private Student student;

    @OneToOne
    @MapsId("categoryId")
    @JoinColumn(name = "category_id")
    private Category category;

    private Float grade;

}