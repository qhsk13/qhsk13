package com.example.offlinemessenger.repo;

import com.example.offlinemessenger.entity.RoomMember;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface RoomMemberRepository extends JpaRepository<RoomMember, Long> {
    Optional<RoomMember> findTopByRoomIdAndUserIdAndActiveTrueOrderByJoinedAtDesc(Long roomId, Long userId);
    Optional<RoomMember> findTopByRoomIdAndUserIdOrderByJoinedAtDesc(Long roomId, Long userId);
    List<RoomMember> findByRoomId(Long roomId);
    List<RoomMember> findByRoomIdAndActiveTrue(Long roomId);
    List<RoomMember> findByUserIdAndActiveTrue(Long userId);
    long countByRoomIdAndActiveTrue(Long roomId);
}
