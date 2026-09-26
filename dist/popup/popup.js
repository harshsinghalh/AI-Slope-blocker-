// src/popup/popup.ts
var currentSettings;
var currentHostname = "";
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof chrome !== "undefined" && chrome.tabs?.query) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url) {
      try {
        const url = new URL(tabs[0].url);
        currentHostname = url.hostname;
        const siteLabel = document.getElementById("current-site-name");
        if (siteLabel) siteLabel.textContent = currentHostname;
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_PAGE_STATUS" }, (res) => {
          const badge = document.getElementById("site-badge");
          if (!badge) return;
          if (res?.adapterName) {
            badge.textContent = res.isGeneric ? "Generic Site" : res.adapterName;
            badge.className = `laya-status-badge ${res.isGeneric ? "generic" : "supported"}`;
          } else {
            badge.textContent = "Inactive";
            badge.className = "laya-status-badge";
          }
        });
      } catch {
      }
    }
  }
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(["layaSettings", "layaHistory"], (res) => {
      currentSettings = res.layaSettings;
      renderSettings();
      renderStats(res.layaHistory || []);
    });
  }
  bindEvents();
});
function renderSettings() {
  if (!currentSettings) return;
  const masterToggle = document.getElementById("master-toggle");
  if (masterToggle) masterToggle.checked = currentSettings.enabled;
  const abuseToggle = document.getElementById("abuse-filter-toggle");
  if (abuseToggle) abuseToggle.checked = currentSettings.abuseFilterEnabled !== false;
  const indiaToggle = document.getElementById("india-preset-toggle");
  if (indiaToggle) indiaToggle.checked = currentSettings.indiaPresetEnabled;
  const modeIndicator = document.getElementById("match-mode-indicator");
  if (modeIndicator) {
    modeIndicator.textContent = `Mode: ${currentSettings.topicMatchMode}`;
  }
  document.querySelectorAll(".laya-tab").forEach((tab) => {
    const p = tab.dataset.profile;
    const isSelected = p === currentSettings.activeProfile;
    tab.classList.toggle("active", isSelected);
    tab.setAttribute("aria-selected", String(isSelected));
  });
  const chipsContainer = document.getElementById("active-topics-chips");
  if (chipsContainer) {
    chipsContainer.innerHTML = "";
    const topics = currentSettings.selectedTopics || [];
    if (topics.length === 0) {
      chipsContainer.innerHTML = '<span style="color:#64748b;font-size:11px;">No topic restrictions (showing all)</span>';
    } else {
      for (const topicId of topics) {
        const chip = document.createElement("span");
        chip.className = "laya-chip";
        chip.innerHTML = `
          <span>${formatTopicName(topicId)}</span>
          <button type="button" class="laya-chip-remove" data-topic="${topicId}" aria-label="Remove ${topicId}">&times;</button>
        `;
        chipsContainer.appendChild(chip);
      }
    }
  }
}
function renderStats(history) {
  const hiddenCount = history.filter((h) => h.action === "HIDE").length;
  const misinfoCount = history.filter((h) => h.claimAssessment?.status === "Contradicted").length;
  const statHidden = document.getElementById("stat-hidden-count");
  const statMisinfo = document.getElementById("stat-misinfo-count");
  const statAbuse = document.getElementById("stat-abuse-count");
  if (statHidden) statHidden.textContent = String(hiddenCount);
  if (statMisinfo) statMisinfo.textContent = String(misinfoCount);
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(["layaAbuseCount"], (res) => {
      if (statAbuse) statAbuse.textContent = String(res.layaAbuseCount || 0);
    });
  }
}
function formatTopicName(id) {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function bindEvents() {
  document.getElementById("master-toggle")?.addEventListener("change", (e) => {
    const val = e.target.checked;
    currentSettings.enabled = val;
    saveSettings();
  });
  document.getElementById("abuse-filter-toggle")?.addEventListener("change", (e) => {
    const val = e.target.checked;
    currentSettings.abuseFilterEnabled = val;
    saveSettings();
  });
  document.getElementById("india-preset-toggle")?.addEventListener("change", (e) => {
    const val = e.target.checked;
    currentSettings.indiaPresetEnabled = val;
    saveSettings();
  });
  document.querySelectorAll(".laya-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const profile = tab.dataset.profile;
      if (!profile) return;
      currentSettings.activeProfile = profile;
      if (profile === "study") {
        currentSettings.selectedTopics = ["education", "science", "mathematics"];
      } else if (profile === "work") {
        currentSettings.selectedTopics = ["technology", "programming", "business"];
      } else {
        currentSettings.selectedTopics = [];
      }
      renderSettings();
      saveSettings();
    });
  });
  document.getElementById("btn-pause-site")?.addEventListener("click", () => {
    if (!currentHostname) return;
    currentSettings.pausedSites = currentSettings.pausedSites || {};
    currentSettings.pausedSites[currentHostname] = !currentSettings.pausedSites[currentHostname];
    saveSettings();
    alert(`Site filtering is now ${currentSettings.pausedSites[currentHostname] ? "paused" : "resumed"} for ${currentHostname}.`);
  });
  document.getElementById("btn-pause-1hr")?.addEventListener("click", () => {
    currentSettings.pausedUntil = Date.now() + 36e5;
    saveSettings();
    alert("Filtering paused for 1 hour.");
  });
  document.getElementById("active-topics-chips")?.addEventListener("click", (e) => {
    const target = e.target;
    const removeBtn = target.closest(".laya-chip-remove");
    if (removeBtn) {
      const topicId = removeBtn.dataset.topic;
      if (topicId) {
        currentSettings.selectedTopics = currentSettings.selectedTopics.filter((t) => t !== topicId);
        renderSettings();
        saveSettings();
      }
    }
  });
  document.getElementById("btn-open-options")?.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });
}
function saveSettings() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ layaSettings: currentSettings });
  }
}
//# sourceMappingURL=popup.js.map
