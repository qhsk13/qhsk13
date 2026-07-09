package com.example.offlinemessenger.service;

import com.example.offlinemessenger.dto.AuthRequest;
import com.example.offlinemessenger.dto.AuthResponse;
import com.example.offlinemessenger.dto.UserSummary;
import com.example.offlinemessenger.entity.AppUser;
import com.example.offlinemessenger.entity.UserSession;
import com.example.offlinemessenger.repo.AppUserRepository;
import com.example.offlinemessenger.repo.UserSessionRepository;
import org.springframework.stereotype.Service;

import javax.transaction.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.ArrayList;
import java.util.List;

@Service
public class AuthService {
    private final AppUserRepository userRepo;
    private final UserSessionRepository sessionRepo;

    public AuthService(AppUserRepository userRepo, UserSessionRepository sessionRepo) {
        this.userRepo = userRepo;
        this.sessionRepo = sessionRepo;
    }

    @Transactional
    public AuthResponse register(AuthRequest req) {
        String loginId = clean(req.getLoginId());
        String password = req.getPassword();
        String displayName = clean(req.getDisplayName());

        if (loginId.isEmpty()) throw new IllegalArgumentException("아이디를 입력하세요.");
        if (password == null || password.length() < 4) throw new IllegalArgumentException("비밀번호는 4자 이상 입력하세요.");
        if (displayName.isEmpty()) displayName = loginId;
        if (userRepo.existsByLoginId(loginId)) throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");

        AppUser user = userRepo.save(new AppUser(loginId, hash(password), displayName));
        String token = createSession(user.getId());
        return toResponse(user, token);
    }

    @Transactional
    public AuthResponse login(AuthRequest req) {
        String loginId = clean(req.getLoginId());
        AppUser user = userRepo.findByLoginId(loginId)
                .orElseThrow(() -> new IllegalArgumentException("아이디 또는 비밀번호가 맞지 않습니다."));
        if (!user.getPasswordHash().equals(hash(req.getPassword()))) {
            throw new IllegalArgumentException("아이디 또는 비밀번호가 맞지 않습니다.");
        }
        // 새로 로그인하더라도 기존에 발급된 다른 토큰(예: 웹 브라우저, 브라우저 확장 등)은 무효화하지 않는다.
        // 이렇게 해야 여러 곳에서 동시에 로그인 상태를 유지할 수 있다.
        String token = createSession(user.getId());
        user.setUpdatedAt(LocalDateTime.now());
        return toResponse(user, token);
    }

    private String createSession(Long userId) {
        String token = UUID.randomUUID().toString();
        sessionRepo.save(new UserSession(userId, token));
        return token;
    }

    public AppUser requireUser(String token) {
        if (token == null || token.trim().isEmpty()) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }
        UserSession session = sessionRepo.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("로그인이 만료되었거나 유효하지 않습니다."));
        return userRepo.findById(session.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("로그인이 만료되었거나 유효하지 않습니다."));
    }

    @Transactional
    public AuthResponse updateNickname(String token, String displayName) {
        return updateProfile(token, displayName, null);
    }

    @Transactional
    public AuthResponse updateProfile(String token, String displayName, String avatarKey) {
        AppUser user = requireUser(token);
        String name = clean(displayName);
        if (name.isEmpty()) throw new IllegalArgumentException("닉네임을 입력하세요.");
        user.setDisplayName(name);
        String avatar = clean(avatarKey);
        if (!avatar.isEmpty()) user.setAvatarKey(avatar);
        user.setUpdatedAt(LocalDateTime.now());
        return toResponse(user, token);
    }

    public AuthResponse me(String token) {
        return toResponse(requireUser(token), token);
    }


    public List<UserSummary> searchUsers(String token, String keyword) {
        AppUser me = requireUser(token);
        String q = clean(keyword);
        List<AppUser> users;
        if (q.isEmpty()) {
            users = userRepo.findAll();
        } else {
            users = userRepo.findTop20ByLoginIdContainingIgnoreCaseOrDisplayNameContainingIgnoreCaseOrderByLoginIdAsc(q, q);
        }

        List<UserSummary> result = new ArrayList<>();
        for (AppUser user : users) {
            if (!user.getId().equals(me.getId())) {
                result.add(new UserSummary(user.getId(), user.getLoginId(), user.getDisplayName(), avatarOrDefault(user.getAvatarKey())));
            }
            if (result.size() >= 20) break;
        }
        return result;
    }


    private AuthResponse toResponse(AppUser user, String token) {
        return new AuthResponse(user.getId(), user.getLoginId(), user.getDisplayName(), avatarOrDefault(user.getAvatarKey()), token);
    }

    private String clean(String v) {
        return v == null ? "" : v.trim();
    }

    private String avatarOrDefault(String avatarKey) {
        String clean = clean(avatarKey);
        return clean.isEmpty() ? com.example.offlinemessenger.entity.AppUser.AVATAR_KEYS[0] : clean;
    }

    private String hash(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest(String.valueOf(password).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("비밀번호 처리 중 오류가 발생했습니다.", e);
        }
    }
}
