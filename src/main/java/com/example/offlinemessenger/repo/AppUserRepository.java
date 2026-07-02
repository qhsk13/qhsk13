package com.example.offlinemessenger.repo;

import com.example.offlinemessenger.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    boolean existsByLoginId(String loginId);
    Optional<AppUser> findByLoginId(String loginId);
    Optional<AppUser> findBySessionToken(String sessionToken);

    List<AppUser> findTop20ByLoginIdContainingIgnoreCaseOrDisplayNameContainingIgnoreCaseOrderByLoginIdAsc(
            String loginIdKeyword,
            String displayNameKeyword
    );
}
