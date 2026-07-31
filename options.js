const DEFAULT_MIRROR_URL = "https://freedium-mirror.cfd";

// Saves options to chrome.storage
const saveOptions = () => {
  const patterns = document.getElementById("custom_patterns").value;
  const mirrorUrl =
    document.getElementById("mirror_url").value.trim() || DEFAULT_MIRROR_URL;

  chrome.storage.sync.set(
    {
      patterns: patterns,
      mirrorUrl: mirrorUrl,
    },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById("status");
      status.textContent = "Options saved.";
      setTimeout(() => {
        status.textContent = "";
      }, 2000);

      // Let the background script know
      chrome.runtime.sendMessage({ message: "settingsSaved" });
    },
  );
};

// Restores the form state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.sync.get(
    {
      patterns: "",
      mirrorUrl: DEFAULT_MIRROR_URL,
    },
    (items) => {
      document.getElementById("custom_patterns").value = items.patterns;
      document.getElementById("mirror_url").value = items.mirrorUrl;
    },
  );
};

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save").addEventListener("click", saveOptions);
