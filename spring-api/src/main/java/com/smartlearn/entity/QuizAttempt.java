package com.smartlearn.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "quiz_attempts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuizAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id")
    private Document document;

    private Integer totalQuestions;
    private Integer correctAnswers;
    private Double scorePercent;

    @Column(columnDefinition = "TEXT")
    private String quizJson;

    private LocalDateTime attemptedAt;

    @PrePersist
    public void prePersist() {
        attemptedAt = LocalDateTime.now();
    }
}