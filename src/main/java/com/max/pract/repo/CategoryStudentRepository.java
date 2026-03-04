package com.max.pract.repo;


import com.max.pract.entity.CategoryStudent;
import com.max.pract.entity.StudentCategoryId;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;


@Repository
public interface CategoryStudentRepository extends JpaRepository<CategoryStudent, StudentCategoryId> {

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO Category_Student (student_id, category_id, grade) " + "VALUES (:sId, :cId, :amount) " + "ON DUPLICATE KEY UPDATE grade = LEAST(100, GREATEST(0, grade + :amount))", nativeQuery = true)
    void upsertStudentGrade(@Param("sId") Integer studentId, @Param("cId") Integer cId, @Param("amount") Float amount);

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO Category_Student (student_id, category_id, grade) " + "VALUES (:sId, :cId, :amount) " + "ON DUPLICATE KEY UPDATE grade = LEAST(100, GREATEST(0, :amount))", nativeQuery = true)
    void setStudentGrade(@Param("sId") Integer studentId, @Param("cId") Integer cId, @Param("amount") Float amount);
}
