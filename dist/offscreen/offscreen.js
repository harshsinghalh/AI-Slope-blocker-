// src/offscreen/offscreen.ts
var worker = new Worker(new URL("inference-worker.js", import.meta.url), { type: "module" });
var pendingRequests = /* @__PURE__ */ new Map();
worker.onmessage = (e) => {
  const { id, result, error } = e.data;
  const resolver = pendingRequests.get(id);
  if (resolver) {
    pendingRequests.delete(id);
    if (error) {
      resolver({ success: false, error });
    } else {
      resolver({ success: true, result });
    }
  }
};
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "RUN_INFERENCE") {
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    pendingRequests.set(id, sendResponse);
    worker.postMessage({ id, type: "PREDICT", payload: message.payload });
    return true;
  }
  if (message.type === "GET_MODEL_STATUS") {
    const id = `status_${Date.now()}`;
    pendingRequests.set(id, sendResponse);
    worker.postMessage({ id, type: "STATUS" });
    return true;
  }
});
//# sourceMappingURL=offscreen.js.map
