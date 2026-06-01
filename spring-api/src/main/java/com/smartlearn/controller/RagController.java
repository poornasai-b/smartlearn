package com.smartlearn.controller;

import com.smartlearn.service.RagService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/rag")
@RequiredArgsConstructor
public class RagController {

    private final RagService ragService;

    @PostMapping("/ask")
    public ResponseEntity<?> ask(
            @RequestBody AskRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                ragService.askQuestion(req.getQuestion(),
                        req.getDocument_ids(),
                        userDetails.getUsername()));
    }

    @PostMapping("/summarize")
    public ResponseEntity<?> summarize(@RequestBody SummarizeRequest req) {
        return ResponseEntity.ok(
                ragService.summarize(req.getDocument_id(), req.getMode()));
    }

    @PostMapping("/quiz")
    public ResponseEntity<?> quiz(@RequestBody QuizRequest req) {
        return ResponseEntity.ok(
                ragService.generateQuiz(req.getDocument_id(),
                        req.getNum_questions(),
                        req.getDifficulty()));
    }

    @PostMapping("/quiz/save")
    public ResponseEntity<?> saveQuiz(
            @RequestBody SaveQuizRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                ragService.saveQuizResult(
                        req.getDocument_id(),
                        req.getTotal(),
                        req.getCorrect(),
                        req.getQuiz_json(),
                        userDetails.getUsername()));
    }

    @GetMapping("/progress")
    public ResponseEntity<?> progress(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                ragService.getProgress(userDetails.getUsername()));
    }

    // Request classes
    @Data public static class AskRequest {
        private String question;
        private List<Long> document_ids;
    }

    @Data public static class SummarizeRequest {
        private Long document_id;
        private String mode;
    }

    @Data public static class QuizRequest {
        private Long document_id;
        private int num_questions;
        private String difficulty;
    }

    @Data public static class SaveQuizRequest {
        private Long document_id;
        private int total;
        private int correct;
        private String quiz_json;
    }
}