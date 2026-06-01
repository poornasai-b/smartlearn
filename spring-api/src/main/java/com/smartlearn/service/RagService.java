package com.smartlearn.service;

import com.smartlearn.entity.Document;
import com.smartlearn.entity.QuizAttempt;
import com.smartlearn.entity.User;
import com.smartlearn.repository.DocumentRepository;
import com.smartlearn.repository.QuizAttemptRepository;
import com.smartlearn.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RagService {

    private final WebClient mlWebClient;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final QuizAttemptRepository quizAttemptRepository;

    public Map<?, ?> askQuestion(String question,
                                  List<Long> documentIds,
                                  String userEmail) {
        return mlWebClient.post()
                .uri("/rag/ask")
                .bodyValue(Map.of(
                        "question", question,
                        "document_ids", documentIds,
                        "user_email", userEmail))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    public Map<?, ?> summarize(Long documentId, String mode) {
        return mlWebClient.post()
                .uri("/rag/summarize")
                .bodyValue(Map.of(
                        "document_id", documentId,
                        "mode", mode == null ? "detailed" : mode))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    public Map<?, ?> generateQuiz(Long documentId,
                                   int numQuestions,
                                   String difficulty) {
        return mlWebClient.post()
                .uri("/rag/quiz")
                .bodyValue(Map.of(
                        "document_id", documentId,
                        "num_questions", numQuestions,
                        "difficulty", difficulty))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    public QuizAttempt saveQuizResult(Long docId, int total,
                                       int correct, String quizJson,
                                       String userEmail) {
        User user = userRepository.findByEmail(userEmail).orElseThrow();
        Document doc = documentRepository.findById(docId).orElseThrow();

        QuizAttempt attempt = QuizAttempt.builder()
                .user(user)
                .document(doc)
                .totalQuestions(total)
                .correctAnswers(correct)
                .scorePercent((double) correct / total * 100)
                .quizJson(quizJson)
                .build();

        return quizAttemptRepository.save(attempt);
    }

    public Map<String, Object> getProgress(String userEmail) {
        User user = userRepository.findByEmail(userEmail).orElseThrow();
        long attempts = quizAttemptRepository.countByUser(user);
        Double avg = quizAttemptRepository.findAverageScoreByUser(user);

        List<Map<String, Object>> recent = quizAttemptRepository
                .findByUserOrderByAttemptedAtDesc(user)
                .stream().limit(10)
                .map(a -> Map.<String, Object>of(
                        "id", a.getId(),
                        "score", a.getScorePercent(),
                        "total", a.getTotalQuestions(),
                        "correct", a.getCorrectAnswers(),
                        "date", a.getAttemptedAt().toString(),
                        "document", a.getDocument().getOriginalName()
                )).toList();

        return Map.of(
                "totalAttempts", attempts,
                "averageScore", avg == null ? 0 : Math.round(avg * 10.0) / 10.0,
                "recentAttempts", recent
        );
    }
}