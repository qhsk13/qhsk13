package com.example.offlinemessenger.service;

import com.example.offlinemessenger.dto.CreateRoomRequest;
import com.example.offlinemessenger.dto.ChatRoomSummary;
import com.example.offlinemessenger.entity.*;
import com.example.offlinemessenger.repo.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.transaction.Transactional;
import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ChatService {
    private final ChatRoomRepository roomRepo;
    private final RoomMemberRepository memberRepo;
    private final ChatMessageRepository messageRepo;
    private final AppUserRepository userRepo;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${app.upload-dir}")
    private String uploadDir;

    public ChatService(ChatRoomRepository roomRepo, RoomMemberRepository memberRepo,
                       ChatMessageRepository messageRepo, AppUserRepository userRepo,
                       SimpMessagingTemplate messagingTemplate) {
        this.roomRepo = roomRepo;
        this.memberRepo = memberRepo;
        this.messageRepo = messageRepo;
        this.userRepo = userRepo;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public List<ChatRoomSummary> visibleRooms(AppUser user) {
        ensureSelfChatRoom(user);
        List<RoomMember> memberships = memberRepo.findByUserIdAndActiveTrue(user.getId());
        List<ChatRoomSummary> rooms = new ArrayList<>();
        for (RoomMember m : memberships) {
            roomRepo.findById(m.getRoomId()).ifPresent(room -> rooms.add(toSummary(room, user, m)));
        }
        return rooms;
    }

    /**
     * 사용자에게 "나와의 채팅"(SELF 타입) 방이 없으면 하나 만들어준다.
     * 신규 가입자뿐 아니라 이 기능이 추가되기 전에 가입한 기존 사용자도
     * 방 목록을 불러올 때마다 이 메서드를 거치므로 자동으로 채워진다.
     */
    @Transactional
    public void ensureSelfChatRoom(AppUser user) {
        boolean exists = memberRepo.findByUserIdAndActiveTrue(user.getId()).stream()
                .anyMatch(m -> roomRepo.findById(m.getRoomId())
                        .map(r -> r.getType() == RoomType.SELF)
                        .orElse(false));
        if (exists) return;

        // 방 이름은 전체 방을 통틀어 유일해야 하므로(name unique 제약) 사용자 ID를 붙여 충돌을 피하고,
        // 실제로 화면에 보이는 이름은 RoomMember.displayRoomName("나와의 채팅")로 별도 지정한다.
        String internalName = uniqueRoomName("나와의 채팅#" + user.getId());
        ChatRoom room = roomRepo.save(new ChatRoom(internalName, RoomType.SELF, user.getId()));
        RoomMember member = new RoomMember(room.getId(), user.getId());
        member.setDisplayRoomName("나와의 채팅");
        memberRepo.save(member);
    }

    @Transactional
    public ChatRoom createRoom(CreateRoomRequest req, AppUser creator) {
        String requestedRoomName = clean(req.getName());

        RoomType type = req.getType() == null ? RoomType.GROUP : req.getType();
        if (type == RoomType.SELF) {
            throw new IllegalArgumentException("나와의 채팅은 직접 만들 수 없고, 가입 시 자동으로 생성됩니다.");
        }
        Map<Long, AppUser> membersById = new LinkedHashMap<>();
        membersById.put(creator.getId(), creator);

        if (req.getMembers() != null) {
            for (String loginId : req.getMembers()) {
                String cleanLoginId = clean(loginId);
                if (!cleanLoginId.isEmpty()) {
                    AppUser u = userRepo.findByLoginId(cleanLoginId)
                            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자: " + cleanLoginId));
                    membersById.put(u.getId(), u);
                }
            }
        }

        if (type == RoomType.PRIVATE && membersById.size() != 2) {
            throw new IllegalArgumentException("개인방은 본인 포함 정확히 2명이어야 합니다.");
        }

        String roomName = requestedRoomName.isEmpty()
                ? defaultRoomName(type, new ArrayList<>(membersById.values()))
                : requestedRoomName;
        roomName = uniqueRoomName(roomName);

        ChatRoom room = roomRepo.save(new ChatRoom(roomName, type, creator.getId()));
        for (AppUser memberUser : membersById.values()) {
            RoomMember member = new RoomMember(room.getId(), memberUser.getId());
            if (requestedRoomName.isEmpty() && type == RoomType.PRIVATE) {
                member.setDisplayRoomName(privateRoomNameFor(memberUser.getId(), membersById.values()));
            }
            memberRepo.save(member);
        }

        ChatMessage sys = messageRepo.save(ChatMessage.system(room.getId(), creator.getDisplayName() + "님이 방을 만들었습니다."));
        messagingTemplate.convertAndSend("/topic/rooms/" + room.getId(), sys);
        return room;
    }

    @Transactional
    public ChatRoomSummary renameRoom(Long roomId, AppUser requester, String name) {
        ChatRoom room = roomRepo.findById(roomId).orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));
        RoomMember member = requireActiveMember(roomId, requester.getId());
        String roomName = clean(name);
        if (roomName.isEmpty()) throw new IllegalArgumentException("방 이름을 입력하세요.");

        if (room.getType() == RoomType.PRIVATE || room.getType() == RoomType.SELF) {
            member.setDisplayRoomName(roomName);
            return toSummary(room, requester, member);
        }

        room.setName(uniqueRoomName(roomName, room.getId()));
        ChatMessage sys = messageRepo.save(ChatMessage.system(roomId, requester.getDisplayName() + "님이 방 이름을 변경했습니다."));
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId, sys);
        return toSummary(room, requester, member);
    }

    @Transactional
    public RoomMember addMember(Long roomId, AppUser requester, String loginId) {
        ChatRoom room = roomRepo.findById(roomId).orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));
        requireActiveMember(roomId, requester.getId());
        if (room.getType() != RoomType.GROUP) throw new IllegalArgumentException("단체방에서만 사용자를 추가할 수 있습니다.");

        AppUser target = userRepo.findByLoginId(clean(loginId))
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

        Optional<RoomMember> active = memberRepo.findTopByRoomIdAndUserIdAndActiveTrueOrderByJoinedAtDesc(roomId, target.getId());
        if (active.isPresent()) return active.get();

        RoomMember saved = memberRepo.save(new RoomMember(roomId, target.getId()));
        ChatMessage sys = messageRepo.save(ChatMessage.system(roomId, target.getDisplayName() + "님이 추가되었습니다."));
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId, sys);
        return saved;
    }

    @Transactional
    public void leave(Long roomId, AppUser user) {
        ChatRoom room = roomRepo.findById(roomId).orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));
        if (room.getType() == RoomType.SELF) throw new IllegalArgumentException("나와의 채팅은 나갈 수 없습니다.");
        RoomMember member = requireActiveMember(roomId, user.getId());
        member.setActive(false);
        member.setLeftAt(LocalDateTime.now());

        if (room.getType() == RoomType.PRIVATE) return;

        ChatMessage sys = messageRepo.save(ChatMessage.system(roomId, user.getDisplayName() + "님이 방을 나갔습니다."));
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId, sys);
    }

    @Transactional
    public void deleteRoom(Long roomId, AppUser user) {
        ChatRoom room = roomRepo.findById(roomId).orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));
        if (room.getType() == RoomType.SELF) throw new IllegalArgumentException("나와의 채팅은 삭제할 수 없습니다.");
        if (!room.getCreatedByUserId().equals(user.getId())) {
            throw new IllegalArgumentException("방을 만든 사용자만 삭제할 수 있습니다.");
        }
        messageRepo.deleteByRoomId(roomId);
        memberRepo.findByRoomIdAndActiveTrue(roomId).forEach(memberRepo::delete);
        roomRepo.delete(room);
    }

    public List<ChatMessage> history(Long roomId, AppUser user) {
        return history(roomId, user, null, null);
    }

    public List<ChatMessage> history(Long roomId, AppUser user, Integer limit, Long beforeId) {
        RoomMember member = memberRepo.findTopByRoomIdAndUserIdOrderByJoinedAtDesc(roomId, user.getId()).orElse(null);
        if (member == null) return Collections.emptyList();
        int pageSize = normalizeMessageLimit(limit);
        List<ChatMessage> desc = beforeId == null
                ? messageRepo.findByRoomIdAndCreatedAtGreaterThanEqualOrderByIdDesc(roomId, member.getJoinedAt(), PageRequest.of(0, pageSize))
                : messageRepo.findByRoomIdAndCreatedAtGreaterThanEqualAndIdLessThanOrderByIdDesc(roomId, member.getJoinedAt(), beforeId, PageRequest.of(0, pageSize));
        Collections.reverse(desc);
        return desc;
    }

    @Transactional
    public ChatMessage sendText(Long roomId, AppUser sender, String content) {
        requireActiveMember(roomId, sender.getId());
        if (content == null || content.trim().isEmpty()) throw new IllegalArgumentException("메시지를 입력하세요.");
        reactivatePrivateRoomMembers(roomId);
        String trimmed = content.trim();
        ChatMessage message = ChatMessage.text(roomId, sender.getId(), sender.getDisplayName(), trimmed);
        message.setMentionedUserIds(extractMentionedUserIds(roomId, trimmed));
        ChatMessage saved = messageRepo.save(message);
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId, saved);
        return saved;
    }

    // "@all" 또는 "@전체"로 방 전체 참여자를 한 번에 멘션하는 전체 멘션 트리거.
    private static final Pattern ALL_MENTION_PATTERN =
            Pattern.compile("@(?:all|전체)(?:님)?(?![\\p{L}\\p{N}_])", Pattern.CASE_INSENSITIVE);

    /**
     * 메시지 본문에서 "@닉네임" 형태로 언급된 방 참여자를 찾아 사용자 ID 목록으로 반환한다.
     * 카카오톡 멘션처럼 실제 존재하는 참여자 이름만 인정하며, 닉네임이 서로의 부분 문자열인
     * 경우(예: "김" / "김철수")를 대비해 긴 이름부터 먼저 매칭하고 이름 뒤에 글자가 더 이어지면
     * (예: "@김철수님" 안의 "@김철" 오탐) 인정하지 않도록 경계를 둔다.
     * "@all" 또는 "@전체"는 개별 닉네임과 무관하게 현재 방의 활성 참여자 전원을 멘션한다.
     */
    private List<Long> extractMentionedUserIds(Long roomId, String content) {
        List<RoomMember> activeMembers = memberRepo.findByRoomIdAndActiveTrue(roomId);
        Set<Long> mentioned = new LinkedHashSet<>();

        if (ALL_MENTION_PATTERN.matcher(content).find()) {
            for (RoomMember m : activeMembers) mentioned.add(m.getUserId());
        }

        List<Map.Entry<String, Long>> candidates = new ArrayList<>();
        for (RoomMember m : activeMembers) {
            userRepo.findById(m.getUserId()).ifPresent(u -> {
                String name = clean(u.getDisplayName());
                if (!name.isEmpty()) candidates.add(new AbstractMap.SimpleEntry<>(name, u.getId()));
            });
        }
        candidates.sort((a, b) -> b.getKey().length() - a.getKey().length());

        for (Map.Entry<String, Long> candidate : candidates) {
            // "@철수님"처럼 이름 뒤에 "님"을 바로 붙이는 관용적 표현은 허용하고,
            // 그 외 글자/숫자가 이어지면(예: "@철수야" 안의 "@철수") 다른 이름의 일부로 보고 매칭하지 않는다.
            Pattern pattern = Pattern.compile("@" + Pattern.quote(candidate.getKey()) + "(?:님)?(?![\\p{L}\\p{N}_])");
            Matcher matcher = pattern.matcher(content);
            if (matcher.find()) mentioned.add(candidate.getValue());
        }
        return new ArrayList<>(mentioned);
    }

    @Transactional
    public ChatMessage saveFileMessage(Long roomId, AppUser sender, MultipartFile file) throws IOException {
        requireActiveMember(roomId, sender.getId());
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("파일을 선택하세요.");
        Path dir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(dir);

        String original = Paths.get(file.getOriginalFilename()).getFileName().toString();
        String stored = UUID.randomUUID().toString() + "_" + original;
        Path target = dir.resolve(stored).normalize();
        if (!target.startsWith(dir)) throw new IllegalArgumentException("잘못된 파일명입니다.");

        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        reactivatePrivateRoomMembers(roomId);
        ChatMessage saved = messageRepo.save(ChatMessage.file(roomId, sender.getId(), sender.getDisplayName(), original, stored, file.getSize()));
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId, saved);
        return saved;
    }

    public Optional<ChatMessage> findMessage(Long messageId) {
        return messageRepo.findById(messageId);
    }

    @Transactional
    public void deleteMessage(Long roomId, Long messageId, AppUser user) {
        requireActiveMember(roomId, user.getId());
        ChatMessage message = messageRepo.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("메시지를 찾을 수 없습니다."));
        if (!roomId.equals(message.getRoomId())) {
            throw new IllegalArgumentException("메시지가 선택한 방에 없습니다.");
        }
        if (message.getType() == MessageType.SYSTEM) {
            throw new IllegalArgumentException("시스템 메시지는 삭제할 수 없습니다.");
        }
        if (!user.getId().equals(message.getSenderUserId())) {
            throw new IllegalArgumentException("본인이 보낸 메시지만 삭제할 수 있습니다.");
        }

        if (message.getType() == MessageType.FILE && message.getStoredFileName() != null) {
            try {
                Files.deleteIfExists(getUploadPath(message.getStoredFileName()));
            } catch (IOException e) {
                throw new IllegalStateException("파일 삭제 중 오류가 발생했습니다.");
            }
        }
        messageRepo.delete(message);
    }

    public Path getUploadPath(String storedFileName) {
        return Paths.get(uploadDir).toAbsolutePath().normalize().resolve(storedFileName).normalize();
    }

    public List<Map<String, Object>> activeMembers(Long roomId) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (RoomMember m : memberRepo.findByRoomIdAndActiveTrue(roomId)) {
            userRepo.findById(m.getUserId()).ifPresent(u -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("userId", u.getId());
                row.put("loginId", u.getLoginId());
                row.put("displayName", u.getDisplayName());
                row.put("avatarKey", u.getAvatarKey() == null || u.getAvatarKey().trim().isEmpty() ? com.example.offlinemessenger.entity.AppUser.AVATAR_KEYS[0] : u.getAvatarKey());
                result.add(row);
            });
        }
        return result;
    }

    private RoomMember requireActiveMember(Long roomId, Long userId) {
        return memberRepo.findTopByRoomIdAndUserIdAndActiveTrueOrderByJoinedAtDesc(roomId, userId)
                .orElseThrow(() -> new IllegalArgumentException("방 참여자만 사용할 수 있습니다."));
    }

    private void reactivatePrivateRoomMembers(Long roomId) {
        ChatRoom room = roomRepo.findById(roomId).orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));
        if (room.getType() != RoomType.PRIVATE) return;

        LocalDateTime now = LocalDateTime.now();
        for (RoomMember member : memberRepo.findByRoomId(roomId)) {
            if (!member.isActive()) {
                member.setActive(true);
                member.setJoinedAt(now);
                member.setLeftAt(null);
            }
        }
    }

    private String clean(String v) {
        return v == null ? "" : v.trim();
    }

    private int normalizeMessageLimit(Integer limit) {
        if (limit == null) return 50;
        if (limit < 1) return 50;
        return Math.min(limit, 200);
    }

    private ChatRoomSummary toSummary(ChatRoom room, AppUser viewer, RoomMember member) {
        return new ChatRoomSummary(
                room.getId(),
                displayRoomName(room, viewer, member),
                room.getType(),
                room.getCreatedByUserId(),
                room.getCreatedAt());
    }

    private String displayRoomName(ChatRoom room, AppUser viewer, RoomMember member) {
        String customName = clean(member.getDisplayRoomName());
        if (!customName.isEmpty()) return customName;
        if (room.getType() == RoomType.PRIVATE) {
            String privateName = privateRoomNameFor(viewer.getId(), activeUsers(room.getId()));
            if (!privateName.isEmpty()) return privateName;
        }
        return room.getName();
    }

    private List<AppUser> activeUsers(Long roomId) {
        List<AppUser> users = new ArrayList<>();
        for (RoomMember m : memberRepo.findByRoomIdAndActiveTrue(roomId)) {
            userRepo.findById(m.getUserId()).ifPresent(users::add);
        }
        return users;
    }

    private String defaultRoomName(RoomType type, List<AppUser> users) {
        if (type == RoomType.PRIVATE && users.size() == 2) {
            return joinDisplayNames(users);
        }
        return joinDisplayNames(users);
    }

    private String privateRoomNameFor(Long viewerUserId, Collection<AppUser> users) {
        List<AppUser> others = new ArrayList<>();
        for (AppUser user : users) {
            if (!user.getId().equals(viewerUserId)) others.add(user);
        }
        return joinDisplayNames(others);
    }

    private String joinDisplayNames(Collection<AppUser> users) {
        List<String> names = new ArrayList<>();
        for (AppUser user : users) {
            String name = clean(user.getDisplayName());
            names.add(name.isEmpty() ? user.getLoginId() : name);
        }
        return String.join(", ", names);
    }

    private String uniqueRoomName(String requestedName) {
        return uniqueRoomName(requestedName, null);
    }

    private String uniqueRoomName(String requestedName, Long currentRoomId) {
        String baseName = clean(requestedName);
        String candidate = baseName;
        int index = 2;
        while (roomNameExists(candidate, currentRoomId)) {
            candidate = baseName + " (" + index + ")";
            index++;
        }
        return candidate;
    }

    private boolean roomNameExists(String name, Long currentRoomId) {
        Optional<ChatRoom> room = roomRepo.findByName(name);
        return room.isPresent() && (currentRoomId == null || !room.get().getId().equals(currentRoomId));
    }
}
