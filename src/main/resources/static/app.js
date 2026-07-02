let stompClient = null;
let currentRoomId = null;
let currentRoomType = null;
let subscription = null;
let me = null;
let roomMemberCandidates = [];
let allUsersCache = [];
let messageScrollObserver = null;
let suppressAutoScroll = false;
let oldestLoadedMessageId = null;
let hasOlderMessages = false;
const MESSAGE_PAGE_SIZE = 50;
let currentRoomName = "";
let selectedAvatarKey = "aurora";
const AVATAR_OPTIONS = [
    {key: "aurora", label: "A", color: "#6d6af2"},
    {key: "mint", label: "M", color: "#10b981"},
    {key: "violet", label: "V", color: "#8b5cf6"},
    {key: "peach", label: "P", color: "#fb7185"},
    {key: "sky", label: "S", color: "#0ea5e9"},
    {key: "mono", label: "N", color: "#64748b"}
];

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
}

function token() {
    return localStorage.getItem("authToken") || "";
}

function authHeaders(json) {
    const h = {"X-Auth-Token": token()};
    if (json) h["Content-Type"] = "application/json";
    return h;
}

async function api(url, options) {
    const res = await fetch(url, options || {});
    if (!res.ok) {
        const text = await res.text();
        throw new Error(toFriendlyError(text, res.status));
    }
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

    if (!raw) return "요청 처리 중 오류가 발생했습니다.";
    if (raw.indexOf("아이디") >= 0 || raw.indexOf("비밀번호") >= 0 || raw.indexOf("닉네임") >= 0) return raw;
    if (raw.indexOf("방 이름") >= 0 || raw.indexOf("사용자") >= 0 || raw.indexOf("참여자") >= 0) return raw;
    if (status === 400) return "입력값을 확인해주세요.";
    if (status === 401 || status === 403) return "로그인이 필요하거나 권한이 없습니다.";
    if (status === 404) return "요청한 정보를 찾을 수 없습니다.";
    return "처리 중 오류가 발생했습니다. 입력값 또는 서버 상태를 확인해주세요.";
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
    const el = document.getElementById("messages");
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
    const el = document.getElementById("messages");
    if (!el || messageScrollObserver) return;
    messageScrollObserver = new MutationObserver(() => {
        if (!suppressAutoScroll) scrollMessagesToBottom();
    });
    messageScrollObserver.observe(el, {childList: true, subtree: true});
}

async function register() {
    const loginId = document.getElementById("loginId").value.trim();
    const password = document.getElementById("password").value;
    const displayName = document.getElementById("displayName").value.trim();

    if (!requireValue(loginId, "회원가입할 아이디를 입력해주세요.")) return;
    if (!requireValue(password, "회원가입할 비밀번호를 입력해주세요.")) return;
    if (password.length < 4) return showInfo("비밀번호는 4자 이상 입력해주세요.");
    if (!requireValue(displayName, "사용할 닉네임을 입력해주세요.")) return;

    try {
        const data = await api("/api/auth/register", {
            method:"POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ loginId, password, displayName })
        });
        saveAuth(data);
        showInfo("회원가입이 완료되었습니다.");
    } catch (e) { showInfo(e.message); }
}

async function login() {
    const loginId = document.getElementById("loginId").value.trim();
    const password = document.getElementById("password").value;

    if (!requireValue(loginId, "아이디를 입력해주세요.")) return;
    if (!requireValue(password, "비밀번호를 입력해주세요.")) return;

    try {
        const data = await api("/api/auth/login", {
            method:"POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ loginId, password })
        });
        saveAuth(data);
    } catch (e) { showInfo(e.message); }
}

function saveAuth(data) {
    localStorage.setItem("authToken", data.token);
    me = data;
    showApp();
}

function logout() {
    localStorage.removeItem("authToken");
    location.reload();
}

async function init() {
    installMessageAutoScroll();
    if (!token()) return;
    try {
        me = await api("/api/auth/me", {headers: authHeaders(false)});
        showApp();
    } catch (e) {
        localStorage.removeItem("authToken");
    }
}

async function showApp() {
    document.getElementById("loginPanel").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    selectedAvatarKey = me.avatarKey || avatarKeyFromText(me.displayName || me.loginId);
    document.getElementById("myDisplayName").textContent = me.displayName;
    document.getElementById("myLoginId").textContent = "ID: " + me.loginId;
    document.getElementById("nicknameInput").value = me.displayName;
    renderMyAvatar();
    renderAvatarPicker();
    await loadRooms();
    await loadAllUsers();
    renderRoomMemberCandidates();
}

async function changeNickname() {
    const displayName = document.getElementById("nicknameInput").value.trim();
    if (!requireValue(displayName, "변경할 닉네임을 입력해주세요.")) return;

    try {
        const data = await api("/api/auth/nickname", {
            method:"PUT",
            headers: authHeaders(true),
            body: JSON.stringify({displayName, avatarKey: selectedAvatarKey})
        });
        me = data;
        selectedAvatarKey = me.avatarKey || selectedAvatarKey;
        document.getElementById("myDisplayName").textContent = me.displayName;
        renderMyAvatar();
        renderAvatarPicker();
        showInfo("닉네임이 변경되었습니다.");
    } catch (e) { showInfo(e.message); }
}

function renderMyAvatar() {
    const avatar = document.getElementById("myAvatar");
    if (!avatar) return;
    applyAvatarStyle(avatar, selectedAvatarKey);
    avatar.textContent = avatarLabel(me.displayName, selectedAvatarKey);
    syncCustomColorInputs();
}

function renderAvatarPicker() {
    const picker = document.getElementById("avatarPicker");
    if (!picker) return;
    picker.innerHTML = "";
    AVATAR_OPTIONS.forEach(option => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `avatar-choice avatar avatar-${option.key}` + (option.key === selectedAvatarKey ? " selected" : "");
        button.textContent = option.label;
        button.title = "프로필 아이콘 선택";
        button.onclick = () => {
            setSelectedAvatarKey(option.key);
            renderMyAvatar();
            renderAvatarPicker();
        };
        picker.appendChild(button);
    });
}

function avatarLabel(displayName, avatarKey) {
    const text = String(displayName || "").trim();
    if (text) return text.substring(0, 1).toUpperCase();
    const option = AVATAR_OPTIONS.find(item => item.key === avatarKey);
    return option ? option.label : "U";
}

function avatarKeyFromText(text) {
    const keys = AVATAR_OPTIONS.map(option => option.key);
    const value = String(text || "user");
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash) + value.charCodeAt(i);
    return keys[Math.abs(hash) % keys.length];
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
    const colorInput = document.getElementById("avatarColorInput");
    const hexInput = document.getElementById("avatarHexInput");
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

async function loadRooms() {
    try {
        const rooms = await api("/api/rooms", {headers: authHeaders(false)});
        const el = document.getElementById("rooms");
        el.innerHTML = "";
        const count = document.getElementById("roomCount");
        if (count) count.textContent = rooms.length ? `${rooms.length}개` : "";
        const currentRoom = rooms.find(room => room.id === currentRoomId);
        if (currentRoom) {
            currentRoomName = currentRoom.name;
            document.getElementById("currentRoomTitle").textContent = currentRoom.name;
        }
        rooms.forEach(r => {
            const div = document.createElement("div");
            const label = document.createElement("span");
            const deleteButton = document.createElement("button");
            div.className = "room";
            label.textContent = `[${r.type === "PRIVATE" ? "개인" : "단체"}] ${r.name}`;
            deleteButton.type = "button";
            deleteButton.className = "room-delete";
            deleteButton.textContent = "x";
            deleteButton.title = "방 삭제";
            deleteButton.onclick = event => {
                event.stopPropagation();
                deleteRoomById(r.id);
            };
            div.onclick = () => enterRoom(r.id, r.name, r.type);
            div.append(label, deleteButton);
            el.appendChild(div);
        });
    } catch (e) { showInfo(e.message); }
}

async function createRoom() {
    const name = document.getElementById("roomName").value.trim();
    const type = document.getElementById("roomType").value;
    const members = roomMemberCandidates.map(u => u.loginId);

    if (type === "PRIVATE" && members.length !== 1) {
        return showInfo("개인방은 본인을 제외하고 상대방 1명을 선택해야 합니다.");
    }

    try {
        await api("/api/rooms", {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({ name, type, members })
        });
        roomMemberCandidates = [];
        renderRoomMemberCandidates();
        document.getElementById("roomName").value = "";
        showInfo("방이 생성되었습니다.");
        await loadRooms();
    } catch (e) { showInfo(e.message); }
}

function connect(callback) {
    if (stompClient && stompClient.connected) {
        callback();
        return;
    }
    const socket = new SockJS("/ws");
    stompClient = Stomp.over(socket);
    stompClient.connect({}, callback);
}

async function enterRoom(roomId, roomName, roomType) {
    currentRoomId = roomId;
    currentRoomType = roomType;
    currentRoomName = roomName;
    document.getElementById("memberAddPanel").classList.add("hidden");
    document.getElementById("roomActions").classList.add("hidden");
    const actionToggle = document.getElementById("roomActionToggle");
    actionToggle.classList.remove("hidden");
    actionToggle.classList.remove("expanded");
    actionToggle.setAttribute("aria-expanded", "false");
    document.getElementById("currentRoomTitle").textContent = roomName;
    await loadHistory();
    await loadMembers();

    connect(() => {
        if (subscription) subscription.unsubscribe();
        subscription = stompClient.subscribe(`/topic/rooms/${roomId}`, msg => {
            renderMessage(JSON.parse(msg.body));
            loadMembers();
            loadRooms();
        });
    });
}

async function loadHistory() {
    try {
        const messages = await api(`/api/rooms/${currentRoomId}/messages?limit=${MESSAGE_PAGE_SIZE}`, {headers: authHeaders(false)});
        document.getElementById("messages").innerHTML = "";
        oldestLoadedMessageId = null;
        hasOlderMessages = messages.length === MESSAGE_PAGE_SIZE;
        messages.forEach(renderMessage);
        updateOldestLoadedMessageId(messages);
        renderOlderMessagesButton();
        scrollMessagesToBottom();
    } catch (e) { showInfo(e.message); }
}

async function loadOlderMessages() {
    if (!currentRoomId || !oldestLoadedMessageId) return;
    const box = document.getElementById("messages");
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
    const box = document.getElementById("messages");
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
    button.onclick = loadOlderMessages;
    document.getElementById("messages").prepend(button);
}

function removeOlderMessagesButton() {
    const button = document.getElementById("olderMessagesButton");
    if (button) button.remove();
}

async function loadMembers() {
    if (!currentRoomId) return;
    try {
        const members = await api(`/api/rooms/${currentRoomId}/members`, {headers: authHeaders(false)});
        document.getElementById("memberList").textContent =
            "참여자: " + members.map(m => `${m.displayName}(${m.loginId})`).join(", ");
    } catch (e) {
        document.getElementById("memberList").textContent = "";
    }
}

async function addMember() {
    if (!currentRoomId) return showInfo("방을 선택하세요.");
    if (currentRoomType === "PRIVATE") return showInfo("개인방에는 사용자를 추가할 수 없습니다.");

    const select = document.getElementById("addMemberSelect");
    const loginId = select.value;
    if (!loginId) return showInfo("추가할 사용자를 선택하세요.");

    try {
        await api(`/api/rooms/${currentRoomId}/members`, {
            method:"POST",
            headers: authHeaders(true),
            body: JSON.stringify({loginId})
        });
        document.getElementById("userSearchKeyword").value = "";
        fillUserSelect("addMemberSelect", allUsersCache, "");
        await loadMembers();
    } catch (e) { showInfo(e.message); }
}


let userSearchTimer = null;

function debounceUserSearch(fn) {
    clearTimeout(userSearchTimer);
    userSearchTimer = setTimeout(fn, 120);
}

async function searchUsers(keyword) {
    const q = encodeURIComponent(keyword || "");
    return api(`/api/auth/users?q=${q}`, {headers: authHeaders(false)});
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
    if (!q) return allUsersCache;
    return allUsersCache.filter(u =>
        String(u.loginId || "").toLowerCase().includes(q) ||
        String(u.displayName || "").toLowerCase().includes(q)
    );
}

function fillUserSelect(selectId, users, keyword) {
    const select = document.getElementById(selectId);
    if (!select) return;
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

    // 검색 결과가 1명뿐이면 바로 선택해 편의성 개선
    if (keyword && users.length === 1) {
        select.value = users[0].loginId;
    }
}

function searchUsersForAdd() {
    debounceUserSearch(() => {
        const keyword = document.getElementById("userSearchKeyword").value.trim();
        const users = filterUsersLocal(keyword);
        fillUserSelect("addMemberSelect", users, keyword);
    });
}

function searchUsersForRoom() {
    debounceUserSearch(() => {
        const keyword = document.getElementById("roomMemberSearchKeyword").value.trim();
        const users = filterUsersLocal(keyword);
        fillUserSelect("roomMemberSelect", users, keyword);
    });
}

function addRoomMemberCandidate() {
    const select = document.getElementById("roomMemberSelect");
    const loginId = select.value;
    if (!loginId) {
        return showInfo("사용자를 검색한 뒤 초대할 사용자를 선택해주세요.");
    }

    const text = select.options[select.selectedIndex].textContent;
    const exists = roomMemberCandidates.some(u => u.loginId === loginId);
    if (exists) return showInfo("이미 초대 목록에 있는 사용자입니다.");

    roomMemberCandidates.push({loginId, label: text});
    document.getElementById("roomMemberSearchKeyword").value = "";
    fillUserSelect("roomMemberSelect", allUsersCache, "");
    renderRoomMemberCandidates();
}

function removeRoomMemberCandidate(loginId) {
    roomMemberCandidates = roomMemberCandidates.filter(u => u.loginId !== loginId);
    renderRoomMemberCandidates();
}

function renderRoomMemberCandidates() {
    const box = document.getElementById("roomMemberCandidates");
    if (!box) return;
    if (roomMemberCandidates.length === 0) {
        box.textContent = "초대할 사용자를 검색해서 추가하세요.";
        return;
    }

    box.innerHTML = "";
    roomMemberCandidates.forEach(u => {
        const span = document.createElement("span");
        span.className = "candidate";
        span.innerHTML = `${escapeHtml(u.label)} <button onclick="removeRoomMemberCandidate('${escapeJs(u.loginId)}')">x</button>`;
        box.appendChild(span);
    });
}

function escapeJs(s) {
    return String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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
        meta.innerHTML = `<strong>${escapeHtml(m.senderDisplayName)}</strong> · ${time}`;
        content.className = "message-content";
        if (m.type === "FILE") {
            const link = document.createElement("a");
            link.className = "file-link";
            link.href = `/api/files/${m.id}`;
            link.target = "_blank";
            link.textContent = m.originalFileName || m.content;
            content.appendChild(link);
        } else {
            content.textContent = m.content;
        }
        if (m.senderUserId === me.userId) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "message-delete";
            button.textContent = "x";
            button.title = "메시지 삭제";
            button.onclick = event => {
                event.stopPropagation();
                deleteMessage(m.id);
            };
            bubble.appendChild(button);
        }
        bubble.append(meta, content);
        box.append(avatar, bubble);
    }
    return box;
}

function renderMessage(m) {
    const box = createMessageElement(m);
    document.getElementById("messages").appendChild(box);
    updateOldestLoadedMessageId([m]);
    scrollMessagesToBottom();
}

function sendMessage() {
    if (!currentRoomId) return showInfo("방을 선택하세요.");
    const input = document.getElementById("messageInput");
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
    const file = document.getElementById("fileInput").files[0];
    if (!file) return showInfo("파일을 선택하세요.");

    const form = new FormData();
    form.append("roomId", currentRoomId);
    form.append("file", file);

    try {
        const res = await fetch("/api/files", {
            method: "POST",
            headers: {"X-Auth-Token": token()},
            body: form
        });
        if (!res.ok) throw new Error(toFriendlyError(await res.text(), res.status));
        document.getElementById("fileInput").value = "";
    } catch (e) { showInfo(e.message); }
}

function chooseFile() {
    document.getElementById("fileInput").click();
}

async function leaveRoom() {
    if (!currentRoomId) return;
    if (!confirm("이 방에서 나갈까요?")) return;
    try {
        await api(`/api/rooms/${currentRoomId}/leave`, {method:"POST", headers: authHeaders(false)});
        clearCurrentRoom();
        if (subscription) subscription.unsubscribe();
        await loadRooms();
    } catch (e) { showInfo(e.message); }
}

async function deleteRoom() {
    if (!currentRoomId) return;
    await deleteRoomById(currentRoomId);
}

async function deleteRoomById(roomId) {
    if (!roomId) return;
    if (!confirm("이 방을 삭제할까요? 메시지 기록도 삭제됩니다.")) return;
    try {
        await api(`/api/rooms/${roomId}`, {method:"DELETE", headers: authHeaders(false)});
        if (roomId === currentRoomId) {
            clearCurrentRoom();
            if (subscription) subscription.unsubscribe();
        }
        await loadRooms();
    } catch (e) { showInfo(e.message); }
}

async function renameRoom() {
    if (!currentRoomId) return showInfo("방을 선택하세요.");
    const name = prompt("변경할 방 이름을 입력하세요.", currentRoomName || document.getElementById("currentRoomTitle").textContent || "");
    if (name === null) return;
    const cleanName = name.trim();
    if (!cleanName) return showInfo("방 이름을 입력해주세요.");
    try {
        const room = await api(`/api/rooms/${currentRoomId}/name`, {
            method:"PUT",
            headers: authHeaders(true),
            body: JSON.stringify({name: cleanName})
        });
        currentRoomName = room.name;
        document.getElementById("currentRoomTitle").textContent = room.name;
        await loadRooms();
    } catch (e) { showInfo(e.message); }
}

async function deleteMessage(messageId) {
    if (!currentRoomId || !messageId) return;
    if (!confirm("이 메시지를 삭제할까요?")) return;
    try {
        await api(`/api/rooms/${currentRoomId}/messages/${messageId}`, {
            method:"DELETE",
            headers: authHeaders(false)
        });
        await loadHistory();
    } catch (e) { showInfo(e.message); }
}

function clearCurrentRoom() {
    currentRoomId = null;
    currentRoomType = null;
    currentRoomName = "";
    document.getElementById("currentRoomTitle").textContent = "방을 선택하세요";
    document.getElementById("memberList").textContent = "";
    document.getElementById("messages").innerHTML = "";
    const panel = document.getElementById("memberAddPanel");
    if (panel) panel.classList.add("hidden");
    const actions = document.getElementById("roomActions");
    if (actions) actions.classList.add("hidden");
    const actionToggle = document.getElementById("roomActionToggle");
    if (actionToggle) {
        actionToggle.classList.add("hidden");
        actionToggle.classList.remove("expanded");
        actionToggle.setAttribute("aria-expanded", "false");
    }
}

function toggleProfileDetails() {
    document.getElementById("profileDetails").classList.toggle("hidden");
}

function toggleMemberAddPanel() {
    if (!currentRoomId) return showInfo("방을 선택하세요.");
    if (currentRoomType === "PRIVATE") return showInfo("개인방에는 사용자를 추가할 수 없습니다.");
    document.getElementById("memberAddPanel").classList.toggle("hidden");
}

function toggleRoomActions() {
    if (!currentRoomId) return;
    const actions = document.getElementById("roomActions");
    const toggle = document.getElementById("roomActionToggle");
    const expanded = actions.classList.toggle("hidden") === false;
    toggle.classList.toggle("expanded", expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
}

function toggleRoomCreatePanel() {
    const panel = document.getElementById("roomCreatePanel");
    const expanded = panel.classList.toggle("hidden") === false;
    document.getElementById("roomCreateToggle").setAttribute("aria-expanded", String(expanded));
}

function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, ch => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[ch]));
}

init();

document.getElementById("fileInput").addEventListener("change", uploadFile);
document.getElementById("messageInput").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});
document.getElementById("avatarColorInput").addEventListener("input", event => updateCustomAvatarColor(event.target.value));
document.getElementById("avatarHexInput").addEventListener("change", event => updateCustomAvatarColor(event.target.value));
document.getElementById("avatarHexInput").addEventListener("keydown", event => {
    if (event.key === "Enter") updateCustomAvatarColor(event.target.value);
});
