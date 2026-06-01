package com.smartlearn.controller;

import com.smartlearn.entity.Document;
import com.smartlearn.service.DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping("/upload")
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) throws IOException {
        Document doc = documentService.uploadDocument(file, userDetails.getUsername());
        return ResponseEntity.ok(doc);
    }

    @GetMapping
    public ResponseEntity<?> list(
            @AuthenticationPrincipal UserDetails userDetails) {
        List<Document> docs = documentService.getUserDocuments(
                userDetails.getUsername());
        return ResponseEntity.ok(docs);
    }

   @DeleteMapping("/{id}")
public ResponseEntity<?> delete(
        @PathVariable Long id,
        @AuthenticationPrincipal UserDetails userDetails) {
    try {
        documentService.deleteDocument(id, userDetails.getUsername());
        return ResponseEntity.ok().build();
    } catch (SecurityException e) {
        return ResponseEntity.status(403).body("Unauthorized");
    } catch (Exception e) {
        return ResponseEntity.status(500).body(e.getMessage());
    }
}
}