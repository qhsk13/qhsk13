package com.example.offlinemessenger.repo;

import com.example.offlinemessenger.entity.ChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByRoomIdAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(Long roomId, LocalDateTime joinedAt);
    List<ChatMessage> findByRoomIdAndCreatedAtGreaterThanEqualOrderByIdDesc(Long roomId, LocalDateTime joinedAt, Pageable pageable);
    List<ChatMessage> findByRoomIdAndCreatedAtGreaterThanEqualAndIdLessThanOrderByIdDesc(Long roomId, LocalDateTime joinedAt, Long beforeId, Pageable pageable);
    void deleteByRoomId(Long roomId);
}
