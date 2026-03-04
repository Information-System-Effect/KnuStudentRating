package com.max.pract.repo;

import com.max.pract.entity.CategoryTeacher;
import com.max.pract.entity.TeacherCategoryId;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface CategoryTeacherRepository extends JpaRepository<CategoryTeacher, TeacherCategoryId> {

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO Category_Teacher (teacher_id, category_id, grade) " + "VALUES (:tId, :cId, :amount) " + "ON DUPLICATE KEY UPDATE grade = LEAST(100, GREATEST(0, grade + :amount))", nativeQuery = true)
    void upsertTeacherGrade(@Param("tId") Integer teacherId, @Param("cId") Integer cId, @Param("amount") Float amount);

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO Category_Teacher (teacher_id, category_id, grade) " + "VALUES (:tId, :cId, :amount) " + "ON DUPLICATE KEY UPDATE grade = LEAST(100, GREATEST(0, :amount))", nativeQuery = true)
    void setTeacherGrade(@Param("tId") Integer teacherId, @Param("cId") Integer cId, @Param("amount") Float amount);
}
