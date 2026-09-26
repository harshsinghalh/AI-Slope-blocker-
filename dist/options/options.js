// src/data/topics-taxonomy.json
var topics_taxonomy_default = [
  {
    id: "education",
    label: "Education",
    description: "Educational content, teaching, tutorials, and academic learning.",
    subtopics: ["mathematics", "science", "history", "programming", "languages"]
  },
  {
    id: "mathematics",
    label: "Mathematics",
    parent: "education",
    description: "Arithmetic, algebra, calculus, geometry, statistics, and proofs.",
    subtopics: ["calculus", "linear_algebra", "statistics"]
  },
  {
    id: "calculus",
    label: "Calculus",
    parent: "mathematics",
    description: "Differential and integral calculus, limits, derivatives, integrals."
  },
  {
    id: "technology",
    label: "Technology",
    description: "Tech news, hardware, software, computing, electronics, and innovations.",
    subtopics: ["programming", "ai_ml", "cybersecurity", "hardware"]
  },
  {
    id: "programming",
    label: "Programming",
    parent: "technology",
    description: "Software development, code, web development, algorithms, system engineering."
  },
  {
    id: "ai_ml",
    label: "Artificial Intelligence & ML",
    parent: "technology",
    description: "Machine learning, neural networks, LLMs, computer vision, data science."
  },
  {
    id: "science",
    label: "Science",
    parent: "education",
    description: "Physics, chemistry, biology, astronomy, earth science, scientific research."
  },
  {
    id: "history",
    label: "History",
    parent: "education",
    description: "Historical events, archaeology, world history, civilizations, archival footage."
  },
  {
    id: "business",
    label: "Business & Finance",
    description: "Economics, investing, entrepreneurship, markets, personal finance, management."
  },
  {
    id: "careers",
    label: "Careers & Professional",
    description: "Job search, career advice, resumes, workplace skills, professional development."
  },
  {
    id: "sports",
    label: "Sports & Fitness",
    description: "Athletics, workout, football, cricket, basketball, tennis, martial arts."
  },
  {
    id: "news",
    label: "News & Current Affairs",
    description: "Current events, international journalism, civic reports, policy updates."
  },
  {
    id: "entertainment",
    label: "Entertainment & Culture",
    description: "Movies, music, comedy, gaming, pop culture, animations."
  },
  {
    id: "art",
    label: "Art & Design",
    description: "Visual arts, graphic design, architecture, photography, illustration."
  },
  {
    id: "travel",
    label: "Travel & Places",
    description: "Geography, travel guides, cultures, landmarks, expeditions."
  }
];

// src/options/options.ts
var settings;
var historyItems = [];
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  loadData();
  bindFormHandlers();
});
function initTabs() {
  document.querySelectorAll(".laya-nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".laya-nav-item").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".laya-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const tabId = btn.dataset.tab;
      const targetPanel = document.getElementById(`panel-${tabId}`);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }
    });
  });
}
function loadData() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(["layaSettings", "layaHistory"], (res) => {
      settings = res.layaSettings;
      historyItems = res.layaHistory || [];
      renderAll();
    });
  }
}
function renderAll() {
  if (!settings) return;
  renderTaxonomy();
  renderMatchingMode();
  renderKeywords();
  renderCreators();
  renderMisinfo();
  renderAbuseGuard();
  renderHardware();
  renderHistory();
}
function renderTaxonomy() {
  const container = document.getElementById("taxonomy-container");
  if (!container) return;
  container.innerHTML = "";
  const topics = topics_taxonomy_default;
  const selectedSet = new Set(settings.selectedTopics || []);
  for (const topic of topics) {
    const item = document.createElement("label");
    item.className = `laya-taxonomy-item ${topic.parent ? "child" : ""}`;
    item.innerHTML = `
      <input type="checkbox" value="${topic.id}" ${selectedSet.has(topic.id) ? "checked" : ""}>
      <span>${topic.label}</span>
    `;
    item.querySelector("input")?.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      if (isChecked) {
        selectedSet.add(topic.id);
      } else {
        selectedSet.delete(topic.id);
      }
      settings.selectedTopics = Array.from(selectedSet);
      saveSettings();
    });
    container.appendChild(item);
  }
}
function renderMatchingMode() {
  const radioAny = document.getElementById("mode-any");
  const radioAll = document.getElementById("mode-all");
  if (radioAny && radioAll) {
    radioAny.checked = settings.topicMatchMode === "ANY";
    radioAll.checked = settings.topicMatchMode === "ALL";
    radioAny.addEventListener("change", () => {
      settings.topicMatchMode = "ANY";
      saveSettings();
    });
    radioAll.addEventListener("change", () => {
      settings.topicMatchMode = "ALL";
      saveSettings();
    });
  }
  const radioBal = document.getElementById("strictness-balanced");
  const radioStr = document.getElementById("strictness-strict");
  if (radioBal && radioStr) {
    radioBal.checked = settings.strictness === "balanced";
    radioStr.checked = settings.strictness === "strict";
    radioBal.addEventListener("change", () => {
      settings.strictness = "balanced";
      saveSettings();
    });
    radioStr.addEventListener("change", () => {
      settings.strictness = "strict";
      saveSettings();
    });
  }
}
function renderKeywords() {
  const tbody = document.getElementById("tbody-keywords");
  if (!tbody) return;
  tbody.innerHTML = "";
  const rules = settings.keywordRules || [];
  if (rules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;">No keyword rules configured.</td></tr>';
    return;
  }
  rules.forEach((rule, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(rule.phrase)}</strong></td>
      <td><span class="laya-pill" style="${rule.type === "exclude" ? "background:rgba(239,68,68,0.15);color:#f87171;" : ""}">${rule.type.toUpperCase()}</span></td>
      <td>${rule.matchMode}</td>
      <td><button type="button" class="laya-btn laya-btn-subtle btn-del-kw" data-index="${idx}">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".btn-del-kw").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.dataset.index);
      settings.keywordRules.splice(idx, 1);
      renderKeywords();
      saveSettings();
    });
  });
}
function renderCreators() {
  const tbody = document.getElementById("tbody-creators");
  if (!tbody) return;
  tbody.innerHTML = "";
  const rules = settings.creatorRules || [];
  if (rules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;">No creator rules configured.</td></tr>';
    return;
  }
  rules.forEach((rule, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>@${escapeHtml(rule.handleOrName)}</strong></td>
      <td><span class="laya-pill" style="${rule.action === "block" ? "background:rgba(239,68,68,0.15);color:#f87171;" : "background:rgba(16,185,129,0.15);color:#34d399;"}">${rule.action.toUpperCase()}</span></td>
      <td><button type="button" class="laya-btn laya-btn-subtle btn-del-creator" data-index="${idx}">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".btn-del-creator").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.dataset.index);
      settings.creatorRules.splice(idx, 1);
      renderCreators();
      saveSettings();
    });
  });
}
function renderMisinfo() {
  const indiaToggle = document.getElementById("setting-india-preset");
  const generalToggle = document.getElementById("setting-general-misinfo");
  if (indiaToggle) {
    indiaToggle.checked = settings.indiaPresetEnabled;
    indiaToggle.addEventListener("change", () => {
      settings.indiaPresetEnabled = indiaToggle.checked;
      saveSettings();
    });
  }
  if (generalToggle) {
    generalToggle.checked = settings.misinformationEnabled;
    generalToggle.addEventListener("change", () => {
      settings.misinformationEnabled = generalToggle.checked;
      saveSettings();
    });
  }
}
function renderAbuseGuard() {
  const masterToggle = document.getElementById("abuse-master-toggle");
  if (masterToggle) {
    masterToggle.checked = settings.abuseFilterEnabled !== false;
    masterToggle.addEventListener("change", () => {
      settings.abuseFilterEnabled = masterToggle.checked;
      saveSettings();
    });
  }
  const actionRadios = document.querySelectorAll('input[name="abuseAction"]');
  actionRadios.forEach((r) => {
    r.checked = r.value === (settings.abuseAction || "blur");
    r.addEventListener("change", () => {
      if (r.checked) {
        settings.abuseAction = r.value;
        saveSettings();
      }
    });
  });
  const obfToggle = document.getElementById("abuse-obfuscation-toggle");
  if (obfToggle) {
    obfToggle.checked = settings.obfuscationDefense !== false;
    obfToggle.addEventListener("change", () => {
      settings.obfuscationDefense = obfToggle.checked;
      saveSettings();
    });
  }
  const mlToggle = document.getElementById("abuse-multilingual-toggle");
  if (mlToggle) {
    mlToggle.checked = settings.multilingualAiScan !== false;
    mlToggle.addEventListener("change", () => {
      settings.multilingualAiScan = mlToggle.checked;
      saveSettings();
    });
  }
  const customInput = document.getElementById("custom-abuse-input");
  if (customInput) {
    customInput.value = (settings.customAbuseWords || []).join(", ");
    customInput.addEventListener("change", () => {
      settings.customAbuseWords = customInput.value.split(",").map((s) => s.trim()).filter(Boolean);
      saveSettings();
    });
  }
  const exemptInput = document.getElementById("exempt-abuse-input");
  if (exemptInput) {
    exemptInput.value = (settings.exemptAbuseWords || []).join(", ");
    exemptInput.addEventListener("change", () => {
      settings.exemptAbuseWords = exemptInput.value.split(",").map((s) => s.trim()).filter(Boolean);
      saveSettings();
    });
  }
}
function renderHardware() {
  const preferRadio = document.getElementById("backend-prefer-webgpu");
  const requireRadio = document.getElementById("backend-require-webgpu");
  if (preferRadio && requireRadio) {
    preferRadio.checked = settings.computeBackend === "prefer_webgpu";
    requireRadio.checked = settings.computeBackend === "require_webgpu";
    preferRadio.addEventListener("change", () => {
      settings.computeBackend = "prefer_webgpu";
      saveSettings();
    });
    requireRadio.addEventListener("change", () => {
      settings.computeBackend = "require_webgpu";
      saveSettings();
    });
  }
  document.getElementById("btn-clear-model-cache")?.addEventListener("click", async () => {
    if (typeof caches !== "undefined") {
      await caches.delete("laya-models-v1");
      alert("Local model cache cleared successfully.");
    }
  });
}
function renderHistory() {
  const container = document.getElementById("history-container");
  if (!container) return;
  container.innerHTML = "";
  if (historyItems.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">No recent filtering decisions recorded.</div>';
    return;
  }
  for (const item of historyItems) {
    const card = document.createElement("div");
    card.className = "laya-history-card";
    card.innerHTML = `
      <div class="laya-history-header">
        <span class="laya-history-badge">${item.action}</span>
        <span style="font-size:11px;color:#64748b;">${new Date(item.timestamp).toLocaleTimeString()} &bull; ${escapeHtml(item.platform)}</span>
      </div>
      <div class="laya-history-reason">
        <strong>Rule:</strong> ${escapeHtml(item.winningRule)} &mdash; ${escapeHtml(item.explanation)}
      </div>
      <div class="laya-history-snippet">
        "${escapeHtml(item.snippet || "No text snippet")}"
      </div>
      <div class="laya-history-actions">
        <button type="button" class="laya-btn laya-btn-subtle btn-reveal-once" data-id="${item.itemId}">Reveal once</button>
        ${item.authorHandle ? `<button type="button" class="laya-btn laya-btn-subtle btn-allow-creator" data-handle="${item.authorHandle}">Allow @${escapeHtml(item.authorHandle)}</button>` : ""}
        ${item.itemUrl ? `<a href="${item.itemUrl}" target="_blank" rel="noopener noreferrer" class="laya-btn laya-btn-subtle">Native Permalink</a>` : ""}
      </div>
    `;
    container.appendChild(card);
  }
  container.querySelectorAll(".btn-reveal-once").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.dataset.id;
      if (id && typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "REVEAL_ITEM", itemId: id });
          }
        });
      }
    });
  });
  container.querySelectorAll(".btn-allow-creator").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const handle = e.target.dataset.handle;
      if (handle) {
        settings.creatorRules = settings.creatorRules || [];
        settings.creatorRules.push({ id: `c_${Date.now()}`, handleOrName: handle, action: "allow" });
        saveSettings();
        renderCreators();
        alert(`Creator @${handle} is now allowed.`);
      }
    });
  });
}
function bindFormHandlers() {
  document.getElementById("form-add-keyword")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const phrase = document.getElementById("kw-input-phrase").value.trim();
    const type = document.getElementById("kw-input-type").value;
    const matchMode = document.getElementById("kw-input-mode").value;
    if (!phrase) return;
    settings.keywordRules = settings.keywordRules || [];
    settings.keywordRules.push({
      id: `kw_${Date.now()}`,
      phrase,
      type,
      matchMode
    });
    document.getElementById("kw-input-phrase").value = "";
    renderKeywords();
    saveSettings();
  });
  document.getElementById("form-add-creator")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const handleOrName = document.getElementById("creator-input-handle").value.trim();
    const action = document.getElementById("creator-input-action").value;
    if (!handleOrName) return;
    settings.creatorRules = settings.creatorRules || [];
    settings.creatorRules.push({
      id: `cr_${Date.now()}`,
      handleOrName,
      action
    });
    document.getElementById("creator-input-handle").value = "";
    renderCreators();
    saveSettings();
  });
  document.getElementById("btn-clear-history")?.addEventListener("click", () => {
    if (confirm("Clear all local filtering history?")) {
      historyItems = [];
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" }, () => {
          renderHistory();
        });
      }
    }
  });
}
function saveSettings() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ layaSettings: settings });
  }
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
//# sourceMappingURL=options.js.map
