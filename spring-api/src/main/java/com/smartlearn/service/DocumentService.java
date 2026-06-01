package com.smartlearn.service;

import com.smartlearn.entity.Document;
import com.smartlearn.entity.QuizAttempt;
import com.smartlearn.entity.User;
import com.smartlearn.repository.DocumentRepository;
import com.smartlearn.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClient;

import com.smartlearn.entity.QuizAttempt;
import com.smartlearn.repository.QuizAttemptRepository;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final WebClient mlWebClient;
    private final QuizAttemptRepository quizAttemptRepository;

    @Value("${storage.upload-dir:./uploads}")
    private String uploadDir;

    private static final Set<String> ALLOWED = Set.of("pdf", "txt", "docx", "md");

    public Document uploadDocument(MultipartFile file, String userEmail)
            throws IOException {
        String ext = getExtension(file.getOriginalFilename());
        if (!ALLOWED.contains(ext))
            throw new IllegalArgumentException("Unsupported file type: " + ext);

        User user = userRepository.findByEmail(userEmail).orElseThrow();
        String storedName = UUID.randomUUID() + "." + ext;

        Path uploadPath = Paths.get(uploadDir);
        Files.createDirectories(uploadPath);
        Files.copy(file.getInputStream(),
                uploadPath.resolve(storedName),
                StandardCopyOption.REPLACE_EXISTING);

        Document doc = Document.builder()
                .originalName(file.getOriginalFilename())
                .storedName(storedName)
                .fileType(ext)
                .fileSize(file.getSize())
                .user(user)
                .build();

        doc = documentRepository.save(doc);
        triggerProcessing(doc.getId(), storedName, ext);
        return doc;
    }

    @Async
    public void triggerProcessing(Long docId, String storedName, String fileType) {
        documentRepository.findById(docId).ifPresent(doc -> {
            doc.setStatus(Document.ProcessingStatus.PROCESSING);
            documentRepository.save(doc);
        });

        try {
            Map<String, Object> payload = Map.of(
                    "document_id", docId,
                    "stored_name", storedName,
                    "file_type", fileType,
                    "upload_dir", uploadDir
            );

            var result = mlWebClient.post()
                    .uri("/ingest")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            documentRepository.findById(docId).ifPresent(doc -> {
                doc.setStatus(Document.ProcessingStatus.READY);
                doc.setChunkCount((Integer) result.get("chunk_count"));
                doc.setChromaCollectionId((String) result.get("collection_id"));
                documentRepository.save(doc);
            });

        } catch (Exception e) {
            log.error("ML processing failed for doc {}: {}", docId, e.getMessage());
            documentRepository.findById(docId).ifPresent(doc -> {
                doc.setStatus(Document.ProcessingStatus.FAILED);
                documentRepository.save(doc);
            });
        }
    }

    public List<Document> getUserDocuments(String userEmail) {
        User user = userRepository.findByEmail(userEmail).orElseThrow();
        return documentRepository.findByUserOrderByUploadedAtDesc(user);
    }

  public void deleteDocument(Long docId, String userEmail) {
    Document doc = documentRepository.findById(docId)
            .orElseThrow(() -> new RuntimeException("Document not found"));

    User user = userRepository.findByEmail(userEmail).orElseThrow();

    if (!doc.getUser().getId().equals(user.getId()))
        throw new SecurityException("Unauthorized");

    // Delete quiz attempts first
    List<QuizAttempt> attempts = quizAttemptRepository
            .findByUserOrderByAttemptedAtDesc(user);
    attempts.stream()
            .filter(a -> a.getDocument().getId().equals(docId))
            .forEach(quizAttemptRepository::delete);

    // Delete from Chroma
    if (doc.getChromaCollectionId() != null) {
        try {
            mlWebClient.delete()
                    .uri("/ingest/" + docId)
                    .retrieve()
                    .bodyToMono(Void.class)
                    .block();
        } catch (Exception e) {
            log.warn("Could not delete from Chroma: {}", e.getMessage());
        }
    }

    // Delete file
    try {
        Files.deleteIfExists(Paths.get(uploadDir, doc.getStoredName()));
    } catch (IOException e) {
        log.warn("Could not delete file: {}", doc.getStoredName());
    }

    documentRepository.delete(doc);
}

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}