package com.smartlearn.repository;

import com.smartlearn.entity.QuizAttempt;
import com.smartlearn.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {
    List<QuizAttempt> findByUserOrderByAttemptedAtDesc(User user);

    @Query("SELECT AVG(q.scorePercent) FROM QuizAttempt q WHERE q.user = :user")
    Double findAverageScoreByUser(User user);

    long countByUser(User user);
}