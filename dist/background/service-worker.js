// src/background/service-worker.ts
var OFFSCREEN_DOCUMENT_PATH = "offscreen/offscreen.html";
var DEFAULT_SETTINGS = {
  enabled: true,
  activeProfile: "explore",
  pausedUntil: null,
  pausedSites: {},
  selectedTopics: [],
  topicMatchMode: "ANY",
  strictness: "balanced",
  keywordRules: [],
  creatorRules: [],
  misinformationEnabled: true,
  indiaPresetEnabled: true,
  minConfidenceThreshold: 0.75,
  allowUnverifiedClaims: true,
  aiContentFilter: "allow_all",
  computeBackend: "prefer_webgpu",
  modelInstalled: false,
  checkBeforeShowing: false,
  autoSkipShorts: true,
  maxConsecutiveSkips: 8,
  abuseFilterEnabled: true,
  abuseAction: "blur",
  abuseStrictness: "balanced",
  obfuscationDefense: true,
  multilingualAiScan: true,
  customAbuseWords: [],
  exemptAbuseWords: []
};
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(["layaSettings", "layaHistory"]);
  if (!result.layaSettings) {
    await chrome.storage.local.set({ layaSettings: DEFAULT_SETTINGS });
  }
  if (!result.layaHistory) {
    await chrome.storage.local.set({ layaHistory: [] });
  }
});
async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: "WebGPU local machine learning inference for social feed content filtering"
    });
  } catch (err) {
    if (!err.message?.includes("Only a single offscreen document may be created")) {
      console.warn("[Laya SW] Failed to create offscreen document:", err);
    }
  }
}
async function hasOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });
  return contexts.length > 0;
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ENSURE_OFFSCREEN") {
    ensureOffscreenDocument().then(() => sendResponse({ success: true }));
    return true;
  }
  if (message.type === "RECORD_DECISION") {
    recordHistoryItem(message.payload);
    updateBadge(sender.tab?.id);
    sendResponse({ success: true });
    return true;
  }
  if (message.type === "ABUSE_BLOCKED") {
    chrome.storage.local.get(["layaAbuseCount"], (res) => {
      const current = (res.layaAbuseCount || 0) + (message.count || 1);
      chrome.storage.local.set({ layaAbuseCount: current });
    });
    if (sender.tab?.id) {
      chrome.action.setBadgeText({ tabId: sender.tab.id, text: "!" });
      chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#ef4444" });
    }
    sendResponse({ success: true });
    return true;
  }
  if (message.type === "PAUSE_FILTERING") {
    const durationMs = message.durationMs || 36e5;
    chrome.storage.local.get(["layaSettings"], (res) => {
      const settings = res.layaSettings || DEFAULT_SETTINGS;
      settings.pausedUntil = Date.now() + durationMs;
      chrome.storage.local.set({ layaSettings: settings }, () => {
        sendResponse({ success: true, pausedUntil: settings.pausedUntil });
      });
    });
    return true;
  }
  if (message.type === "CLEAR_HISTORY") {
    chrome.storage.local.set({ layaHistory: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
async function recordHistoryItem(item) {
  try {
    const res = await chrome.storage.local.get(["layaHistory"]);
    const history = res.layaHistory || [];
    history.unshift(item);
    if (history.length > 300) {
      history.length = 300;
    }
    await chrome.storage.local.set({ layaHistory: history });
  } catch (e) {
    console.warn("[Laya SW] Failed to record history:", e);
  }
}
function updateBadge(tabId) {
  if (!tabId) return;
  chrome.action.setBadgeText({ tabId, text: "\u2022" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#3b82f6" });
}
//# sourceMappingURL=service-worker.js.map
