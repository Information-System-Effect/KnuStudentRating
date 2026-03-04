package com.max.pract.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "Category")
@Getter
@Setter
public class  Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "name", unique = true, nullable = false)
    private String name;

    @Column(name = "des")
    private String des;

}