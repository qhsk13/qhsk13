const DEFAULT_SERVER_URL = "http://localhost:8080";
const ALARM_NAME = "offlineMessengerPoll";
const POLL_INTERVAL_MS = 10000;
let pollTimer = null;

chrome.runtime.onInstalled.addListener(() => {
    startPolling();
});

chrome.runtime.onStartup.addListener(() => {
    startPolling();
});

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM_NAME) startPolling();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes.authToken || changes.serverBaseUrl || changes.notificationsEnabled) {
        startPolling();
    }
});

chrome.notifications.onClicked.addListener(async notificationId => {
    const roomId = parseRoomId(notificationId);
    if (roomId) {
        await chrome.storage.local.set({pendingOpenRoomId: roomId});
    }
    chrome.notifications.clear(notificationId);
    chrome.windows.create({
        url: chrome.runtime.getURL("popup.html"),
        type: "popup",
        width: 1000,
        height: 780,
        focused: true
    });
});

startPolling();

function startPolling() {
    chrome.alarms.create(ALARM_NAME, {periodInMinutes: 0.5});
    if (pollTimer) clearTimeout(pollTimer);
    runPollLoop();
}

async function runPollLoop() {
    if (pollTimer) clearTimeout(pollTimer);
    await pollMessages();
    pollTimer = setTimeout(runPollLoop, POLL_INTERVAL_MS);
}

async function pollMessages() {
    const settings = await chrome.storage.local.get({
        authToken: "",
        serverBaseUrl: DEFAULT_SERVER_URL,
        notificationsEnabled: false,
        popupActiveUntil: 0,
        lastSeenMessageIds: {},
        initializedRooms: {}
    });

    if (!settings.authToken || settings.notificationsEnabled !== true) return;
    if (Number(settings.popupActiveUntil || 0) > Date.now()) return;

    const baseUrl = String(settings.serverBaseUrl || DEFAULT_SERVER_URL).replace(/\/+$/, "");
    const headers = {"X-Auth-Token": settings.authToken};

    try {
        const me = await requestJson(baseUrl, "/api/auth/me", {headers});
        const rooms = await requestJson(baseUrl, "/api/rooms", {headers});
        const lastSeenMessageIds = settings.lastSeenMessageIds || {};
        const initializedRooms = settings.initializedRooms || {};
        const roomNameById = {};

        for (const room of rooms) {
            roomNameById[room.id] = room.name;
            const messages = await requestJson(baseUrl, `/api/rooms/${room.id}/messages?limit=50`, {headers});
            if (!messages.length) {
                initializedRooms[room.id] = true;
                continue;
            }

            const latestId = maxMessageId(messages);
            const previousId = Number(lastSeenMessageIds[room.id] || 0);
            const initialized = initializedRooms[room.id] === true;

            if (initialized && previousId > 0) {
                messages
                    .filter(message => Number(message.id) > previousId)
                    .filter(message => message.type !== "SYSTEM")
                    .filter(message => message.senderUserId !== me.userId)
                    .forEach(message => notify(room, message));
            }

            lastSeenMessageIds[room.id] = latestId;
            initializedRooms[room.id] = true;
        }

        await chrome.storage.local.set({lastSeenMessageIds, initializedRooms});
    } catch (e) {
        console.warn("Offline Messenger background poll failed", e);
    }
}

async function requestJson(baseUrl, path, options) {
    const res = await fetch(baseUrl + path, options || {});
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
    return res.json();
}

function maxMessageId(messages) {
    return messages.reduce((max, message) => Math.max(max, Number(message.id || 0)), 0);
}

function notify(room, message) {
    const sender = message.senderDisplayName || "Unknown";
    const body = message.type === "FILE" ? `${sender}: sent a file.` : `${sender}: ${message.content || ""}`;
    chrome.notifications.create(`room-${room.id}-${message.id}-${Date.now()}`, {
        type: "basic",
        iconUrl: "icon.png",
        title: room.name || "New message",
        message: body.substring(0, 120)
    });
}

function parseRoomId(notificationId) {
    const match = String(notificationId || "").match(/^room-(\d+)-/);
    return match ? Number(match[1]) : null;
}
