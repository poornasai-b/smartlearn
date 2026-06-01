package com.smartlearn.repository;

import com.smartlearn.entity.Document;
import com.smartlearn.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByUserOrderByUploadedAtDesc(User user);
}