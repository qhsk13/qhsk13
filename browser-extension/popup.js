let stompClient = null;
let connecting = false;
let currentRoomId = null;
let currentRoomType = null;
let me = null;
let roomMemberCandidates = [];
let allUsersCache = [];
let userSearchTimer = null;
let lastRooms = [];
let roomNames = {};
let roomSubscriptions = {};
let unreadRoomIds = new Set();
let pendingConnectCallbacks = [];
let messageScrollObserver = null;
let suppressAutoScroll = false;
let oldestLoadedMessageId = null;
let hasOlderMessages = false;
let currentRoomName = "";
const MESSAGE_PAGE_SIZE = 50;
// 현재 보고 있는 방의 참여자 목록(멘션 자동완성/하이라이트에 사용).
let currentRoomMembers = [];
// "@" 멘션 입력 상태: 입력창에서 @뒤에 이어 쓰는 검색어와, 그에 맞는 후보 목록/선택 인덱스를 추적한다.
let mentionState = {active: false, start: -1, query: "", matches: [], activeIndex: 0};
// 프로필 아바타: 이름/닉네임 글자와 무관하게, 미리 만들어둔 20개의 이모지 아바타 세트 중
// 회원가입 시 서버가 무작위로 하나를 배정하고, 사용자는 이 20개 중에서 언제든 원하는 것으로 바꿀 수 있다.
let selectedAvatarKey = "av1";
let popupPresenceTimer = null;
const AVATAR_OPTIONS = [
    {key: "av1", emoji: "😀", color: "#6d6af2"},
    {key: "av2", emoji: "😎", color: "#10b981"},
    {key: "av3", emoji: "🤖", color: "#8b5cf6"},
    {key: "av4", emoji: "🐱", color: "#fb7185"},
    {key: "av5", emoji: "🐶", color: "#0ea5e9"},
    {key: "av6", emoji: "🦊", color: "#f97316"},
    {key: "av7", emoji: "🐻", color: "#a16207"},
    {key: "av8", emoji: "🐼", color: "#334155"},
    {key: "av9", emoji: "🦁", color: "#eab308"},
    {key: "av10", emoji: "🐯", color: "#f59e0b"},
    {key: "av11", emoji: "🐨", color: "#64748b"},
    {key: "av12", emoji: "🐰", color: "#ec4899"},
    {key: "av13", emoji: "🐸", color: "#22c55e"},
    {key: "av14", emoji: "🐧", color: "#0f172a"},
    {key: "av15", emoji: "🦉", color: "#7c3aed"},
    {key: "av16", emoji: "🦄", color: "#d946ef"},
    {key: "av17", emoji: "🐙", color: "#db2777"},
    {key: "av18", emoji: "🦋", color: "#06b6d4"},
    {key: "av19", emoji: "🌟", color: "#facc15"},
    {key: "av20", emoji: "🔥", color: "#ef4444"}
];

function $(id) {
    return document.getElementById(id);
}

function serverBaseUrl() {
    return (localStorage.getItem("serverBaseUrl") || "http://localhost:8080").replace(/\/+$/, "");
}

function saveServerBaseUrl(value) {
    const url = String(value || "").trim().replace(/\/+$/, "");
    const nextUrl = url || "http://localhost:8080";
    localStorage.setItem("serverBaseUrl", nextUrl);
    saveExtensionSettings({serverBaseUrl: nextUrl});
}

function serverUrl(path) {
    return serverBaseUrl() + path;
}

function token() {
    return localStorage.getItem("authToken") || "";
}

function authHeaders(json) {
    const headers = {"X-Auth-Token": token()};
    if (json) headers["Content-Type"] = "application/json";
    return headers;
}

async function api(path, options) {
    const res = await fetch(serverUrl(path), options || {});
    if (!res.ok) throw new Error(toFriendlyError(await res.text(), res.status));
    if (res.status === 204) return null;
    const contentType = res.headers.get("content-type") || "";
    return contentType.indexOf("application/json") >= 0 ? res.json() : res.text();
}

function toFriendlyError(text, status) {
    const raw = String(text || "").trim();
    try {
        const obj = JSON.parse(raw);
        if (obj.message) return obj.message;
        if (obj.error) return obj.error;
    } catch (ignore) {}
    if (raw) return raw;
    if (status === 400) return "입력값을 확인해 주세요.";
    if (status === 401 || status === 403) return "로그인이 필요하거나 권한이 없습니다.";
    if (status === 404) return "요청한 정보를 찾을 수 없습니다.";
    return "처리 중 오류가 발생했습니다.";
}

function showInfo(message) {
    alert(message);
}

function requireValue(value, message) {
    if (!String(value || "").trim()) {
        showInfo(message);
        return false;
    }
    return true;
}

function scrollMessagesToBottom() {
    const el = $("messages");
    if (!el) return;
    const scroll = () => {
        el.scrollTo(0, el.scrollHeight);
        el.scrollTop = el.scrollHeight;
    };
    scroll();
    requestAnimationFrame(scroll);
    setTimeout(scroll, 0);
    setTimeout(scroll, 50);
    setTimeout(scroll, 150);
    setTimeout(scroll, 300);
}

function installMessageAutoScroll() {
    const el = $("messages");
    if (!el || messageScrollObserver) return;
    messageScrollObserver = new MutationObserver(() => {
        if (!suppressAutoScroll) scrollMessagesToBottom();
    });
    messageScrollObserver.observe(el, {childList: true, subtree: true});
}

async function register() {
    saveServerBaseUrl($("serverUrl").value);
    const loginId = $("loginId").value.trim();
    const password = $("password").value;
    const displayName = $("displayName").value.trim();
    if (!requireValue(loginId, "회원가입할 아이디를 입력해 주세요.")) return;
    if (!requireValue(password, "회원가입할 비밀번호를 입력해 주세요.")) return;
    if (password.length < 4) return showInfo("비밀번호는 4자 이상 입력해 주세요.");
    if (!requireValue(displayName, "닉네임을 입력해 주세요.")) return;

    try {
        const data = await api("/api/auth/register", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({loginId, password, displayName})
        });
        saveAuth(data);
        showInfo("회원가입이 완료되었습니다.");
    } catch (e) {
        showInfo(e.message);
    }
}

async function login() {
    saveServerBaseUrl($("serverUrl").value);
    const loginId = $("loginId").value.trim();
    const password = $("password").value;
    if (!requireValue(loginId, "아이디를 입력해 주세요.")) return;
    if (!requireValue(password, "비밀번호를 입력해 주세요.")) return;

    try {
        saveAuth(await api("/api/auth/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({loginId, password})
        }));
    } catch (e) {
        showInfo(e.message);
    }
}

function saveAuth(data) {
    localStorage.setItem("authToken", data.token);
    saveExtensionSettings({authToken: data.token});
    me = data;
    showApp();
}

function logout() {
    localStorage.removeItem("authToken");
    saveExtensionSettings({
        authToken: "",
        lastSeenMessageIds: {},
        initializedRooms: {}
    });
    Object.keys(roomSubscriptions).forEach(roomId => roomSubscriptions[roomId].unsubscribe());
    roomSubscriptions = {};
    if (stompClient) stompClient.disconnect(() => {});
    location.reload();
}

async function init() {
    markPopupActive();
    popupPresenceTimer = setInterval(markPopupActive, 5000);
    $("serverUrl").value = serverBaseUrl();
    $("notificationToggle").checked = notificationsEnabled();
    bindEvents();
    installMessageAutoScroll();
    saveExtensionSettings({
        authToken: token(),
        serverBaseUrl: serverBaseUrl(),
        notificationsEnabled: notificationsEnabled()
    });
    if (!token()) return;
    try {
        me = await api("/api/auth/me", {headers: authHeaders(false)});
        showApp();
    } catch (e) {
        localStorage.removeItem("authToken");
    }
}

async function showApp() {
    $("loginPanel").classList.add("hidden");
    $("app").classList.remove("hidden");
    selectedAvatarKey = me.avatarKey || AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)].key;
    $("myDisplayName").textContent = me.displayName;
    $("myLoginId").textContent = "ID: " + me.loginId;
    $("nicknameInput").value = me.displayName;
    $("serverUrlInApp").value = serverBaseUrl();
    renderMyAvatar();
    renderAvatarPicker();
    await loadRooms();
    await loadAllUsers();
    renderRoomMemberCandidates();
    await openPendingRoomFromNotification();
}

async function changeNickname() {
    saveServerBaseUrl($("serverUrlInApp").value);
    const displayName = $("nicknameInput").value.trim();
    if (!requireValue(displayName, "변경할 닉네임을 입력해 주세요.")) return;

    try {
        me = await api("/api/auth/nickname", {
            method: "PUT",
            headers: authHeaders(true),
            body: JSON.stringify({displayName, avatarKey: selectedAvatarKey})
        });
        selectedAvatarKey = me.avatarKey || selectedAvatarKey;
        $("myDisplayName").textContent = me.displayName;
        renderMyAvatar();
        renderAvatarPicker();
        showInfo("닉네임이 변경되었습니다.");
    } catch (e) {
        showInfo(e.message);
    }
}

async function loadRooms(options) {
    const silent = !!(options && options.silent);
    try {
        lastRooms = await api("/api/rooms", {headers: authHeaders(false)});
        roomNames = {};
        lastRooms.forEach(room => roomNames[room.id] = room.name);
        const currentRoom = lastRooms.find(room => room.id === currentRoomId);
        if (currentRoom) {
            currentRoomName = currentRoom.name;
            $("currentRoomTitle").textContent = currentRoom.name;
        }
        renderRooms();
        subscribeKnownRooms();
    } catch (e) {
        // 새 메시지 수신 시마다 자동으로 실행되는 백그라운드 새로고침이므로,
        // 일시적인 오류로 매번 팝업이 뜨지 않도록 조용히 처리한다.
        if (silent) console.warn("방 목록을 새로고침하지 못했습니다:", e.message);
        else showInfo(e.message);
    }
}

function roomTypeLabel(type) {
    if (type === "SELF") return "나와의 채팅";
    if (type === "PRIVATE") return "개인";
    return "단체";
}

function renderRooms() {
    const el = $("rooms");
    el.innerHTML = "";
    $("roomCount").textContent = lastRooms.length ? `${lastRooms.length}개` : "";
    lastRooms.forEach(room => {
        const div = document.createElement("div");
        const label = document.createElement("span");
        const unread = unreadRoomIds.has(room.id) ? " unread" : "";
        div.className = "room" + (room.id === currentRoomId ? " active" : "") + unread;
        label.textContent = `[${roomTypeLabel(room.type)}] ${room.name}`;
        div.addEventListener("click", () => enterRoom(room.id, room.name, room.type));
        div.append(label);
        if (room.type !== "SELF") {
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "room-delete";
            deleteButton.textContent = "x";
            deleteButton.title = "방 삭제";
            deleteButton.addEventListener("click", event => {
                event.stopPropagation();
                deleteRoomById(room.id);
            });
            div.appendChild(deleteButton);
        }
        el.appendChild(div);
    });
}

function renderMyAvatar() {
    const avatar = $("myAvatar");
    if (!avatar) return;
    applyAvatarStyle(avatar, selectedAvatarKey);
    avatar.textContent = avatarLabel(selectedAvatarKey);
    syncCustomColorInputs();
}

function renderAvatarPicker() {
    const picker = $("avatarPicker");
    if (!picker) return;
    picker.innerHTML = "";
    const currentPreset = parseAvatarKey(selectedAvatarKey).presetKey;
    AVATAR_OPTIONS.forEach(option => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `avatar-choice avatar avatar-${option.key}` + (option.key === currentPreset ? " selected" : "");
        button.textContent = option.emoji;
        button.title = "프로필 아이콘 선택";
        button.addEventListener("click", () => {
            setSelectedAvatarKey(option.key);
            renderMyAvatar();
            renderAvatarPicker();
        });
        picker.appendChild(button);
    });
}

// 아바타는 이름/닉네임 글자와 무관하게 항상 20개의 미리 만든 이모지 중 하나로만 표시된다.
function avatarLabel(avatarKey) {
    const presetKey = parseAvatarKey(avatarKey).presetKey;
    const option = AVATAR_OPTIONS.find(item => item.key === presetKey);
    return option ? option.emoji : AVATAR_OPTIONS[0].emoji;
}

// avatarKey를 "프리셋 키" + "선택적 커스텀 색상"으로 분리한다.
// 새 형식: "av7" (프리셋 그대로) 또는 "av7|#RRGGBB" (프리셋 이모지를 유지한 채 배경색만 커스텀).
// 예전 형식("custom:#RRGGBB")도 남아있을 수 있으므로 호환을 위해 계속 인식한다.
function parseAvatarKey(avatarKey) {
    const raw = String(avatarKey || "");
    const pipeMatch = raw.match(/^([a-zA-Z0-9]+)\|(#[0-9a-fA-F]{6})$/);
    if (pipeMatch) return {presetKey: pipeMatch[1], customColor: pipeMatch[2].toUpperCase()};
    const legacyMatch = raw.match(/^custom:(#[0-9a-fA-F]{6})$/);
    if (legacyMatch) return {presetKey: AVATAR_OPTIONS[0].key, customColor: legacyMatch[1].toUpperCase()};
    return {presetKey: raw, customColor: ""};
}

function avatarKeyForUserId(userId) {
    if (me && me.userId === userId) return me.avatarKey || selectedAvatarKey || AVATAR_OPTIONS[0].key;
    const user = allUsersCache.find(item => item.userId === userId);
    return user && user.avatarKey ? user.avatarKey : AVATAR_OPTIONS[0].key;
}

function applyAvatarStyle(element, avatarKey) {
    const parsed = parseAvatarKey(avatarKey);
    const keepMessageClass = element.classList.contains("message-avatar");
    if (parsed.customColor) {
        element.className = element.className
            .split(/\s+/)
            .filter(name => name && name !== "avatar" && name !== "message-avatar" && !name.startsWith("avatar-"))
            .join(" ");
        element.classList.add("avatar");
        if (keepMessageClass) element.classList.add("message-avatar");
        element.style.backgroundColor = parsed.customColor;
        return;
    }
    const key = AVATAR_OPTIONS.some(option => option.key === parsed.presetKey) ? parsed.presetKey : AVATAR_OPTIONS[0].key;
    element.className = keepMessageClass ? `avatar message-avatar avatar-${key}` : `avatar avatar-${key}`;
    element.style.backgroundColor = "";
}

function setSelectedAvatarKey(avatarKey) {
    selectedAvatarKey = avatarKey;
    syncCustomColorInputs();
}

function customColorFromAvatarKey(avatarKey) {
    return parseAvatarKey(avatarKey).customColor;
}

function selectedAvatarColor() {
    const parsed = parseAvatarKey(selectedAvatarKey);
    if (parsed.customColor) return parsed.customColor;
    const option = AVATAR_OPTIONS.find(item => item.key === parsed.presetKey);
    return option ? option.color : AVATAR_OPTIONS[0].color;
}

function syncCustomColorInputs() {
    const colorInput = $("avatarColorInput");
    const hexInput = $("avatarHexInput");
    const color = selectedAvatarColor();
    if (colorInput) colorInput.value = color.toLowerCase();
    if (hexInput) hexInput.value = color.toUpperCase();
}

function normalizeHexColor(value) {
    const text = String(value || "").trim();
    const withHash = text.charAt(0) === "#" ? text : "#" + text;
    return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : "";
}

function updateCustomAvatarColor(value) {
    const color = normalizeHexColor(value);
    if (!color) return;
    const presetKey = parseAvatarKey(selectedAvatarKey).presetKey;
    const basePreset = AVATAR_OPTIONS.some(option => option.key === presetKey) ? presetKey : AVATAR_OPTIONS[0].key;
    setSelectedAvatarKey(`${basePreset}|${color}`);
    renderMyAvatar();
    renderAvatarPicker();
}

// ---------- @멘션(카카오톡 스타일) ----------

// 방 전체 참여자를 한 번에 멘션하는 특수 항목("@all"). 실제 회원이 아니라 드롭다운에만 표시되는 가짜 항목이다.
const ALL_MENTION_ITEM = {userId: "__all__", displayName: "전체", isAll: true};

function updateMentionState() {
    const input = $("messageInput");
    if (!input) return;
    const cursor = input.selectionStart;
    const value = input.value;
    const uptoCursor = value.slice(0, cursor);
    const atIndex = uptoCursor.lastIndexOf("@");
    if (atIndex === -1) return closeMentionDropdown();

    // "@"가 단어 시작이 아니면(예: 이메일 중간의 a@b) 멘션 입력으로 보지 않는다.
    const beforeAt = atIndex > 0 ? uptoCursor.charAt(atIndex - 1) : "";
    if (atIndex > 0 && !/[\s\n]/.test(beforeAt)) return closeMentionDropdown();

    const query = uptoCursor.slice(atIndex + 1);
    if (/[\s\n]/.test(query)) return closeMentionDropdown(); // 이미 공백을 입력해 멘션 입력이 끝난 상태

    const lowerQuery = query.toLowerCase();
    const matches = currentRoomMembers
        .filter(u => !query || String(u.displayName || "").toLowerCase().indexOf(lowerQuery) !== -1)
        .slice(0, 7);

    // "@all"/"@전체"로 방 전체를 한 번에 멘션할 수 있는 특수 항목을 목록 맨 위에 추가한다.
    if (!query || "all".indexOf(lowerQuery) === 0 || "전체".indexOf(query) === 0) {
        matches.unshift(ALL_MENTION_ITEM);
    }

    mentionState = {active: true, start: atIndex, query, matches, activeIndex: 0};
    renderMentionDropdown();
}

function closeMentionDropdown() {
    const wasActive = mentionState.active;
    mentionState = {active: false, start: -1, query: "", matches: [], activeIndex: 0};
    if (wasActive) renderMentionDropdown();
}

function moveMentionSelection(delta) {
    if (!mentionState.active || !mentionState.matches.length) return;
    const count = mentionState.matches.length;
    mentionState.activeIndex = (mentionState.activeIndex + delta + count) % count;
    renderMentionDropdown();
}

function chooseMention(user) {
    const input = $("messageInput");
    if (!input || !user) return;
    const value = input.value;
    const cursor = input.selectionStart;
    const before = value.slice(0, mentionState.start);
    const after = value.slice(cursor);
    const insertText = "@" + (user.isAll ? "all" : (user.displayName || user.loginId)) + " ";
    input.value = before + insertText + after;
    const newCursor = before.length + insertText.length;
    closeMentionDropdown();
    input.focus();
    input.setSelectionRange(newCursor, newCursor);
}

function renderMentionDropdown() {
    const dropdown = $("mentionDropdown");
    if (!dropdown) return;
    dropdown.innerHTML = "";
    if (!mentionState.active || !mentionState.matches.length) {
        dropdown.classList.add("hidden");
        return;
    }
    mentionState.matches.forEach((user, index) => {
        const item = document.createElement("div");
        item.className = "mention-dropdown-item" + (index === mentionState.activeIndex ? " active" : "") + (user.isAll ? " mention-all-item" : "");

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        if (user.isAll) {
            avatar.classList.add("avatar-all");
            avatar.textContent = "📢";
        } else {
            applyAvatarStyle(avatar, user.avatarKey);
            avatar.textContent = avatarLabel(user.avatarKey);
        }

        const name = document.createElement("span");
        name.className = "mention-dropdown-name";
        name.textContent = user.isAll ? "전체 (@all)" : user.displayName;

        item.append(avatar, name);
        // mousedown에서 preventDefault로 textarea 포커스를 유지해야 blur가 먼저 발생해 클릭이 씹히지 않는다.
        item.addEventListener("mousedown", event => {
            event.preventDefault();
            chooseMention(user);
        });
        dropdown.appendChild(item);
    });
    dropdown.classList.remove("hidden");
}

// 메시지에 멘션된 사용자 ID로부터 표시할 닉네임을 찾는다. 현재 방 참여자 목록을 우선 쓰고,
// 방을 나간 사용자 등은 전체 사용자 캐시에서 보조로 찾는다.
function mentionDisplayNameForUserId(userId) {
    if (me && me.userId === userId) return me.displayName;
    const fromRoom = currentRoomMembers.find(u => u.userId === userId);
    if (fromRoom) return fromRoom.displayName;
    const fromAll = allUsersCache.find(u => u.userId === userId);
    return fromAll ? fromAll.displayName : "";
}

function escapeRegExp(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 렌더링된 메시지 DOM에서 "@닉네임" 부분을 강조 표시한다(코드 블록 내부는 건드리지 않음).
// 나를 멘션한 경우에는 별도 스타일(mention-me)을 추가로 입혀 카카오톡처럼 눈에 띄게 한다.
function highlightMentions(container, mentionedUserIds) {
    if (!Array.isArray(mentionedUserIds) || !mentionedUserIds.length) return;
    const iAmMentioned = !!(me && mentionedUserIds.indexOf(me.userId) !== -1);
    const names = mentionedUserIds
        .map(id => ({name: mentionDisplayNameForUserId(id), isMe: !!(me && id === me.userId)}))
        .filter(item => item.name);
    // "@all"/"@전체"로 방 전체를 멘션한 경우 실제 본문에는 각자의 닉네임이 아니라
    // "all"/"전체" 글자만 있으므로, 별도의 강조 대상으로 추가한다.
    names.push({name: "all", isMe: iAmMentioned});
    names.push({name: "전체", isMe: iAmMentioned});
    if (!names.length) return;
    names.sort((a, b) => b.name.length - a.name.length);
    walkAndHighlightMentions(container, names);
}

function walkAndHighlightMentions(node, names) {
    if (node.nodeType === 1 && node.classList && node.classList.contains("code-block")) return;
    Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
            const parts = splitMentionTextNode(child.textContent, names);
            if (parts) {
                const fragment = document.createDocumentFragment();
                parts.forEach(part => {
                    if (typeof part === "string") {
                        fragment.appendChild(document.createTextNode(part));
                    } else {
                        const span = document.createElement("span");
                        span.className = "mention" + (part.isMe ? " mention-me" : "");
                        span.textContent = part.text;
                        fragment.appendChild(span);
                    }
                });
                child.replaceWith(fragment);
            }
        } else if (child.nodeType === 1) {
            walkAndHighlightMentions(child, names);
        }
    });
}

function splitMentionTextNode(text, names) {
    if (!text || text.indexOf("@") === -1) return null;
    const pattern = new RegExp("@(" + names.map(n => escapeRegExp(n.name)).join("|") + ")(?:님)?(?![\\p{L}\\p{N}_])", "gu");
    let match;
    let lastIndex = 0;
    let matched = false;
    const result = [];
    while ((match = pattern.exec(text)) !== null) {
        matched = true;
        if (match.index > lastIndex) result.push(text.slice(lastIndex, match.index));
        const found = names.find(n => n.name === match[1]);
        result.push({text: match[0], isMe: !!(found && found.isMe)});
        lastIndex = match.index + match[0].length;
    }
    if (!matched) return null;
    if (lastIndex < text.length) result.push(text.slice(lastIndex));
    return result;
}

async function openPendingRoomFromNotification() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    const data = await chrome.storage.local.get({pendingOpenRoomId: null});
    const pendingRoomId = Number(data.pendingOpenRoomId || 0);
    if (!pendingRoomId) return;

    await chrome.storage.local.remove("pendingOpenRoomId");
    const room = lastRooms.find(item => Number(item.id) === pendingRoomId);
    if (room) {
        await enterRoom(room.id, room.name, room.type);
    }
}

async function createRoom() {
    const name = $("roomName").value.trim();
    const type = $("roomType").value;
    const members = roomMemberCandidates.map(u => u.loginId);
    if (type === "PRIVATE" && members.length !== 1) {
        return showInfo("개인방은 본인을 제외하고 상대방 1명을 선택해야 합니다.");
    }

    try {
        await api("/api/rooms", {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({name, type, members})
        });
        roomMemberCandidates = [];
        renderRoomMemberCandidates();
        $("roomName").value = "";
        await loadRooms();
        showInfo("방이 생성되었습니다.");
    } catch (e) {
        showInfo(e.message);
    }
}

function connect(callback) {
    if (callback) pendingConnectCallbacks.push(callback);
    if (stompClient && stompClient.connected) {
        flushConnectCallbacks();
        return;
    }
    if (connecting) return;

    connecting = true;
    const socket = new SockJS(serverUrl("/ws"));
    stompClient = Stomp.over(socket);
    stompClient.debug = null;
    stompClient.connect({}, () => {
        connecting = false;
        flushConnectCallbacks();
        subscribeKnownRooms();
    }, () => {
        connecting = false;
        showInfo("서버 연결에 실패했습니다.");
    });
}

function flushConnectCallbacks() {
    const callbacks = pendingConnectCallbacks.splice(0);
    callbacks.forEach(callback => callback());
}

function subscribeKnownRooms() {
    if (!lastRooms.length || !token()) return;
    connect(() => {
        lastRooms.forEach(room => {
            if (roomSubscriptions[room.id]) return;
            roomSubscriptions[room.id] = stompClient.subscribe(`/topic/rooms/${room.id}`, msg => {
                handleIncomingMessage(room.id, JSON.parse(msg.body));
            });
        });
    });
}

function handleIncomingMessage(roomId, message) {
    const isCurrentRoom = roomId === currentRoomId;
    const isMine = message.senderUserId && me && message.senderUserId === me.userId;
    markMessageSeen(roomId, message);

    if (isCurrentRoom) {
        renderMessage(message);
        loadMembers();
    } else {
        unreadRoomIds.add(roomId);
        renderRooms();
    }

    loadRooms({silent: true});
    if (!isMine && message.type !== "SYSTEM") {
        notifyIncomingMessage(roomId, message);
    }
}

async function enterRoom(roomId, roomName, roomType) {
    currentRoomId = roomId;
    currentRoomType = roomType;
    currentRoomName = roomName;
    $("memberAddPanel").classList.add("hidden");
    $("roomActions").classList.add("hidden");
    $("roomActionToggle").classList.remove("hidden");
    $("roomActionToggle").classList.remove("expanded");
    $("roomActionToggle").setAttribute("aria-expanded", "false");
    unreadRoomIds.delete(roomId);
    $("currentRoomTitle").textContent = roomName;
    // 멘션 하이라이트/자동완성이 참여자 목록을 참조하므로, 메시지를 그리기 전에 먼저 받아온다.
    await loadMembers();
    await loadHistory();
    renderRooms();
    subscribeKnownRooms();
}

async function loadHistory() {
    try {
        const messages = await api(`/api/rooms/${currentRoomId}/messages?limit=${MESSAGE_PAGE_SIZE}`, {headers: authHeaders(false)});
        $("messages").innerHTML = "";
        oldestLoadedMessageId = null;
        hasOlderMessages = messages.length === MESSAGE_PAGE_SIZE;
        messages.forEach(renderMessage);
        updateOldestLoadedMessageId(messages);
        renderOlderMessagesButton();
        markLatestMessagesSeen(currentRoomId, messages);
        scrollMessagesToBottom();
    } catch (e) {
        showInfo(e.message);
    }
}

async function loadOlderMessages() {
    if (!currentRoomId || !oldestLoadedMessageId) return;
    const box = $("messages");
    const previousHeight = box.scrollHeight;
    suppressAutoScroll = true;

    try {
        removeOlderMessagesButton();
        const messages = await api(`/api/rooms/${currentRoomId}/messages?limit=${MESSAGE_PAGE_SIZE}&beforeId=${oldestLoadedMessageId}`, {headers: authHeaders(false)});
        hasOlderMessages = messages.length === MESSAGE_PAGE_SIZE;
        prependMessages(messages);
        updateOldestLoadedMessageId(messages);
        renderOlderMessagesButton();
        requestAnimationFrame(() => {
            box.scrollTop = box.scrollHeight - previousHeight;
            suppressAutoScroll = false;
        });
    } catch (e) {
        suppressAutoScroll = false;
        renderOlderMessagesButton();
        showInfo(e.message);
    }
}

function prependMessages(messages) {
    if (!messages || messages.length === 0) return;
    const box = $("messages");
    const firstMessage = box.querySelector(".message");
    const fragment = document.createDocumentFragment();
    messages.forEach(message => fragment.appendChild(createMessageElement(message)));
    box.insertBefore(fragment, firstMessage);
}

function updateOldestLoadedMessageId(messages) {
    if (!messages || messages.length === 0) return;
    const minId = messages.reduce((min, message) => Math.min(min, Number(message.id || min)), Number(messages[0].id || 0));
    oldestLoadedMessageId = oldestLoadedMessageId == null ? minId : Math.min(oldestLoadedMessageId, minId);
}

function renderOlderMessagesButton() {
    removeOlderMessagesButton();
    if (!hasOlderMessages) return;
    const button = document.createElement("button");
    button.id = "olderMessagesButton";
    button.type = "button";
    button.className = "older-messages-button";
    button.textContent = `이전 메시지 ${MESSAGE_PAGE_SIZE}개 더 보기`;
    button.addEventListener("click", loadOlderMessages);
    $("messages").prepend(button);
}

function removeOlderMessagesButton() {
    const button = $("olderMessagesButton");
    if (button) button.remove();
}

async function loadMembers() {
    if (!currentRoomId) return;
    try {
        const members = await api(`/api/rooms/${currentRoomId}/members`, {headers: authHeaders(false)});
        currentRoomMembers = members;
        $("memberList").textContent = "참여자: " + members.map(m => `${m.displayName}(${m.loginId})`).join(", ");
    } catch (e) {
        currentRoomMembers = [];
        $("memberList").textContent = "";
    }
}

async function addMember() {
    if (!currentRoomId) return showInfo("방을 선택하세요.");
    if (currentRoomType === "PRIVATE") return showInfo("개인방에는 사용자를 추가할 수 없습니다.");
    const loginId = $("addMemberSelect").value;
    if (!loginId) return showInfo("추가할 사용자를 선택하세요.");

    try {
        await api(`/api/rooms/${currentRoomId}/members`, {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({loginId})
        });
        $("userSearchKeyword").value = "";
        fillUserSelect("addMemberSelect", allUsersCache, "");
        await loadMembers();
    } catch (e) {
        showInfo(e.message);
    }
}

function debounceUserSearch(fn) {
    clearTimeout(userSearchTimer);
    userSearchTimer = setTimeout(fn, 120);
}

async function searchUsers(keyword) {
    return api(`/api/auth/users?q=${encodeURIComponent(keyword || "")}`, {headers: authHeaders(false)});
}

async function loadAllUsers() {
    try {
        allUsersCache = await searchUsers("");
        fillUserSelect("addMemberSelect", allUsersCache, "");
        fillUserSelect("roomMemberSelect", allUsersCache, "");
    } catch (e) {
        console.warn(e);
    }
}

function filterUsersLocal(keyword) {
    const q = String(keyword || "").trim().toLowerCase();
    const users = allUsersCache.filter(u => u.userId !== me.userId);
    if (!q) return users;
    return users.filter(u =>
        String(u.loginId || "").toLowerCase().includes(q) ||
        String(u.displayName || "").toLowerCase().includes(q)
    );
}

function fillUserSelect(selectId, users, keyword) {
    const select = $(selectId);
    select.innerHTML = '<option value="">사용자 선택</option>';
    if (!users || users.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = keyword ? "검색 결과가 없습니다" : "등록된 사용자가 없습니다";
        select.appendChild(opt);
        return;
    }
    users.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.loginId;
        opt.textContent = `${u.displayName} (${u.loginId})`;
        select.appendChild(opt);
    });
    if (keyword && users.length === 1) select.value = users[0].loginId;
}

function searchUsersForAdd() {
    debounceUserSearch(() => {
        const keyword = $("userSearchKeyword").value.trim();
        fillUserSelect("addMemberSelect", filterUsersLocal(keyword), keyword);
    });
}

function searchUsersForRoom() {
    debounceUserSearch(() => {
        const keyword = $("roomMemberSearchKeyword").value.trim();
        fillUserSelect("roomMemberSelect", filterUsersLocal(keyword), keyword);
    });
}

function addRoomMemberCandidate() {
    const select = $("roomMemberSelect");
    const loginId = select.value;
    if (!loginId) return showInfo("초대할 사용자를 선택해 주세요.");
    const user = allUsersCache.find(u => u.loginId === loginId);
    addCandidate(user || {loginId, displayName: select.options[select.selectedIndex].textContent});
}

function bulkAddRoomMembers() {
    const keyword = $("roomMemberSearchKeyword").value.trim();
    const users = filterUsersLocal(keyword);
    if (!users.length) return showInfo("일괄 추가할 검색 결과가 없습니다.");
    const before = roomMemberCandidates.length;
    users.forEach(addCandidate);
    renderRoomMemberCandidates();
    showInfo(`${roomMemberCandidates.length - before}명을 초대 목록에 추가했습니다.`);
}

function addCandidate(user) {
    if (!user || !user.loginId) return;
    if (roomMemberCandidates.some(u => u.loginId === user.loginId)) return;
    const label = user.displayName ? `${user.displayName} (${user.loginId})` : user.loginId;
    roomMemberCandidates.push({loginId: user.loginId, label});
    renderRoomMemberCandidates();
}

function clearRoomMemberCandidates() {
    roomMemberCandidates = [];
    renderRoomMemberCandidates();
}

function removeRoomMemberCandidate(loginId) {
    roomMemberCandidates = roomMemberCandidates.filter(u => u.loginId !== loginId);
    renderRoomMemberCandidates();
}

function renderRoomMemberCandidates() {
    const box = $("roomMemberCandidates");
    if (roomMemberCandidates.length === 0) {
        box.textContent = "초대할 사용자를 검색해서 추가하세요.";
        return;
    }
    box.innerHTML = "";
    roomMemberCandidates.forEach(u => {
        const span = document.createElement("span");
        const text = document.createElement("span");
        const button = document.createElement("button");
        span.className = "candidate";
        text.textContent = u.label;
        button.type = "button";
        button.textContent = "x";
        button.addEventListener("click", () => removeRoomMemberCandidate(u.loginId));
        span.append(text, button);
        box.appendChild(span);
    });
}

function createMessageElement(m) {
    const box = document.createElement("div");
    if (m.type === "SYSTEM") {
        box.className = "message system";
        box.textContent = m.content;
    } else {
        box.className = "message" + (m.senderUserId === me.userId ? " mine" : "");
        const avatar = document.createElement("div");
        const bubble = document.createElement("div");
        const meta = document.createElement("div");
        const content = document.createElement("div");
        const time = (m.createdAt || "").replace("T", " ").substring(0, 19);
        const avatarKey = avatarKeyForUserId(m.senderUserId);
        avatar.className = "avatar message-avatar";
        applyAvatarStyle(avatar, avatarKey);
        avatar.textContent = avatarLabel(avatarKey);
        bubble.className = "message-bubble";
        meta.className = "meta";
        content.className = "message-content";
        const sender = document.createElement("strong");
        sender.textContent = m.senderDisplayName;
        meta.append(sender, ` · ${time}`);
        if (m.senderUserId === me.userId) {
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "message-delete";
            deleteButton.textContent = "x";
            deleteButton.title = "메시지 삭제";
            deleteButton.addEventListener("click", event => {
                event.stopPropagation();
                deleteMessage(m.id);
            });
            bubble.appendChild(deleteButton);
        }
        if (m.type === "FILE") {
            const link = document.createElement("a");
            link.href = serverUrl(`/api/files/${m.id}`);
            link.target = "_blank";
            link.className = "file-link";
            link.textContent = m.originalFileName || m.content;
            content.appendChild(link);
        } else {
            renderMessageContent(content, m.content);
            highlightMentions(content, m.mentionedUserIds);
        }
        bubble.append(meta, content);
        box.append(avatar, bubble);
    }
    return box;
}

function renderMessage(m) {
    const box = createMessageElement(m);
    $("messages").appendChild(box);
    updateOldestLoadedMessageId([m]);
    scrollMessagesToBottom();
}

function sendMessage() {
    if (!currentRoomId) return showInfo("방을 선택하세요.");
    const input = $("messageInput");
    const content = input.value;
    if (!content.trim()) return;
    connect(() => {
        stompClient.send("/app/chat.send", {}, JSON.stringify({
            roomId: currentRoomId,
            token: token(),
            content
        }));
        input.value = "";
        closeMentionDropdown();
    });
}

function insertCodeBlock() {
    const input = $("messageInput");
    const langSelect = $("codeLangSelect");
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const value = input.value;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const selected = value.slice(start, end);
    const needsLeadingNewline = before.length > 0 && !before.endsWith("\n");
    const needsTrailingNewline = after.length > 0 && !after.startsWith("\n");
    // 언어 선택 드롭다운에서 명시적으로 고른 언어가 있으면 그걸 그대로 쓰고,
    // "자동감지"로 남겨뒀을 때만 선택된 텍스트로부터 언어를 추측한다.
    const chosenLang = langSelect ? langSelect.value : "";
    const lang = chosenLang || (selected && typeof detectLanguage === "function" ? (detectLanguage(selected) || "") : "");
    const bodyText = selected || "";
    const bodyWithNewline = bodyText && !bodyText.endsWith("\n") ? bodyText + "\n" : bodyText;
    const block = (needsLeadingNewline ? "\n" : "") + "```" + lang + "\n" + bodyWithNewline + "```" + (needsTrailingNewline ? "\n" : "");

    input.value = before + block + after;
    input.focus();

    if (selected) {
        const cursorPos = before.length + block.length;
        input.setSelectionRange(cursorPos, cursorPos);
    } else {
        const cursorPos = before.length + (needsLeadingNewline ? 1 : 0) + 3 + lang.length + 1;
        input.setSelectionRange(cursorPos, cursorPos);
    }
}

async function uploadFile() {
    if (!currentRoomId) return showInfo("방을 선택하세요.");
    const file = $("fileInput").files[0];
    if (!file) return showInfo("파일을 선택하세요.");
    const form = new FormData();
    form.append("roomId", currentRoomId);
    form.append("file", file);

    try {
        const res = await fetch(serverUrl("/api/files"), {
            method: "POST",
            headers: {"X-Auth-Token": token()},
            body: form
        });
        if (!res.ok) throw new Error(toFriendlyError(await res.text(), res.status));
        $("fileInput").value = "";
    } catch (e) {
        showInfo(e.message);
    }
}

async function leaveRoom() {
    if (!currentRoomId) return;
    if (!confirm("이 방에서 나갈까요?")) return;
    try {
        await api(`/api/rooms/${currentRoomId}/leave`, {method: "POST", headers: authHeaders(false)});
        clearCurrentRoom();
        await loadRooms();
    } catch (e) {
        showInfo(e.message);
    }
}

async function deleteRoom() {
    if (!currentRoomId) return;
    await deleteRoomById(currentRoomId);
}

async function deleteRoomById(roomId) {
    if (!roomId) return;
    if (!confirm("이 방을 삭제할까요? 메시지 기록도 삭제됩니다.")) return;
    try {
        await api(`/api/rooms/${roomId}`, {method: "DELETE", headers: authHeaders(false)});
        if (roomId === currentRoomId) clearCurrentRoom();
        await loadRooms();
    } catch (e) {
        showInfo(e.message);
    }
}

async function renameRoom() {
    if (!currentRoomId) return showInfo("방을 선택하세요.");
    const name = prompt("변경할 방 이름을 입력하세요.", currentRoomName || $("currentRoomTitle").textContent || "");
    if (name === null) return;
    const cleanName = name.trim();
    if (!cleanName) return showInfo("방 이름을 입력해 주세요.");
    try {
        const room = await api(`/api/rooms/${currentRoomId}/name`, {
            method: "PUT",
            headers: authHeaders(true),
            body: JSON.stringify({name: cleanName})
        });
        currentRoomName = room.name;
        roomNames[currentRoomId] = room.name;
        $("currentRoomTitle").textContent = room.name;
        await loadRooms();
    } catch (e) {
        showInfo(e.message);
    }
}

async function deleteMessage(messageId) {
    if (!currentRoomId || !messageId) return;
    if (!confirm("이 메시지를 삭제할까요?")) return;
    try {
        await api(`/api/rooms/${currentRoomId}/messages/${messageId}`, {
            method: "DELETE",
            headers: authHeaders(false)
        });
        await loadHistory();
    } catch (e) {
        showInfo(e.message);
    }
}

function clearCurrentRoom() {
    currentRoomId = null;
    currentRoomType = null;
    currentRoomName = "";
    currentRoomMembers = [];
    closeMentionDropdown();
    $("currentRoomTitle").textContent = "방을 선택하세요";
    $("memberList").textContent = "";
    $("messages").innerHTML = "";
    $("memberAddPanel").classList.add("hidden");
    $("roomActions").classList.add("hidden");
    $("roomActionToggle").classList.add("hidden");
    $("roomActionToggle").classList.remove("expanded");
    $("roomActionToggle").setAttribute("aria-expanded", "false");
    renderRooms();
}

function toggleRoomCreatePanel() {
    const panel = $("roomCreatePanel");
    const expanded = panel.classList.toggle("hidden") === false;
    $("roomCreateToggle").setAttribute("aria-expanded", String(expanded));
}

function toggleProfileDetails() {
    const panel = $("profileDetails");
    const expanded = panel.classList.toggle("hidden") === false;
    $("profileToggle").setAttribute("aria-expanded", String(expanded));
}

function toggleMemberAddPanel() {
    if (!currentRoomId) return showInfo("방을 선택하세요.");
    if (currentRoomType !== "GROUP") return showInfo("단체방에서만 사용자를 추가할 수 있습니다.");
    $("memberAddPanel").classList.toggle("hidden");
}

function toggleRoomActions() {
    if (!currentRoomId) return;
    const actions = $("roomActions");
    const toggle = $("roomActionToggle");
    const expanded = actions.classList.toggle("hidden") === false;
    toggle.classList.toggle("expanded", expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
}

function notificationsEnabled() {
    return localStorage.getItem("notificationsEnabled") === "true";
}

async function setNotificationsEnabled(enabled) {
    localStorage.setItem("notificationsEnabled", String(enabled));
    saveExtensionSettings({notificationsEnabled: enabled});
    if (!enabled || (typeof chrome !== "undefined" && chrome.notifications)) return;
    if (!("Notification" in window) || Notification.permission === "granted") return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
        localStorage.setItem("notificationsEnabled", "false");
        saveExtensionSettings({notificationsEnabled: false});
        $("notificationToggle").checked = false;
        showInfo("브라우저 알림 권한이 허용되지 않았습니다.");
    }
}

function saveExtensionSettings(values) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.set(values);
}

function markPopupActive() {
    saveExtensionSettings({popupActiveUntil: Date.now() + 12000});
}

function markPopupInactive() {
    if (popupPresenceTimer) clearInterval(popupPresenceTimer);
    saveExtensionSettings({popupActiveUntil: 0});
}

// 메시지에 내가 멘션되어 있는지 확인한다. 멘션된 경우에는 알림 설정/화면 표시 여부와 무관하게
// 무조건 알림을 띄워야 하므로(카카오톡 멘션과 동일한 필수 요구사항), 아래 notifyIncomingMessage에서
// 이 값으로 알림 조건을 우회한다.
function isMentionedMe(message) {
    return !!(me && message && Array.isArray(message.mentionedUserIds) && message.mentionedUserIds.indexOf(me.userId) !== -1);
}

function notifyIncomingMessage(roomId, message) {
    const mentionedMe = isMentionedMe(message);
    // 멘션이 아니면 기존처럼 "알림 설정 켜짐" + "현재 화면이 보이지 않을 때"만 알린다.
    // 멘션이면 두 조건을 모두 무시하고 항상 알림을 띄운다(필수 요구사항).
    if (!mentionedMe) {
        if (!notificationsEnabled()) return;
        if (document.visibilityState === "visible") return;
    }
    const roomName = (mentionedMe ? "[멘션] " : "") + (roomNames[roomId] || "새 메시지");
    const sender = message.senderDisplayName || "알 수 없음";
    const body = message.type === "FILE" ? `${sender}: 파일을 보냈습니다.` : `${sender}: ${message.content || ""}`;
    const shortBody = body.substring(0, 120);

    if (typeof chrome !== "undefined" && chrome.notifications) {
        chrome.notifications.create(`room-${roomId}-${Date.now()}`, {
            type: "basic",
            iconUrl: "icon.png",
            title: roomName,
            message: shortBody
        });
        return;
    }

    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") {
        // 멘션 알림은 필수이므로, 권한이 아직 결정되지 않았다면 이 시점에 요청해서라도 띄워본다.
        if (mentionedMe && Notification.permission === "default") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    try { new Notification(roomName, {body: shortBody, tag: `room-${roomId}`}); } catch (ignore) {}
                }
            });
        }
        return;
    }
    try {
        new Notification(roomName, {
            body: shortBody,
            tag: `room-${roomId}`
        });
    } catch (ignore) {}
}

async function markMessageSeen(roomId, message) {
    const messageId = Number(message && message.id || 0);
    if (!messageId || typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    const data = await chrome.storage.local.get({lastSeenMessageIds: {}, initializedRooms: {}});
    const lastSeenMessageIds = data.lastSeenMessageIds || {};
    const initializedRooms = data.initializedRooms || {};
    lastSeenMessageIds[roomId] = Math.max(Number(lastSeenMessageIds[roomId] || 0), messageId);
    initializedRooms[roomId] = true;
    chrome.storage.local.set({lastSeenMessageIds, initializedRooms});
}

function markLatestMessagesSeen(roomId, messages) {
    if (!messages || !messages.length) return;
    const latest = messages.reduce((max, message) => Number(message.id || 0) > Number(max.id || 0) ? message : max, messages[0]);
    markMessageSeen(roomId, latest);
}

function bindEvents() {
    $("loginButton").addEventListener("click", login);
    $("registerButton").addEventListener("click", register);
    $("refreshRoomsButton").addEventListener("click", loadRooms);
    $("changeNicknameButton").addEventListener("click", changeNickname);
    $("logoutButton").addEventListener("click", logout);
    $("profileToggle").addEventListener("click", toggleProfileDetails);
    $("avatarColorInput").addEventListener("input", event => updateCustomAvatarColor(event.target.value));
    $("avatarHexInput").addEventListener("change", event => updateCustomAvatarColor(event.target.value));
    $("avatarHexInput").addEventListener("keydown", event => {
        if (event.key === "Enter") updateCustomAvatarColor(event.target.value);
    });
    $("roomCreateToggle").addEventListener("click", toggleRoomCreatePanel);
    $("createRoomButton").addEventListener("click", createRoom);
    $("addRoomMemberCandidateButton").addEventListener("click", addRoomMemberCandidate);
    $("bulkAddRoomMembersButton").addEventListener("click", bulkAddRoomMembers);
    $("clearRoomMemberCandidatesButton").addEventListener("click", clearRoomMemberCandidates);
    $("addMemberButton").addEventListener("click", addMember);
    $("roomActionToggle").addEventListener("click", toggleRoomActions);
    $("toggleMemberAddButton").addEventListener("click", toggleMemberAddPanel);
    $("renameRoomButton").addEventListener("click", renameRoom);
    $("leaveRoomButton").addEventListener("click", leaveRoom);
    $("sendMessageButton").addEventListener("click", sendMessage);
    $("insertCodeButton").addEventListener("click", insertCodeBlock);
    $("uploadFileButton").addEventListener("click", () => $("fileInput").click());
    $("fileInput").addEventListener("change", uploadFile);
    $("userSearchKeyword").addEventListener("input", searchUsersForAdd);
    $("roomMemberSearchKeyword").addEventListener("input", searchUsersForRoom);
    $("messageInput").addEventListener("keydown", event => {
        // 멘션 후보 목록이 떠 있는 동안에는 방향키/엔터/Esc가 목록 탐색에 먼저 쓰이도록 한다(카카오톡과 동일한 조작감).
        if (mentionState.active && mentionState.matches.length) {
            if (event.key === "ArrowDown") { event.preventDefault(); moveMentionSelection(1); return; }
            if (event.key === "ArrowUp") { event.preventDefault(); moveMentionSelection(-1); return; }
            if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                chooseMention(mentionState.matches[mentionState.activeIndex]);
                return;
            }
            if (event.key === "Escape") { event.preventDefault(); closeMentionDropdown(); return; }
        } else if (mentionState.active && event.key === "Escape") {
            event.preventDefault();
            closeMentionDropdown();
            return;
        }

        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
            return;
        }
        if (event.key === "Tab") {
            // 코드 작성 시 들여쓰기를 유지할 수 있도록 Tab으로 포커스가 이동하지 않고 공백을 삽입한다.
            event.preventDefault();
            const input = event.target;
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = input.value.slice(0, start) + "    " + input.value.slice(end);
            input.selectionStart = input.selectionEnd = start + 4;
        }
    });
    $("messageInput").addEventListener("input", updateMentionState);
    $("messageInput").addEventListener("click", updateMentionState);
    $("messageInput").addEventListener("keyup", event => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) !== -1) updateMentionState();
    });
    $("messageInput").addEventListener("blur", closeMentionDropdown);
    $("notificationToggle").addEventListener("change", event => setNotificationsEnabled(event.target.checked));
    $("serverUrl").addEventListener("change", event => saveServerBaseUrl(event.target.value));
    $("serverUrlInApp").addEventListener("change", event => saveServerBaseUrl(event.target.value));
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("pagehide", markPopupInactive);
