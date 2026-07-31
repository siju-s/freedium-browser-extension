const DEFAULT_MIRROR_URL = "https://freedium-mirror.cfd";

const DEFAULT_PATTERNS = ["*://*.medium.com/*", "*://medium.com/*"];

const CONTEXT_MENU_CONTENTS = {
  /** @type {chrome.contextMenus.CreateProperties[]} */
  link: [
    {
      title: "Open in Freedium",
      type: "normal",
      id: "freedium-link",
      targetUrlPatterns: DEFAULT_PATTERNS,
    },
  ],
  /** @type {chrome.contextMenus.CreateProperties[]} */
  page: [
    {
      title: "Open in Freedium",
      type: "normal",
      id: "freedium-page",
      documentUrlPatterns: DEFAULT_PATTERNS,
    },
  ],
};

/** MV3 exposes chrome.action, MV2 (Firefox) exposes chrome.browserAction */
const browserAction = chrome.action || chrome.browserAction;

/**
 * Read the user's custom patterns as an array
 * @param {string} patterns - newline separated patterns from storage
 * @returns {string[]}
 */
const parsePatterns = (patterns) => {
  return patterns
    .replace(/\r/g, "")
    .split("\n")
    .filter((p) => p)
    .map((p) => p.trim());
};

const setUpContextMenus = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.storage.sync.get({ patterns: "" }, (items) => {
      /** @type {string} */
      const patterns = items.patterns;
      const patternsArray = parsePatterns(patterns);

      CONTEXT_MENU_CONTENTS.link.forEach((command) => {
        chrome.contextMenus.create({
          title: command.title,
          type: command.type,
          id: command.id,
          targetUrlPatterns: command.targetUrlPatterns.concat(patternsArray),
          contexts: ["link"],
        });
      });
      CONTEXT_MENU_CONTENTS.page.forEach((command) => {
        chrome.contextMenus.create({
          title: command.title,
          type: command.type,
          id: command.id,
          documentUrlPatterns:
            command.documentUrlPatterns.concat(patternsArray),
          contexts: ["page"],
        });
      });
    });
  });
};

/**
 * Turn a browser match pattern into a regular expression
 * @param {string} pattern - e.g. *://*.medium.com/*
 * @returns {RegExp|null} null if the pattern cannot be parsed
 */
const matchPatternToRegExp = (pattern) => {
  const parts = /^(\*|https?):\/\/(\*|(?:\*\.)?[^/*]+)(\/.*)$/.exec(pattern);
  if (!parts) {
    return null;
  }

  const [, scheme, host, path] = parts;

  const schemeRegExp = scheme === "*" ? "https?" : scheme;
  const hostRegExp =
    host === "*"
      ? "[^/]+"
      : host.startsWith("*.")
        ? "(?:[^/]+\\.)?" + escapeForRegExp(host.slice(2))
        : escapeForRegExp(host);
  const pathRegExp = escapeForRegExp(path).replace(/\\\*/g, ".*");

  return new RegExp("^" + schemeRegExp + "://" + hostRegExp + pathRegExp + "$");
};

/**
 * @param {string} text
 * @returns {string}
 */
const escapeForRegExp = (text) => {
  return text.replace(/[.+?^${}()|[\]\\*]/g, "\\$&");
};

/**
 * Does this URL match any of the patterns the extension handles?
 * @param {string} url
 * @param {string[]} patterns
 * @returns {boolean}
 */
const isSupportedUrl = (url, patterns) => {
  return patterns.some((pattern) => {
    const regExp = matchPatternToRegExp(pattern);
    return regExp !== null && regExp.test(url);
  });
};

/**
 * Read the Freedium mirror URL from storage, without a trailing slash
 * @returns {Promise<string>}
 */
const getMirrorUrl = () => {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ mirrorUrl: DEFAULT_MIRROR_URL }, (items) => {
      const mirrorUrl = (items.mirrorUrl || DEFAULT_MIRROR_URL).trim();
      resolve(mirrorUrl.replace(/\/+$/, ""));
    });
  });
};

/**
 * Open a URL in Freedium
 * @param {string} url
 * @param {boolean} newTab - open in a new tab?
 * @returns
 */
const openInFreedium = async (url, newTab) => {
  if (!url) {
    return;
  }

  const mirrorUrl = await getMirrorUrl();
  const freediumUrl = mirrorUrl + "/" + url;

  if (newTab) {
    chrome.tabs.create({
      url: freediumUrl,
    });
  } else {
    chrome.tabs.update({
      url: freediumUrl,
    });
  }
};

/**
 * Briefly flag on the toolbar icon that this page is not handled
 */
const showUnsupportedBadge = () => {
  browserAction.setBadgeText({ text: "?" });
  setTimeout(() => {
    browserAction.setBadgeText({ text: "" });
  }, 2000);
};

/**
 * Convert the given tab to its Freedium equivalent, if the extension handles it
 * @param {chrome.tabs.Tab} tab
 */
const convertTab = (tab) => {
  if (!tab || !tab.url) {
    showUnsupportedBadge();
    return;
  }

  chrome.storage.sync.get({ patterns: "" }, (items) => {
    const patterns = DEFAULT_PATTERNS.concat(parsePatterns(items.patterns));

    if (isSupportedUrl(tab.url, patterns)) {
      openInFreedium(tab.url, false);
    } else {
      showUnsupportedBadge();
    }
  });
};

chrome.runtime.onInstalled.addListener(() => {
  setUpContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  setUpContextMenus();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "settingsSaved") {
    setUpContextMenus();
  }
});

chrome.contextMenus.onClicked.addListener((item) => {
  switch (item.menuItemId) {
    case "freedium-link":
      openInFreedium(item.linkUrl, true);
      break;
    case "freedium-page":
      openInFreedium(item.pageUrl, false);
      break;
  }
});

browserAction.onClicked.addListener((tab) => {
  convertTab(tab);
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "convert-tab") {
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    convertTab(tabs[0]);
  });
});
