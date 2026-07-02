package com.example.offlinemessenger.repo;

import com.example.offlinemessenger.entity.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    boolean existsByName(String name);
    Optional<ChatRoom> findByName(String name);
}
