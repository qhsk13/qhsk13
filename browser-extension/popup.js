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
let selectedAvatarKey = "aurora";
let popupPresenceTimer = null;
const AVATAR_OPTIONS = [
    {key: "aurora", label: "A", color: "#6d6af2"},
    {key: "mint", label: "M", color: "#10b981"},
    {key: "violet", label: "V", color: "#8b5cf6"},
    {key: "peach", label: "P", color: "#fb7185"},
    {key: "sky", label: "S", color: "#0ea5e9"},
    {key: "mono", label: "N", color: "#64748b"}
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
    selectedAvatarKey = me.avatarKey || "aurora";
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

async function loadRooms() {
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
        showInfo(e.message);
    }
}

function renderRooms() {
    const el = $("rooms");
    el.innerHTML = "";
    $("roomCount").textContent = lastRooms.length ? `${lastRooms.length}개` : "";
    lastRooms.forEach(room => {
        const div = document.createElement("div");
        const label = document.createElement("span");
        const deleteButton = document.createElement("button");
        const unread = unreadRoomIds.has(room.id) ? " unread" : "";
        div.className = "room" + (room.id === currentRoomId ? " active" : "") + unread;
        label.textContent = `[${room.type === "PRIVATE" ? "개인" : "단체"}] ${room.name}`;
        deleteButton.type = "button";
        deleteButton.className = "room-delete";
        deleteButton.textContent = "x";
        deleteButton.title = "방 삭제";
        deleteButton.addEventListener("click", event => {
            event.stopPropagation();
            deleteRoomById(room.id);
        });
        div.addEventListener("click", () => enterRoom(room.id, room.name, room.type));
        div.append(label, deleteButton);
        el.appendChild(div);
    });
}

function renderMyAvatar() {
    const avatar = $("myAvatar");
    if (!avatar) return;
    applyAvatarStyle(avatar, selectedAvatarKey);
    avatar.textContent = avatarLabel(me.displayName, selectedAvatarKey);
    syncCustomColorInputs();
}

function renderAvatarPicker() {
    const picker = $("avatarPicker");
    if (!picker) return;
    picker.innerHTML = "";
    AVATAR_OPTIONS.forEach(option => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `avatar-choice avatar avatar-${option.key}` + (option.key === selectedAvatarKey ? " selected" : "");
        button.textContent = option.label;
        button.title = "프로필 아이콘 선택";
        button.addEventListener("click", () => {
            setSelectedAvatarKey(option.key);
            renderMyAvatar();
            renderAvatarPicker();
        });
        picker.appendChild(button);
    });
}

function avatarLabel(displayName, avatarKey) {
    const text = String(displayName || "").trim();
    if (text) return text.substring(0, 1).toUpperCase();
    const option = AVATAR_OPTIONS.find(item => item.key === avatarKey);
    return option ? option.label : "U";
}

function avatarKeyForUserId(userId) {
    if (me && me.userId === userId) return me.avatarKey || selectedAvatarKey || "aurora";
    const user = allUsersCache.find(item => item.userId === userId);
    return user && user.avatarKey ? user.avatarKey : "aurora";
}

function applyAvatarStyle(element, avatarKey) {
    const customColor = customColorFromAvatarKey(avatarKey);
    const keepMessageClass = element.classList.contains("message-avatar");
    if (customColor) {
        element.className = element.className
            .split(/\s+/)
            .filter(name => name && name !== "avatar" && name !== "message-avatar" && !name.startsWith("avatar-"))
            .join(" ");
        element.classList.add("avatar");
        if (keepMessageClass) element.classList.add("message-avatar");
        element.style.backgroundColor = customColor;
        return;
    }
    const key = AVATAR_OPTIONS.some(option => option.key === avatarKey) ? avatarKey : "aurora";
    element.className = keepMessageClass ? `avatar message-avatar avatar-${key}` : `avatar avatar-${key}`;
    element.style.backgroundColor = "";
}

function setSelectedAvatarKey(avatarKey) {
    selectedAvatarKey = avatarKey;
    syncCustomColorInputs();
}

function customColorFromAvatarKey(avatarKey) {
    const match = String(avatarKey || "").match(/^custom:(#[0-9a-fA-F]{6})$/);
    return match ? match[1].toUpperCase() : "";
}

function selectedAvatarColor() {
    const customColor = customColorFromAvatarKey(selectedAvatarKey);
    if (customColor) return customColor;
    const option = AVATAR_OPTIONS.find(item => item.key === selectedAvatarKey);
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
    setSelectedAvatarKey("custom:" + color);
    renderMyAvatar();
    renderAvatarPicker();
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

    loadRooms();
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
    await loadHistory();
    await loadMembers();
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
        $("memberList").textContent = "참여자: " + members.map(m => `${m.displayName}(${m.loginId})`).join(", ");
    } catch (e) {
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
        avatar.textContent = avatarLabel(m.senderDisplayName, avatarKey);
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
            content.textContent = m.content;
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
    const content = input.value.trim();
    if (!content) return;
    connect(() => {
        stompClient.send("/app/chat.send", {}, JSON.stringify({
            roomId: currentRoomId,
            token: token(),
            content
        }));
        input.value = "";
    });
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
    if (currentRoomType === "PRIVATE") return showInfo("개인방에는 사용자를 추가할 수 없습니다.");
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

function notifyIncomingMessage(roomId, message) {
    if (!notificationsEnabled()) return;
    if (document.visibilityState === "visible") return;
    const roomName = roomNames[roomId] || "새 메시지";
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

    if (!("Notification" in window) || Notification.permission !== "granted") return;
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
    $("uploadFileButton").addEventListener("click", () => $("fileInput").click());
    $("fileInput").addEventListener("change", uploadFile);
    $("userSearchKeyword").addEventListener("input", searchUsersForAdd);
    $("roomMemberSearchKeyword").addEventListener("input", searchUsersForRoom);
    $("messageInput").addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    $("notificationToggle").addEventListener("change", event => setNotificationsEnabled(event.target.checked));
    $("serverUrl").addEventListener("change", event => saveServerBaseUrl(event.target.value));
    $("serverUrlInApp").addEventListener("change", event => saveServerBaseUrl(event.target.value));
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("pagehide", markPopupInactive);
