"use strict";
(() => {
  // src/adapters/base.ts
  var BasePlatformAdapter = class {
    matches(url) {
      return this.supportedRoutes.some((route) => route.test(url.hostname + url.pathname));
    }
    /**
     * Reversibly hides a post container without breaking layout or virtualized scroll lists
     */
    hidePost(element, reason) {
      if (element.classList.contains("laya-hidden-post")) return;
      element.dataset.layaOriginalDisplay = element.style.display || "";
      element.dataset.layaOriginalVisibility = element.style.visibility || "";
      element.dataset.layaHideReason = reason;
      element.classList.add("laya-hidden-post");
      element.style.display = "none";
    }
    /**
     * Restores a hidden post container to its original state
     */
    restorePost(element) {
      if (!element.classList.contains("laya-hidden-post")) return;
      element.classList.remove("laya-hidden-post");
      element.style.display = element.dataset.layaOriginalDisplay || "";
      element.style.visibility = element.dataset.layaOriginalVisibility || "";
      delete element.dataset.layaOriginalDisplay;
      delete element.dataset.layaOriginalVisibility;
      delete element.dataset.layaHideReason;
    }
    /**
     * Pauses any playing video/audio inside the element
     */
    pauseMedia(currentElement) {
      const mediaEls = currentElement.querySelectorAll("video, audio");
      mediaEls.forEach((media) => {
        try {
          media.pause();
          media.muted = true;
        } catch {
        }
      });
    }
    /**
     * Extracts hashtags from text
     */
    extractHashtags(text) {
      const matches = text.match(/#[a-zA-Z0-9_\u0900-\u097F]+/g);
      return matches ? matches.map((m) => m.toLowerCase()) : [];
    }
    /**
     * Dispatches keyboard arrow down event to simulate native scroll navigation
     */
    dispatchArrowDown() {
      const downEvent = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        code: "ArrowDown",
        keyCode: 40,
        which: 40,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(downEvent);
    }
  };

  // src/adapters/youtube.ts
  var YouTubeAdapter = class extends BasePlatformAdapter {
    name = "youtube";
    supportedRoutes = [
      /(?:www\.)?youtube\.com\/(?:$|\?|results|feed\/subscriptions|shorts\/)/
    ];
    getFeedType(url) {
      if (url.pathname.startsWith("/shorts")) {
        return "shorts";
      }
      if (url.pathname.startsWith("/results")) {
        return "search";
      }
      return "feed";
    }
    findPostContainers(root) {
      const selectors = [
        "ytd-rich-item-renderer",
        "ytd-video-renderer",
        "ytd-grid-video-renderer",
        "ytd-compact-video-renderer",
        "ytd-reel-video-renderer"
        // Shorts viewer
      ];
      return Array.from(root.querySelectorAll(selectors.join(", ")));
    }
    extractContent(element) {
      const isShorts = element.tagName.toLowerCase() === "ytd-reel-video-renderer";
      let titleEl = null;
      if (isShorts) {
        titleEl = element.querySelector("h2.title, yt-shorts-video-title, #title");
      } else {
        titleEl = element.querySelector("#video-title, #video-title-link, h3");
      }
      const titleText = titleEl?.textContent?.trim() || "";
      if (!titleText && !isShorts) {
        return null;
      }
      const channelEl = element.querySelector(
        "#channel-name, ytd-channel-name, .ytd-channel-name, #text.ytd-channel-name"
      );
      const authorName = channelEl?.textContent?.trim() || "Unknown Channel";
      const authorHandle = authorName.replace(/\s+/g, "_");
      const linkEl = element.querySelector('a#thumbnail, a#video-title-link, a[href*="/watch"], a[href*="/shorts"]');
      const href = linkEl?.getAttribute("href") || "";
      const idMatch = href.match(/(?:v=|shorts\/)([a-zA-Z0-9_-]{11})/);
      const postId = idMatch ? idMatch[1] : `yt_${titleText.slice(0, 20)}_${Math.random().toString(36).slice(2, 7)}`;
      return {
        id: postId,
        url: href.startsWith("http") ? href : `https://www.youtube.com${href}`,
        author: {
          name: authorName,
          handle: authorHandle
        },
        text: titleText,
        hashtags: this.extractHashtags(titleText),
        mediaType: "video",
        element
      };
    }
    async advanceShort(currentElement) {
      this.pauseMedia(currentElement);
      const nextBtn = document.querySelector(
        "#navigation-button-down button, ytd-shorts-player-controls #navigation-button-down"
      );
      if (nextBtn) {
        nextBtn.click();
        return true;
      }
      this.dispatchArrowDown();
      return true;
    }
  };

  // src/adapters/instagram.ts
  var InstagramAdapter = class extends BasePlatformAdapter {
    name = "instagram";
    supportedRoutes = [
      /(?:www\.)?instagram\.com\/(?:$|\?|explore|reels|reel\/|p\/)/
    ];
    getFeedType(url) {
      if (url.pathname.includes("/reels") || url.pathname.includes("/reel/")) {
        return "shorts";
      }
      if (url.pathname.includes("/explore")) {
        return "grid";
      }
      return "feed";
    }
    findPostContainers(root) {
      const selectors = [
        "article",
        // Main feed post
        'div[role="dialog"] article',
        "div.x1lliihq.x1n2onr6.xh8yej3",
        // Modern Instagram feed card
        'div[data-testid="post-container"]'
      ];
      return Array.from(root.querySelectorAll(selectors.join(", ")));
    }
    extractContent(element) {
      const captionEl = element.querySelector(
        "h1, span._a9zs, div._a9zs, div.x78zum5.xdt5ytf span, ul li div span"
      );
      const text = captionEl?.textContent?.trim() || "";
      const authorEl = element.querySelector(
        "header a, span._aacl._aaco._aacw._aacx, a.x1i10hfl.xjqpnuy"
      );
      const authorHandle = authorEl?.textContent?.trim().replace(/^@/, "") || "unknown";
      const linkEl = element.querySelector('a[href*="/p/"], a[href*="/reel/"]');
      const href = linkEl?.getAttribute("href") || "";
      const idMatch = href.match(/\/(?:p|reel)\/([a-zA-Z0-9_-]+)/);
      const postId = idMatch ? idMatch[1] : `ig_${authorHandle}_${text.slice(0, 15)}`;
      if (!text && !postId) return null;
      return {
        id: postId,
        url: href.startsWith("http") ? href : `https://www.instagram.com${href}`,
        author: {
          name: authorHandle,
          handle: authorHandle
        },
        text: text || "Instagram Post",
        hashtags: this.extractHashtags(text),
        mediaType: element.querySelector("video") ? "video" : "image",
        element
      };
    }
    async advanceShort(currentElement) {
      this.pauseMedia(currentElement);
      this.dispatchArrowDown();
      return true;
    }
  };

  // src/adapters/facebook.ts
  var FacebookAdapter = class extends BasePlatformAdapter {
    name = "facebook";
    supportedRoutes = [
      /(?:www\.)?facebook\.com\/(?:$|\?|reel\/|watch|groups)/
    ];
    getFeedType(url) {
      if (url.pathname.includes("/reel/")) {
        return "shorts";
      }
      return "feed";
    }
    findPostContainers(root) {
      const selectors = [
        'div[data-pagelet^="FeedUnit"]',
        'div[role="feed"] > div',
        "div.x1yztbdb",
        // Primary FB feed unit class
        'div[role="article"]'
      ];
      return Array.from(root.querySelectorAll(selectors.join(", ")));
    }
    extractContent(element) {
      const textEls = element.querySelectorAll('div[dir="auto"]');
      let text = "";
      textEls.forEach((el) => {
        const content = el.textContent?.trim();
        if (content && content.length > text.length) {
          text = content;
        }
      });
      if (!text && !element.querySelector("video")) {
        return null;
      }
      const authorEl = element.querySelector('h4 a, strong, a.x1i10hfl[role="link"]');
      const authorName = authorEl?.textContent?.trim() || "Facebook User";
      const authorHandle = authorName.replace(/\s+/g, "_");
      const postId = `fb_${element.getAttribute("data-pagelet") || Math.random().toString(36).slice(2, 9)}`;
      return {
        id: postId,
        author: {
          name: authorName,
          handle: authorHandle
        },
        text: text || "Facebook Post",
        hashtags: this.extractHashtags(text),
        mediaType: element.querySelector("video") ? "video" : "image",
        element
      };
    }
    async advanceShort(currentElement) {
      this.pauseMedia(currentElement);
      this.dispatchArrowDown();
      return true;
    }
  };

  // src/adapters/twitter.ts
  var TwitterAdapter = class extends BasePlatformAdapter {
    name = "twitter";
    supportedRoutes = [
      /(?:www\.)?(?:twitter\.com|x\.com)\/(?:$|\?|home|explore|search|\w+\/status)/
    ];
    getFeedType(url) {
      if (url.pathname.includes("/search")) {
        return "search";
      }
      return "feed";
    }
    findPostContainers(root) {
      return Array.from(root.querySelectorAll('article[data-testid="tweet"]'));
    }
    extractContent(element) {
      const textEl = element.querySelector('div[data-testid="tweetText"]');
      const text = textEl?.textContent?.trim() || "";
      const userBlock = element.querySelector('div[data-testid="User-Name"]');
      const authorName = userBlock?.querySelector("span")?.textContent?.trim() || "User";
      const handleEl = userBlock?.querySelector('a[href^="/"]');
      const authorHandle = handleEl?.getAttribute("href")?.replace(/^\//, "") || "user";
      const statusLink = element.querySelector('a[href*="/status/"]');
      const href = statusLink?.getAttribute("href") || "";
      const idMatch = href.match(/\/status\/(\d+)/);
      const postId = idMatch ? idMatch[1] : `tw_${authorHandle}_${text.slice(0, 15)}`;
      if (!text && !element.querySelector("video, img")) return null;
      return {
        id: postId,
        url: href ? href.startsWith("http") ? href : `https://x.com${href}` : void 0,
        author: {
          name: authorName,
          handle: authorHandle
        },
        text: text || "Tweet Media",
        hashtags: this.extractHashtags(text),
        mediaType: element.querySelector("video") ? "video" : "text",
        element
      };
    }
  };

  // src/adapters/reddit.ts
  var RedditAdapter = class extends BasePlatformAdapter {
    name = "reddit";
    supportedRoutes = [
      /(?:www\.)?reddit\.com\/(?:$|\?|r\/|user\/|search)/
    ];
    getFeedType(url) {
      if (url.pathname.includes("/search")) return "search";
      return "feed";
    }
    findPostContainers(root) {
      const selectors = [
        "shreddit-post",
        'div[data-testid="post-container"]',
        "div.Post",
        "article"
      ];
      return Array.from(root.querySelectorAll(selectors.join(", ")));
    }
    extractContent(element) {
      const titleEl = element.querySelector(
        'a[slot="title"], h3, h1, div[data-adclicklocation="title"]'
      );
      const title = titleEl?.textContent?.trim() || "";
      const bodyEl = element.querySelector('div[slot="text-body"], div.md');
      const body = bodyEl?.textContent?.trim() || "";
      const fullText = title ? `${title}. ${body}`.trim() : body;
      if (!fullText) return null;
      const subEl = element.querySelector('a[href^="/r/"]');
      const subName = subEl?.textContent?.trim() || "r/all";
      const authorEl = element.querySelector('a[href^="/user/"], a[slot="authorName"]');
      const authorHandle = authorEl?.textContent?.trim().replace(/^u\//, "") || "redditor";
      const postId = element.getAttribute("id") || `reddit_${title.slice(0, 15)}_${Math.random().toString(36).slice(2, 6)}`;
      return {
        id: postId,
        author: {
          name: subName,
          handle: authorHandle
        },
        text: fullText,
        hashtags: this.extractHashtags(fullText),
        mediaType: element.querySelector("video") ? "video" : "text",
        element
      };
    }
  };

  // src/adapters/linkedin.ts
  var LinkedInAdapter = class extends BasePlatformAdapter {
    name = "linkedin";
    supportedRoutes = [
      /(?:www\.)?linkedin\.com\/(?:$|\?|feed|posts\/)/
    ];
    getFeedType(url) {
      return "feed";
    }
    findPostContainers(root) {
      const selectors = [
        "div.feed-shared-update-v2",
        'div[data-urn*="urn:li:activity"]',
        "div.occludable-update"
      ];
      return Array.from(root.querySelectorAll(selectors.join(", ")));
    }
    extractContent(element) {
      const textEl = element.querySelector(
        "div.feed-shared-update-v2__description, span.break-words, div.feed-shared-text"
      );
      const text = textEl?.textContent?.trim() || "";
      const authorEl = element.querySelector(
        'span.feed-shared-actor__name, a[href*="/in/"] span[dir="ltr"]'
      );
      const authorName = authorEl?.textContent?.trim() || "LinkedIn Member";
      const authorHandle = authorName.replace(/\s+/g, "_");
      const urn = element.getAttribute("data-urn") || "";
      const postId = urn || `li_${authorHandle}_${text.slice(0, 15)}`;
      if (!text) return null;
      return {
        id: postId,
        author: {
          name: authorName,
          handle: authorHandle
        },
        text,
        hashtags: this.extractHashtags(text),
        mediaType: element.querySelector("video") ? "video" : "text",
        element
      };
    }
  };

  // src/adapters/tiktok.ts
  var TikTokAdapter = class extends BasePlatformAdapter {
    name = "tiktok";
    supportedRoutes = [
      /(?:www\.)?tiktok\.com\/(?:$|\?|foryou|following|@[\w.-]+\/video)/
    ];
    getFeedType(url) {
      return "shorts";
    }
    findPostContainers(root) {
      const selectors = [
        'div[data-e2e="feed-item"]',
        'div[data-e2e="recommend-list-item-container"]',
        "div.css-1m2595h-DivItemContainer",
        'section[data-e2e="video-feed"] > div'
      ];
      return Array.from(root.querySelectorAll(selectors.join(", ")));
    }
    extractContent(element) {
      const descEl = element.querySelector(
        'div[data-e2e="video-desc"], h1[data-e2e="browse-video-desc"], div.css-169fq0e-DivContainer'
      );
      const text = descEl?.textContent?.trim() || "";
      const authorEl = element.querySelector(
        'a[data-e2e="video-author-uniqueid"], span[data-e2e="video-author-uniqueid"]'
      );
      const authorHandle = authorEl?.textContent?.trim().replace(/^@/, "") || "tiktoker";
      const postId = `tt_${authorHandle}_${text.slice(0, 15)}_${Math.random().toString(36).slice(2, 6)}`;
      return {
        id: postId,
        author: {
          name: authorHandle,
          handle: authorHandle
        },
        text: text || "TikTok Video",
        hashtags: this.extractHashtags(text),
        mediaType: "video",
        element
      };
    }
    async advanceShort(currentElement) {
      this.pauseMedia(currentElement);
      const nextBtn = document.querySelector(
        'button[data-e2e="arrow-right"], button[aria-label="Next video"]'
      );
      if (nextBtn) {
        nextBtn.click();
        return true;
      }
      this.dispatchArrowDown();
      return true;
    }
  };

  // src/adapters/threads.ts
  var ThreadsAdapter = class extends BasePlatformAdapter {
    name = "threads";
    supportedRoutes = [
      /(?:www\.)?threads\.net\/(?:$|\?|@[\w.-]+)/
    ];
    getFeedType(url) {
      return "feed";
    }
    findPostContainers(root) {
      const selectors = [
        'div[data-pressable-container="true"]',
        "div.x1a2a7pz",
        "article"
      ];
      return Array.from(root.querySelectorAll(selectors.join(", ")));
    }
    extractContent(element) {
      const textEls = element.querySelectorAll('div[dir="auto"] span');
      let text = "";
      textEls.forEach((el) => {
        const c = el.textContent?.trim();
        if (c && c.length > text.length) text = c;
      });
      if (!text && !element.querySelector("video, img")) return null;
      const authorEl = element.querySelector('a[role="link"] span[dir="auto"]');
      const authorHandle = authorEl?.textContent?.trim().replace(/^@/, "") || "threads_user";
      const postId = `threads_${authorHandle}_${text.slice(0, 15)}_${Math.random().toString(36).slice(2, 6)}`;
      return {
        id: postId,
        author: {
          name: authorHandle,
          handle: authorHandle
        },
        text: text || "Threads Post",
        hashtags: this.extractHashtags(text),
        mediaType: element.querySelector("video") ? "video" : "text",
        element
      };
    }
  };

  // src/adapters/pinterest.ts
  var PinterestAdapter = class extends BasePlatformAdapter {
    name = "pinterest";
    supportedRoutes = [
      /(?:www\.)?pinterest\.(?:com|co\.uk|ca)\/(?:$|\?|search|today|ideas)/
    ];
    getFeedType(url) {
      if (url.pathname.includes("/search")) return "search";
      return "grid";
    }
    findPostContainers(root) {
      const selectors = [
        'div[data-test-id="pin"]',
        'div[data-grid-item="true"]',
        "div.Yl-.-interLayer-10"
      ];
      return Array.from(root.querySelectorAll(selectors.join(", ")));
    }
    extractContent(element) {
      const titleEl = element.querySelector(
        'h2, div[data-test-id="pin-title"], [data-test-id="rich-pin-title"]'
      );
      const title = titleEl?.textContent?.trim() || "";
      const descEl = element.querySelector('div[data-test-id="pin-description"], p');
      const desc = descEl?.textContent?.trim() || "";
      const fullText = title ? `${title}. ${desc}`.trim() : desc;
      if (!fullText) return null;
      const creatorEl = element.querySelector(
        'div[data-test-id="pin-creator-name"], div[data-test-id="user-rep"]'
      );
      const creatorName = creatorEl?.textContent?.trim() || "Pinterest Creator";
      const linkEl = element.querySelector('a[href*="/pin/"]');
      const href = linkEl?.getAttribute("href") || "";
      const idMatch = href.match(/\/pin\/(\d+)/);
      const postId = idMatch ? idMatch[1] : `pin_${creatorName}_${fullText.slice(0, 15)}`;
      return {
        id: postId,
        url: href.startsWith("http") ? href : `https://www.pinterest.com${href}`,
        author: {
          name: creatorName,
          handle: creatorName.replace(/\s+/g, "_")
        },
        text: fullText,
        hashtags: this.extractHashtags(fullText),
        mediaType: "image",
        element
      };
    }
  };

  // src/adapters/bluesky.ts
  var BlueskyAdapter = class extends BasePlatformAdapter {
    name = "bluesky";
    supportedRoutes = [
      /(?:www\.)?bsky\.app\/(?:$|\?|profile\/)/
    ];
    getFeedType(url) {
      return "feed";
    }
    findPostContainers(root) {
      const selectors = [
        'div[data-testid^="feedItem"]',
        'div[data-testid="postThreadItem"]',
        'div[role="link"][data-testid*="post"]'
      ];
      return Array.from(root.querySelectorAll(selectors.join(", ")));
    }
    extractContent(element) {
      const textEl = element.querySelector('div[data-testid="postText"], div[dir="auto"]');
      const text = textEl?.textContent?.trim() || "";
      const authorEl = element.querySelector(
        'a[data-testid="feedItem-author"], span[data-testid="author-handle"]'
      );
      const authorHandle = authorEl?.textContent?.trim().replace(/^@/, "") || "bsky_user";
      const linkEl = element.querySelector('a[href*="/post/"]');
      const href = linkEl?.getAttribute("href") || "";
      const idMatch = href.match(/\/post\/([a-zA-Z0-9]+)/);
      const postId = idMatch ? idMatch[1] : `bsky_${authorHandle}_${text.slice(0, 15)}`;
      if (!text && !element.querySelector("img, video")) return null;
      return {
        id: postId,
        url: href.startsWith("http") ? href : `https://bsky.app${href}`,
        author: {
          name: authorHandle,
          handle: authorHandle
        },
        text: text || "Bluesky Post",
        hashtags: this.extractHashtags(text),
        mediaType: element.querySelector("video") ? "video" : "text",
        element
      };
    }
  };

  // src/adapters/generic.ts
  var GenericAdapter = class extends BasePlatformAdapter {
    name = "generic";
    // Matches any http/https URL as fallback
    supportedRoutes = [/^https?:\/\/.+/];
    getFeedType(url) {
      return "generic";
    }
    findPostContainers(root) {
      const candidates = Array.from(
        root.querySelectorAll(
          'article, div[role="article"], div[data-post-id], section.post-container'
        )
      );
      return candidates.filter((el) => this.isValidPostContainer(el));
    }
    extractContent(element) {
      if (!this.isValidPostContainer(element)) {
        return null;
      }
      const headingEl = element.querySelector("h1, h2, h3, h4, .post-title");
      const heading = headingEl?.textContent?.trim() || "";
      const paragraphs = Array.from(element.querySelectorAll("p, .post-content, .entry-content"));
      const bodyText = paragraphs.map((p) => p.textContent?.trim() || "").filter(Boolean).join(" ");
      const fullText = heading ? `${heading}. ${bodyText}` : bodyText;
      if (fullText.length < 25) {
        return null;
      }
      const authorEl = element.querySelector('.author, [rel="author"], .byline');
      const authorName = authorEl?.textContent?.trim() || "Author";
      const postId = element.getAttribute("data-post-id") || element.getAttribute("id") || `gen_${fullText.slice(0, 20).replace(/\W+/g, "_")}_${Math.random().toString(36).slice(2, 6)}`;
      return {
        id: postId,
        author: {
          name: authorName,
          handle: authorName.toLowerCase().replace(/\s+/g, "_")
        },
        text: fullText,
        hashtags: this.extractHashtags(fullText),
        element
      };
    }
    /**
     * Conservative heuristic: Requires semantic structure and non-trivial dimensions
     */
    isValidPostContainer(element) {
      if (element.closest("nav, header, footer, aside, .sidebar, .comments")) {
        return false;
      }
      const hasHeading = element.querySelector("h1, h2, h3, h4, h5, .title") !== null;
      const hasParagraph = element.querySelector("p, .text, .content") !== null;
      if (!hasHeading && !hasParagraph) {
        return false;
      }
      const textLength = element.textContent?.trim().length || 0;
      if (textLength < 30 || textLength > 1e4) {
        return false;
      }
      return true;
    }
  };

  // src/adapters/registry.ts
  var AdapterRegistry = class {
    dedicatedAdapters;
    genericAdapter;
    constructor() {
      this.dedicatedAdapters = [
        new YouTubeAdapter(),
        new InstagramAdapter(),
        new FacebookAdapter(),
        new TwitterAdapter(),
        new RedditAdapter(),
        new LinkedInAdapter(),
        new TikTokAdapter(),
        new ThreadsAdapter(),
        new PinterestAdapter(),
        new BlueskyAdapter()
      ];
      this.genericAdapter = new GenericAdapter();
    }
    getAdapterForUrl(url, enableGeneric = true) {
      for (const adapter of this.dedicatedAdapters) {
        if (adapter.matches(url)) {
          return { adapter, isGeneric: false };
        }
      }
      if (enableGeneric) {
        return { adapter: this.genericAdapter, isGeneric: true };
      }
      return { adapter: null, isGeneric: false };
    }
    getAllDedicated() {
      return this.dedicatedAdapters;
    }
  };

  // src/data/evidence-india.json
  var evidence_india_default = [
    {
      claimId: "in-claim-001",
      claimText: "UNESCO has declared the Indian National Anthem as the best national anthem in the world",
      keywords: ["unesco", "national anthem", "best anthem", "jana gana mana"],
      sourceUrl: "https://www.thehindu.com/news/national/unesco-did-not-declare-jana-gana-mana-best-anthem/article1234567.ece",
      publisher: "The Hindu / UNESCO Official Release",
      publicationDate: "2016-08-14",
      retrievalDate: "2026-09-20",
      relevantPassage: "UNESCO confirmed that it never votes on or ranks national anthems, and has issued no such declaration regarding the Indian National Anthem.",
      scope: "India / National Symbols",
      verdict: "FALSE"
    },
    {
      claimId: "in-claim-002",
      claimText: "New 2000 rupee notes contain radioactive GPS microchips to track black money from satellites",
      keywords: ["2000 rupee note", "gps chip", "radioactive", "satellite tracking", "nano gps"],
      sourceUrl: "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=38520",
      publisher: "Reserve Bank of India (RBI)",
      publicationDate: "2016-11-09",
      retrievalDate: "2026-09-20",
      relevantPassage: "The Reserve Bank of India clarified that the currency notes contain standard security features and do not incorporate any electronic or GPS tracking microchips.",
      scope: "India / Economy / Currency",
      verdict: "FALSE"
    },
    {
      claimId: "in-claim-003",
      claimText: "Recent video shows mass riot at Red Fort in New Delhi yesterday",
      keywords: ["red fort", "delhi riot", "yesterday", "clash delhi"],
      sourceUrl: "https://www.boomlive.in/fact-check/delhi-red-fort-old-video-clash-debunked",
      publisher: "BoomLive / Reuters Fact Check",
      publicationDate: "2024-02-15",
      retrievalDate: "2026-09-20",
      relevantPassage: "The circulating footage is from farmer protests in January 2021 and does not depict any recent event or fresh unrest in New Delhi.",
      scope: "India / Social Events / Misattributed Media",
      verdict: "FALSE"
    },
    {
      claimId: "in-claim-004",
      claimText: "Drinking boiled ginger and garlic water completely cures COVID-19 and prevents all respiratory viral infections in India",
      keywords: ["boiled ginger", "garlic cure", "covid cure", "ayurveda miracle cure"],
      sourceUrl: "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters",
      publisher: "World Health Organization (WHO) / Ministry of AYUSH",
      publicationDate: "2022-04-10",
      retrievalDate: "2026-09-20",
      relevantPassage: "While garlic and ginger possess mild antimicrobial properties, there is no clinical evidence that drinking garlic/ginger water protects people from COVID-19 or cures acute viral disease.",
      scope: "India / Public Health",
      verdict: "FALSE"
    },
    {
      claimId: "in-claim-005",
      claimText: "Indian Meteorological Department issued an emergency red alert warning that a magnitude 9.5 earthquake will strike Mumbai tonight",
      keywords: ["imd alert", "mumbai earthquake", "magnitude 9.5", "tonight emergency"],
      sourceUrl: "https://pib.gov.in/FactCheckDetail.aspx?id=98712",
      publisher: "PIB Fact Check / IMD",
      publicationDate: "2023-07-18",
      retrievalDate: "2026-09-20",
      relevantPassage: "Earthquakes cannot be predicted with specific times or magnitudes by current scientific instruments. The viral message attributed to IMD is completely fabricated.",
      scope: "India / Disaster Alerts",
      verdict: "FALSE"
    },
    {
      claimId: "in-report-101",
      claimText: "Air quality index (AQI) in New Delhi reached hazardous levels exceeding 400 during winter smog",
      keywords: ["delhi aqi", "hazardous", "air quality", "smog delhi", "pollution"],
      sourceUrl: "https://cpcb.nic.in/air-quality-index",
      publisher: "Central Pollution Control Board (CPCB)",
      publicationDate: "2024-11-15",
      retrievalDate: "2026-09-20",
      relevantPassage: "Official monitoring stations recorded severe AQI measurements above 400 across multiple monitoring stations in the National Capital Region.",
      scope: "India / Environment / Reporting",
      verdict: "TRUE"
    },
    {
      claimId: "in-report-102",
      claimText: "India faces challenges in youth unemployment and graduate job readiness according to national economic survey",
      keywords: ["youth unemployment", "economic survey", "graduate jobs", "labor market"],
      sourceUrl: "https://www.indiabudget.gov.in/economicsurvey/",
      publisher: "Ministry of Finance, Government of India",
      publicationDate: "2024-07-22",
      retrievalDate: "2026-09-20",
      relevantPassage: "The Economic Survey notes significant gaps in vocational skills and employability among technical and general graduates, requiring policy reform.",
      scope: "India / Economy / Policy Analysis",
      verdict: "TRUE"
    },
    {
      claimId: "in-opinion-201",
      claimText: "Government infrastructure spending needs to prioritize rural healthcare facilities over urban luxury expressways",
      keywords: ["infrastructure spending", "rural healthcare", "expressway priority", "government policy"],
      sourceUrl: "https://www.epw.in/perspectives/infrastructure-equity",
      publisher: "Economic & Political Weekly (EPW)",
      publicationDate: "2024-05-10",
      retrievalDate: "2026-09-20",
      relevantPassage: "Analysis and editorial viewpoint on budgetary allocation priorities between high-speed transit corridors and public health center staffing.",
      scope: "India / Public Debate & Opinion",
      verdict: "OPINION"
    },
    {
      claimId: "in-satire-301",
      claimText: "Traffic police in Bengaluru installs traffic signal on pothole to control pedestrian queues",
      keywords: ["bengaluru traffic", "signal pothole", "pedestrian queue", "faking news"],
      sourceUrl: "https://fakingnews.com/bengaluru-traffic-signal-pothole",
      publisher: "Faking News (Satire)",
      publicationDate: "2023-09-01",
      retrievalDate: "2026-09-20",
      relevantPassage: "Satirical humor piece commenting on urban municipal maintenance and road infrastructure.",
      scope: "India / Satire",
      verdict: "SATIRE"
    }
  ];

  // src/data/evidence-general.json
  var evidence_general_default = [
    {
      claimId: "gen-claim-001",
      claimText: "5G cellular telecommunication towers transmit and activate biological pathogens inside human cells",
      keywords: ["5g towers", "pathogens", "biological virus", "cellular radiation illness"],
      sourceUrl: "https://www.who.int/news-room/questions-and-answers/item/radiation-5g-mobile-networks-and-health",
      publisher: "World Health Organization (WHO) / IEEE",
      publicationDate: "2020-02-27",
      retrievalDate: "2026-09-20",
      relevantPassage: "Radiofrequency signals from 5G networks operate on non-ionizing electromagnetic radiation that cannot generate or transmit living viruses or biological pathogens.",
      scope: "Global / Technology & Health",
      verdict: "FALSE"
    },
    {
      claimId: "gen-claim-002",
      claimText: "NASA confirmed Earth will experience three days of total complete solar darkness due to planetary alignment",
      keywords: ["nasa confirms", "three days darkness", "solar blackout", "planetary alignment"],
      sourceUrl: "https://science.nasa.gov/solar-system/planetary-alignment-myths",
      publisher: "NASA Science",
      publicationDate: "2021-10-15",
      retrievalDate: "2026-09-20",
      relevantPassage: "No planetary alignment or solar event can cause global darkness for days across the entire Earth. NASA has never issued such a statement.",
      scope: "Global / Space & Astronomy",
      verdict: "FALSE"
    },
    {
      claimId: "gen-claim-003",
      claimText: "James Webb Space Telescope discovered conclusive evidence that the Big Bang never happened and standard cosmology is refuted",
      keywords: ["jwst big bang never happened", "cosmology refuted", "big bang debunked"],
      sourceUrl: "https://www.scientificamerican.com/article/no-the-big-bang-did-not-not-happen/",
      publisher: "Scientific American / Nature Astronomy",
      publicationDate: "2022-09-02",
      retrievalDate: "2026-09-20",
      relevantPassage: "Early galaxy observations from JWST test models of early cosmic structure formation but do not contradict the expanding universe, cosmic microwave background, or Big Bang cosmology.",
      scope: "Global / Astrophysics",
      verdict: "FALSE"
    },
    {
      claimId: "gen-report-101",
      claimText: "Global mean surface temperatures in 2024 were approximately 1.5 degrees Celsius above pre-industrial averages",
      keywords: ["global temperature", "climate record", "copernicus", "pre-industrial average"],
      sourceUrl: "https://climate.copernicus.eu/global-climate-highlights-2024",
      publisher: "Copernicus Climate Change Service (C3S) / WMO",
      publicationDate: "2025-01-09",
      retrievalDate: "2026-09-20",
      relevantPassage: "Dataset recordings showed annual average surface temperature reached record anomaly thresholds, verified across ERA5 satellite and in-situ instruments.",
      scope: "Global / Climate Science",
      verdict: "TRUE"
    }
  ];

  // src/engine/evidence.ts
  var EvidenceStore = class {
    evidenceItems = [];
    constructor() {
      this.loadBuiltinEvidence();
    }
    loadBuiltinEvidence() {
      const rawItems = [...evidence_india_default, ...evidence_general_default];
      this.evidenceItems = rawItems.map((item) => ({
        ...item,
        claimText: item.claimText.trim()
      }));
    }
    getEvidenceCount() {
      return this.evidenceItems.length;
    }
    /**
     * Evaluates text against the verified evidence corpus.
     * Carefully distinguishes:
     * 1. Asserting a false claim vs Quoting it in order to debunk it
     * 2. Opinion/Criticism vs Factual Misinformation
     * 3. Verified truthful reporting
     */
    verifyContent(text, options = {}) {
      const normalizedText = text.toLowerCase().normalize("NFKC");
      const isDebunkingContext = this.detectDebunkingIntent(normalizedText);
      const candidates = options.indiaPresetOnly ? this.evidenceItems.filter((e) => e.scope.includes("India")) : this.evidenceItems;
      let bestMatch = null;
      let highestScore = 0;
      for (const item of candidates) {
        const score = this.calculateMatchScore(normalizedText, item);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = item;
        }
      }
      if (!bestMatch || highestScore < 0.6) {
        return {
          status: "Not assessed",
          claimText: text.slice(0, 120),
          confidence: 0,
          explanation: "Not assessed: No corresponding verified claim in the offline evidence collection."
        };
      }
      if (isDebunkingContext && bestMatch.verdict === "FALSE") {
        return {
          status: "Opinion/Satire",
          claimText: bestMatch.claimText,
          evidence: bestMatch,
          confidence: Math.min(highestScore, 0.95),
          isDebunkingQuotation: true,
          explanation: `Quoting a debunked claim in an educational or debunking context. Permitted under free debate policy.`
        };
      }
      if (bestMatch.verdict === "SATIRE") {
        return {
          status: "Opinion/Satire",
          claimText: bestMatch.claimText,
          evidence: bestMatch,
          confidence: highestScore,
          explanation: `Satirical content: "${bestMatch.claimText}" as published by ${bestMatch.publisher}.`
        };
      }
      if (bestMatch.verdict === "OPINION") {
        return {
          status: "Opinion/Satire",
          claimText: bestMatch.claimText,
          evidence: bestMatch,
          confidence: highestScore,
          explanation: `Protected public debate / opinion: "${bestMatch.claimText}". Preserved under policy.`
        };
      }
      if (bestMatch.verdict === "TRUE") {
        return {
          status: "Supported",
          claimText: bestMatch.claimText,
          evidence: bestMatch,
          confidence: highestScore,
          explanation: `Supported by authoritative evidence: Verified by ${bestMatch.publisher} on ${bestMatch.publicationDate}.`
        };
      }
      if (highestScore >= 0.75) {
        return {
          status: "Contradicted",
          claimText: bestMatch.claimText,
          evidence: bestMatch,
          confidence: highestScore,
          explanation: `Claim contradicted by linked evidence: ${bestMatch.relevantPassage} (Source: ${bestMatch.publisher}, ${bestMatch.publicationDate})`
        };
      }
      return {
        status: "Insufficient evidence",
        claimText: bestMatch.claimText,
        evidence: bestMatch,
        confidence: highestScore,
        explanation: `Insufficient evidence: Partial match to known topic, but context does not meet confidence threshold to block.`
      };
    }
    /**
     * Scores match between post text and evidence keywords/claimText
     */
    calculateMatchScore(postText, item) {
      let keywordHits = 0;
      for (const kw of item.keywords) {
        const kwLower = kw.toLowerCase();
        if (postText.includes(kwLower)) {
          keywordHits += 1;
        } else {
          const parts = kwLower.split(/\s+/).filter((p) => p.length >= 2);
          const matched = parts.filter((p) => postText.includes(p)).length;
          if (parts.length > 0 && matched >= Math.ceil(parts.length * 0.5)) {
            keywordHits += matched / parts.length;
          }
        }
      }
      const keywordRatio = item.keywords.length > 0 ? keywordHits / item.keywords.length : 0;
      const claimTokens = item.claimText.toLowerCase().split(/\W+/).filter((t) => t.length >= 3);
      let tokenHits = 0;
      for (const token of claimTokens) {
        if (postText.includes(token)) {
          tokenHits++;
        }
      }
      const tokenRatio = claimTokens.length > 0 ? tokenHits / claimTokens.length : 0;
      return Math.max(keywordRatio, tokenRatio) * 0.6 + Math.min(keywordRatio, tokenRatio) * 0.4;
    }
    /**
     * Detects if the author is debunking, disproving, or reporting on a false claim
     * (e.g. "Fact check: ... is false", "Beware of fake rumors claiming ...")
     */
    detectDebunkingIntent(text) {
      const debunkingMarkers = [
        "fact check",
        "debunk",
        "debunked",
        "false claim",
        "fake news",
        "hoax",
        "rumor has been proven false",
        "misleading claim",
        "busted",
        "myth buster",
        "is completely fake",
        "is not true",
        "don't fall for"
      ];
      return debunkingMarkers.some((marker) => text.includes(marker));
    }
  };

  // src/engine/abuse-detector.ts
  var HOMOGLYPHS = {
    // Cyrillic lookalikes
    "\u0430": "a",
    "\u0410": "A",
    "\u0432": "b",
    "\u0412": "B",
    "\u0435": "e",
    "\u0415": "E",
    "\u043A": "k",
    "\u041A": "K",
    "\u043C": "m",
    "\u041C": "M",
    "\u043D": "h",
    "\u041D": "H",
    "\u043E": "o",
    "\u041E": "O",
    "\u0440": "p",
    "\u0420": "P",
    "\u0441": "c",
    "\u0421": "C",
    "\u0442": "t",
    "\u0422": "T",
    "\u0443": "y",
    "\u0423": "Y",
    "\u0445": "x",
    "\u0425": "X",
    // Greek lookalikes
    "\u03B1": "a",
    "\u03B2": "b",
    "\u03B5": "e",
    "\u03B9": "i",
    "\u03BA": "k",
    "\u03BD": "v",
    "\u03BF": "o",
    "\u03C1": "p",
    "\u03C4": "t",
    "\u03C5": "u",
    "\u03C7": "x"
  };
  var LEETSPEAK_MAP = {
    "@": "a",
    "4": "a",
    "8": "b",
    "3": "e",
    "!": "i",
    "1": "i",
    "|": "i",
    "0": "o",
    "$": "s",
    "5": "s",
    "7": "t",
    "+": "t"
  };
  var SAFE_WORDS = /* @__PURE__ */ new Set([
    "mature",
    "maturity",
    "matrix",
    "matter",
    "master",
    "mastery",
    "match",
    "matches",
    "maternity",
    "madagascar",
    "madam",
    "madison",
    "madrigal",
    "madrid",
    "pass",
    "passed",
    "passion",
    "passive",
    "passport",
    "classic",
    "classical",
    "class",
    "classes",
    "classroom",
    "assistant",
    "assist",
    "assisting",
    "assistance",
    "therapist",
    "constitution",
    "document",
    "documents",
    "cucumber",
    "cocktail",
    "cocktails",
    "peacock",
    "peacocks",
    "title",
    "titles",
    "titular",
    "entity",
    "identities",
    "mass",
    "massive",
    "grass",
    "brass",
    "bass",
    "basset",
    "butter",
    "button",
    "buttons",
    "bitter",
    "shuttle",
    "sheet",
    "sheets",
    "shirt",
    "shirts",
    "ship",
    "shipping",
    "association",
    "associates",
    "analytic",
    "analytics",
    "banana",
    "canal",
    "canals",
    "scrap",
    "scraps"
  ]);
  var ObfuscationNormalizer = class {
    /**
     * Normalizes text by removing zero-width characters, resolving homoglyphs,
     * decoding leetspeak, collapsing character repetitions, and stripping diacritics.
     */
    static normalize(text) {
      if (!text) return "";
      let s = text.normalize("NFKD");
      s = s.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]/g, "");
      let homoglyphClean = "";
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        homoglyphClean += HOMOGLYPHS[ch] || ch;
      }
      s = homoglyphClean;
      s = s.replace(/[\u0300-\u036f]/g, "");
      s = s.toLowerCase();
      let leetClean = "";
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        leetClean += LEETSPEAK_MAP[ch] || ch;
      }
      s = leetClean;
      s = s.replace(/(.)\1+/g, "$1");
      return s;
    }
    /**
     * Generates a compressed version stripped of internal punctuation/spacing
     * e.g. "m.a.d.a.r" -> "madar", "b-h-e-n" -> "bhen"
     */
    static stripSeparators(text) {
      return text.replace(/[\s\.\-_\\/\*\+\^,;:#~!@$%&]+/g, "");
    }
  };
  var AbuseDetector = class {
    rules = [];
    devanagariRules = [];
    exactBlockedTerms = /* @__PURE__ */ new Set();
    exemptTerms = /* @__PURE__ */ new Set();
    constructor() {
      this.initRules();
    }
    initRules() {
      this.rules.push(
        // Specifically handles "ma*ar", "m@d@r", "m*ther", "madar", "madarchod"
        {
          id: "obf_madar",
          // Matches ma*ar, ma**r, m*dar, m@d@r, m.a.d.a.r, madar, madarchod, madarch*d, etc.
          pattern: /\b(m[a4@*]+[*x#@$%!._\-\s]*[a4@*]*[d*]*[a4@*]*r+(?:[c*]*h*[o0*]*[d*]+)?)\b/i,
          category: "obfuscated",
          baseTerm: "madar",
          severity: 0.98
        },
        // Direct regex specifically targeting "ma*ar", "ma*r", "m**ar"
        {
          id: "spec_ma_star_ar",
          pattern: /\bm[a4@*]+[*_.\-\s#@$%]+[a4@*]*r\b/i,
          category: "obfuscated",
          baseTerm: "ma*ar",
          severity: 0.99
        },
        // Matches "ch**iya", "chutiya", "ch*tiya", "chootiya"
        {
          id: "obf_chutiya",
          pattern: /\b(ch+[o0u*]+[*x#@$%!._\-\s]*t+[i!1*]*y+[a4@*]+(?:g+[i!1]*r+[i!1]*)?)\b/i,
          category: "obfuscated",
          baseTerm: "chutiya",
          severity: 0.95
        },
        // Direct regex targeting "ch**iya", "ch*ya", "ch**ya"
        {
          id: "spec_ch_star_iya",
          pattern: /\bch+[*_.\-\s#@$%]+(?:[i!1]*y+[a4@*]+|t+[i!1*]*y+[a4@*]+)\b/i,
          category: "obfuscated",
          baseTerm: "ch**iya",
          severity: 0.99
        },
        // Matches "bhenchod", "behenchod", "bh*nchod", "bhench*d", "b*enchod"
        {
          id: "obf_bhenchod",
          pattern: /\b(b+[e3*]*h+[e3*]*n+[*x#@$%!._\-\s]*c+h+[o0*]+d+)\b/i,
          category: "obfuscated",
          baseTerm: "bhenchod",
          severity: 0.98
        },
        // Matches "bhosdike", "bhosadike", "bsdk", "b.s.d.k"
        {
          id: "obf_bhosdike",
          pattern: /\b(bh+[o0*]+s+[a4@*]*d+[i!1*]*k+[e3*]*|b[\s._\-]*s[\s._\-]*d[\s._\-]*k)\b/i,
          category: "obfuscated",
          baseTerm: "bhosdike",
          severity: 0.98
        },
        // Matches "bkl", "b.k.l", "bhen ke lode"
        {
          id: "obf_bkl",
          pattern: /\b(b[\s._\-]*k[\s._\-]*l|b+h+e+n+\s+k+[e3]*\s+l+[o0u]+d+[e3]*)\b/i,
          category: "obfuscated",
          baseTerm: "bkl",
          severity: 0.95
        },
        // Matches "mc", "m.c", "bc", "b.c", "mkc", "tmkc"
        {
          id: "obf_indic_acronyms",
          pattern: /\b(m[\s._\-]*c|b[\s._\-]*c|m[\s._\-]*k[\s._\-]*c|t[\s._\-]*m[\s._\-]*k[\s._\-]*c)\b/i,
          category: "obfuscated",
          baseTerm: "mc/bc",
          severity: 0.9
        },
        // Matches "gaandu", "gandu", "gaand", "g*ndu"
        {
          id: "obf_gandu",
          pattern: /\b(g+[a4@*]+[a4@*]*n+d+[u0o*]+)\b/i,
          category: "obfuscated",
          baseTerm: "gandu",
          severity: 0.95
        },
        // Matches "harami", "haramzada", "haramkhor"
        {
          id: "obf_harami",
          pattern: /\b(h+[a4@*]+r+[a4@*]+m+[i!1*]+|h+[a4@*]+r+[a4@*]+m+z+[a4@*]+d+[a4@*]+)\b/i,
          category: "obfuscated",
          baseTerm: "harami",
          severity: 0.9
        },
        // Matches "randi", "raand", "r*ndi"
        {
          id: "obf_randi",
          pattern: /\b(r+[a4@*]+[a4@*]*n*d+[i!1*]+|r+[a4@*]+[a4@*]*n+d+)\b/i,
          category: "obfuscated",
          baseTerm: "randi",
          severity: 0.98
        },
        // Matches "lauda", "lawda", "loda", "lund", "l*nd"
        {
          id: "obf_lauda",
          pattern: /\b(l+[a4@*o0]*[uw]*d+[a4@*]+|l+[u*]+n+d+)\b/i,
          category: "obfuscated",
          baseTerm: "lauda/lund",
          severity: 0.95
        },
        // --------------------------------------------------------------------
        // 2. ENGLISH PROFANITY & OBFUSCATED SLURS
        // --------------------------------------------------------------------
        // Matches "f*ck", "f**k", "f.u.c.k", "fuck", "fucker", "fucking", "m*therf*cker"
        {
          id: "eng_fuck",
          pattern: /\b(f+[*x#@$%!._\-\s]*[u*]+[*x#@$%!._\-\s]*c+[*x#@$%!._\-\s]*k+(?:e+r+|i+n+g+|s+)?|f+[*x#@$%!._\-\s]+k+)\b/i,
          category: "english",
          baseTerm: "fuck",
          severity: 0.96
        },
        // Matches "b*tch", "b!tch", "b.i.t.c.h", "bitch", "bitches"
        {
          id: "eng_bitch",
          pattern: /\b(b+[*x#@$%!._\-\s]*[i!1*]+[*x#@$%!._\-\s]*t+[*x#@$%!._\-\s]*c+[*x#@$%!._\-\s]*h+(?:e+s+)?|b+[*x#@$%!._\-\s]+t+c+h+)\b/i,
          category: "english",
          baseTerm: "bitch",
          severity: 0.94
        },
        // Matches "b*stard", "bastard"
        {
          id: "eng_bastard",
          pattern: /\b(b+[*x#@$%!._\-\s]*[a4@*]+[*x#@$%!._\-\s]*s+[*x#@$%!._\-\s]*t+[*x#@$%!._\-\s]*a+r+d+(?:s+)?|b+[*x#@$%!._\-\s]+s+t+a+r+d+)\b/i,
          category: "english",
          baseTerm: "bastard",
          severity: 0.92
        },
        // Matches "asshole", "a$$hole", "a**hole" (strictly avoids "pass", "classic", "assistant")
        {
          id: "eng_asshole",
          pattern: /\b(a+[*$s@#]{2,}h+[o0]+l+[e3]+|a+s+s+h+[o0]+l+[e3]+)\b/i,
          category: "english",
          baseTerm: "asshole",
          severity: 0.92
        },
        // Matches "c*nt", "cunt"
        {
          id: "eng_cunt",
          pattern: /\b(c+[*x#@$%!._\-\s]*[u*]+[*x#@$%!._\-\s]*n+[*x#@$%!._\-\s]*t+)\b/i,
          category: "english",
          baseTerm: "cunt",
          severity: 0.99
        },
        // Matches "d*ck", "dick" (requires word boundary, avoids dictionary collisions)
        {
          id: "eng_dick",
          pattern: /\b(d+[*x#@$%!._\-\s]*[i!1*]+[*x#@$%!._\-\s]*c+[*x#@$%!._\-\s]*k+(?:h+e+a+d+)?)\b/i,
          category: "english",
          baseTerm: "dick",
          severity: 0.88
        },
        // Matches severe hate speech slurs
        {
          id: "eng_hate_slurs",
          pattern: /\b(n+[i!1*]+g+g+[e3a*]+r*|f+[a4@*]+g+g+[o0*]+t+|r+[e3*]+t+[a4@*]+r+d+)\b/i,
          category: "english",
          baseTerm: "slur",
          severity: 1
        },
        // --------------------------------------------------------------------
        // 3. MULTILINGUAL (Spanish, French, German, Russian, etc.)
        // --------------------------------------------------------------------
        // Spanish: puta, hijo de puta, mierda, pendejo, cabrón, maricón, coño
        {
          id: "ml_spanish",
          pattern: /\b(p+[u*]+t+[a4@*]+|h+i+j+[o0]+\s+d+e+\s+p+u+t+a|m+i+e+r+d+a|p+e+n+d+e+j+[o0a4]+|c+a+b+r+[o0]+n+|m+a+r+i+c+[o0]+n+|c+[o0]+n+[o0]+)\b/i,
          category: "multilingual",
          baseTerm: "spanish_abuse",
          severity: 0.92
        },
        // French: putain, merde, salope, connard, fils de pute, encule
        {
          id: "ml_french",
          pattern: /\b(p+u+t+a+i+n+|m+e+r+d+e+|s+a+l+[o0*]+p+e+|c+[o0*]+n*[*_.\-\s#@$%]*n*a+r+d+|f+i+l+s+\s+d+e+\s+p+u+t+e+|e+n+c+u+l+e+)\b/i,
          category: "multilingual",
          baseTerm: "french_abuse",
          severity: 0.92
        },
        // German: arschloch, hurensohn, fotze, scheisse, wichser, schlampe
        {
          id: "ml_german",
          pattern: /\b(a+r+s+c+h+l+[o0]+c+h+|h+u+r+e+n+s+[o0]+h+n+|f+[o0]+t+z+e+|s+c+h+e+i+s+s+e+|w+i+c+h+s+e+r+|s+c+h+l+a+m+p+e+)\b/i,
          category: "multilingual",
          baseTerm: "german_abuse",
          severity: 0.92
        },
        // Russian transliterated: suka, blyat, huy, pizda, pizdec, nahuy
        {
          id: "ml_russian_translit",
          pattern: /\b(s+u+k+a+|b+l+y+a+t+|h+u+y+|p+i+z+d+a+|p+i+z+d+e+c+|n+a+h+u+y+)\b/i,
          category: "multilingual",
          baseTerm: "russian_abuse",
          severity: 0.94
        }
      );
      this.devanagariRules.push(
        // मादरचोद, मादर***, मा*ार
        {
          id: "dev_madarchod",
          pattern: /मा(?:दर|[\*x#_.\-\s]+)?(?:चोद|[\*x#_.\-\s]+)?/,
          category: "hindi_indic",
          baseTerm: "\u092E\u093E\u0926\u0930\u091A\u094B\u0926",
          severity: 0.99
        },
        // बहनचोद, भेंचोद
        {
          id: "dev_bhenchod",
          pattern: /(?:बहन|भें|भेन)(?:[\*x#_.\-\s]+)?चोद/,
          category: "hindi_indic",
          baseTerm: "\u092C\u0939\u0928\u091A\u094B\u0926",
          severity: 0.99
        },
        // चूतिया, चू**या
        {
          id: "dev_chutiya",
          pattern: /चू(?:ति|[\*x#_.\-\s]+)या/,
          category: "hindi_indic",
          baseTerm: "\u091A\u0942\u0924\u093F\u092F\u093E",
          severity: 0.98
        },
        // भोसड़ीके, भोसड़ी, भोसडीके
        {
          id: "dev_bhosdike",
          pattern: /भोस[ड़ड]ी(?:के)?/,
          category: "hindi_indic",
          baseTerm: "\u092D\u094B\u0938\u0921\u093C\u0940\u0915\u0947",
          severity: 0.99
        },
        // गांडू, गाँडू, गांड
        {
          id: "dev_gandu",
          pattern: /गा[ंँ]?डू/,
          category: "hindi_indic",
          baseTerm: "\u0917\u093E\u0902\u0921\u0942",
          severity: 0.98
        },
        // हरामी, हरामखोर
        {
          id: "dev_harami",
          pattern: /हरामी|हरामखोर/,
          category: "hindi_indic",
          baseTerm: "\u0939\u0930\u093E\u092E\u0940",
          severity: 0.95
        },
        // रंडी, रांड
        {
          id: "dev_randi",
          pattern: /रंडी|रांड/,
          category: "hindi_indic",
          baseTerm: "\u0930\u0902\u0921\u0940",
          severity: 0.98
        },
        // लौड़ा, लौड़े, लंड
        {
          id: "dev_lauda",
          pattern: /लौ[ड़ड][ाे]|ल[ंन्]ड/,
          category: "hindi_indic",
          baseTerm: "\u0932\u094C\u0921\u093C\u093E/\u0932\u0902\u0921",
          severity: 0.98
        },
        // कुतिया, कुत्ता
        {
          id: "dev_kutiya",
          pattern: /कुतिया|कमीने/,
          category: "hindi_indic",
          baseTerm: "\u0915\u0941\u0924\u093F\u092F\u093E",
          severity: 0.9
        }
      );
      this.rules.push({
        id: "arabic_script_abuse",
        pattern: /(?:شرموطة|ابن الكلب|منيك|قحبة|عرص|كس امك)/,
        category: "multilingual",
        baseTerm: "arabic_abuse",
        severity: 0.98
      });
      this.rules.push({
        id: "cyrillic_script_abuse",
        pattern: /(?:сука|блять|хуй|пизда|пиздос|нахуй|ебать)/i,
        category: "multilingual",
        baseTerm: "cyrillic_abuse",
        severity: 0.98
      });
    }
    /**
     * Adds custom user-defined blocked terms
     */
    addBlockedTerms(terms) {
      for (const t of terms) {
        if (t.trim()) {
          this.exactBlockedTerms.add(t.trim().toLowerCase());
        }
      }
    }
    /**
     * Adds user-defined exempt terms (safe words)
     */
    addExemptTerms(terms) {
      for (const t of terms) {
        if (t.trim()) {
          this.exemptTerms.add(t.trim().toLowerCase());
        }
      }
    }
    /**
     * Evaluates text for abuse across all languages and obfuscated structures.
     * Runs in microseconds without network or GPU dependency.
     */
    detectAbuse(text, options = {}) {
      if (!text || !text.trim()) {
        return {
          isAbusive: false,
          confidence: 0,
          matchedTerms: [],
          source: "pattern_obfuscated",
          explanation: "Empty or whitespace text."
        };
      }
      const raw = text.trim();
      const normalized = ObfuscationNormalizer.normalize(raw);
      const compact = ObfuscationNormalizer.stripSeparators(normalized);
      if (options.exemptWords) {
        for (const ex of options.exemptWords) {
          if (normalized.includes(ex.toLowerCase())) {
            return {
              isAbusive: false,
              confidence: 0,
              matchedTerms: [],
              source: "pattern_obfuscated",
              explanation: `Exempted by custom user safe rule: "${ex}".`
            };
          }
        }
      }
      const matchedTerms = [];
      let maxSeverity = 0;
      if (options.customWords) {
        for (const w of options.customWords) {
          const lowerW = w.toLowerCase().trim();
          if (lowerW && (normalized.includes(lowerW) || compact.includes(lowerW))) {
            matchedTerms.push(w);
            maxSeverity = Math.max(maxSeverity, 1);
          }
        }
      }
      for (const rule of this.devanagariRules) {
        if (rule.pattern.test(raw)) {
          matchedTerms.push(rule.baseTerm);
          maxSeverity = Math.max(maxSeverity, rule.severity);
        }
      }
      const tokens = normalized.split(/[^a-z0-9]+/i).filter(Boolean);
      const hasSafeWord = tokens.some((t) => SAFE_WORDS.has(t));
      for (const rule of this.rules) {
        const matchRaw = rule.pattern.test(raw);
        const matchNorm = rule.pattern.test(normalized);
        if (matchRaw || matchNorm) {
          if (hasSafeWord && this.isFalsePositiveInSafeWord(raw, normalized, rule)) {
            continue;
          }
          matchedTerms.push(rule.baseTerm);
          maxSeverity = Math.max(maxSeverity, rule.severity);
        }
      }
      if (matchedTerms.length === 0 && options.obfuscationDefense !== false) {
        const compactIndicRoots = ["madarchod", "behenchod", "bhenchod", "bhosdike", "chutiya", "randi"];
        for (const root of compactIndicRoots) {
          if (compact.includes(root)) {
            matchedTerms.push(root);
            maxSeverity = Math.max(maxSeverity, 0.97);
            break;
          }
        }
      }
      const isAbusive = matchedTerms.length > 0;
      const confidence = isAbusive ? Math.min(1, maxSeverity) : 0;
      return {
        isAbusive,
        confidence,
        matchedTerms: Array.from(new Set(matchedTerms)),
        normalizedSample: normalized.length > 80 ? normalized.slice(0, 80) + "..." : normalized,
        source: isAbusive ? "pattern_obfuscated" : "multilingual_lexicon",
        explanation: isAbusive ? `Blocked abusive content (${matchedTerms.join(", ")}) with ${(confidence * 100).toFixed(0)}% confidence.` : "No abusive language or obfuscated profanity detected."
      };
    }
    /**
     * Helper to verify if an apparent match is actually part of an innocent safe word
     * e.g. "mature" matching "ma*ar", "assistant" matching "ass", etc.
     */
    isFalsePositiveInSafeWord(raw, normalized, rule) {
      const rawLower = raw.toLowerCase();
      for (const safe of SAFE_WORDS) {
        if (rawLower.includes(safe) || normalized.includes(safe)) {
          if (rule.baseTerm === "ma*ar" && (normalized.includes("mature") || normalized.includes("matter") || normalized.includes("match") || normalized.includes("matrix"))) {
            if (!/\bma[\s\*._\-\#@\$]+ar\b/i.test(normalized) && !/\bmadar/i.test(normalized)) {
              return true;
            }
          }
        }
      }
      return false;
    }
  };

  // src/engine/adult-detector.ts
  var ADULT_DOMAINS = [
    "onlyfans.com",
    "fansly.com",
    "pornhub.com",
    "xvideos.com",
    "xnxx.com",
    "redtube.com",
    "youporn.com",
    "brazzers.com",
    "chaturbate.com",
    "camsoda.com",
    "stripchat.com",
    "livejasmin.com",
    "manyvids.com",
    "adultfriendfinder.com",
    "eporner.com",
    "spankbang.com",
    "tube8.com",
    "beeg.com",
    "tnaflix.com",
    "xhamster.com",
    "erome.com",
    "bonga.com",
    "myfreecams.com"
  ];
  var BOT_SOLICITATION_REGEXES = [
    /\b(?:nudes?|tapes?|sex\s*tapes?|spicy\s*content|exclusive\s*content)\s+in\s+(?:bio|my\s*bio|profile)\b/i,
    /\b(?:check|tap|click)\s+(?:the|my)?\s*link\s+in\s+(?:bio|profile)\s+for\s+(?:nudes?|spicy|exclusive|tapes?)\b/i,
    /\b(?:selling|offering)\s+(?:nudes?|content|vids?)\s+(?:dm|snapchat|telegram)\b/i,
    /\b(?:selling\s+(?:my\s+)?(?:exclusive\s+)?(?:nudes?|tapes?))\b/i,
    /\b(?:link\s+in\s+(?:bio|profile))\b[\s\S]{0,30}\b(?:nudes?|tapes?|onlyfans|spicy)/i,
    /\b(?:nudes?|tapes?|onlyfans|spicy)\b[\s\S]{0,30}\b(?:link\s+in\s+(?:bio|profile))/i,
    /\b(?:watch|see)\s+(?:full|leaked|hot)\s+sex\s+video\b/i,
    /\b(?:free|cheap)\s+onlyfans\s+(?:sub|link|page|account)\b/i,
    /\bdm\s+me\s+for\s+(?:nudes?|exclusive\s*content|menu)\b/i,
    /\bexclusive\s+(?:18\+|nsfw|nude)\s+content\s+below\b/i,
    /\blink\s+in\s+bio\s+(?:🔞|💦|🍒|🍑)/i
  ];
  var EXPLICIT_ADULT_TERMS = [
    // --- English Explicit Terms ---
    { pattern: /\b(?:hardcore\s+)?porn(?:o|ography)?\b/i, tag: "porn" },
    { pattern: /\bxxx\s+(?:videos?|movies?|content|pics?)\b/i, tag: "xxx" },
    { pattern: /\b(?:blowjob|creampie|cumshot|gangbang|deepthroat|threesome\s+sex)\b/i, tag: "explicit_act" },
    { pattern: /\b(?:sex\s*tapes?|leaked\s*tapes?|nude\s*leaks?|free\s*nudes?|exclusive\s*nudes?)\b/i, tag: "leaked_nudes" },
    { pattern: /\b(?:explicit\s+sex|anal\s+sex|masturbation\s+video)\b/i, tag: "explicit_sex" },
    { pattern: /\bhentai\b/i, tag: "hentai" },
    { pattern: /\b(?:milf\s+sex|stepmom\s+sex|stepsister\s+sex)\b/i, tag: "porn_category" },
    { pattern: /\bnsfw\s+(?:18\+|content|leak|nudes?)\b/i, tag: "nsfw_marker" },
    // --- Obfuscated Adult Structures (e.g. p*rn, p0rn, n*des, s*x tape) ---
    { pattern: /\bp[\*_\.\-0]+r+n\b/i, tag: "obfuscated_porn" },
    { pattern: /\bpr0n\b/i, tag: "obfuscated_porn" },
    { pattern: /\bn[\*_\.\-]+d+e+s?\b/i, tag: "obfuscated_nudes" },
    { pattern: /\bs[\*_\.\-3]+x\s+(?:video|tape|movie|clips?)\b/i, tag: "obfuscated_sex_video" },
    // --- Hindi / Hinglish Adult Content ---
    { pattern: /पोर्न(?:ो)?/i, tag: "hindi_porn" },
    { pattern: /ब्लू\s*फिल्म/i, tag: "hindi_blue_film" },
    { pattern: /सेक्स\s*वीडियो/i, tag: "hindi_sex_video" },
    { pattern: /नंगी\s*(?:फोटो|तस्वीर|वीडियो)/i, tag: "hindi_nude_photo" },
    { pattern: /हस्तमैथुन\s*(?:वीडियो|फोटो)/i, tag: "hindi_masturbation" },
    { pattern: /\b(?:chudai\s*video|choda\s*chodi\s*video)\b/i, tag: "hinglish_chudai_video" },
    { pattern: /\b(?:nangi\s*(?:photo|video|tasveer)|desi\s*bhabhi\s*(?:viral\s*video|sex))\b/i, tag: "hinglish_nude_media" },
    { pattern: /\b(?:blue\s*film|desi\s*mms\s*leak|chut\s*ki\s*photo|gaand\s*ki\s*photo)\b/i, tag: "hinglish_adult_content" },
    { pattern: /\bsax\s+sux\s+ki\s+video\b/i, tag: "hinglish_sax_video" },
    // --- Spanish Adult Content ---
    { pattern: /\b(?:pelicula\s+porno|videos?\s+porno(?:graficos?)?|chicas\s+desnudas)\b/i, tag: "spanish_porn" },
    { pattern: /\b(?:sexo\s+explicito|pack\s+de\s+(?:fotos\s+desnudas|nudes)|onlyfans\s+gratis)\b/i, tag: "spanish_adult_pack" },
    // --- French Adult Content ---
    { pattern: /\b(?:film\s+porno(?:graphique)?|sexe\s+explicite|photos?\s+nues?|video\s+de\s+cul)\b/i, tag: "french_porn" },
    // --- German Adult Content ---
    { pattern: /\b(?:pornofilm|sexfilm|nacktfotos?|gratis\s+pornos?)\b/i, tag: "german_porn" },
    // --- Russian Adult Content ---
    { pattern: /(?:порно(?:фильм|ролик|видео)?|порнуха|голые\s+фото|слив\s+онлифанс|интимки|секс\s+видео)/i, tag: "russian_porn" },
    // --- Arabic Adult Content ---
    { pattern: /(?:بورنو|افلام\s+سكس|افلام\s+اباحية|سكس\s+عربي|مقاطع\s+جنسية)/i, tag: "arabic_porn" }
  ];
  var BENIGN_CONTEXT_PATTERNS = [
    /\b(?:sexist|sexism|sexual\s+harassment|sexual\s+assault|sexual\s+misconduct)\b/i,
    /\b(?:middlesex|essex|sussex)\b/i,
    /\b(?:adult\s+(?:education|literacy|learning|training|care|health|guardian))\b/i,
    /\b(?:older\s+adult|young\s+adult|adult\s+population|adult\s+dose)\b/i,
    /\b(?:nude\s+(?:lip|lipstick|shade|makeup|palette|nails?|shoes?|dress))\b/i,
    /\b(?:reproductive\s+health|anatomy\s+class|biology\s+textbook|medical\s+documentary)\b/i
  ];
  var AdultContentDetector = class {
    /**
     * Evaluates a post, comment, or text string for adult/pornographic content.
     */
    detectAdultContent(input) {
      const isPost = typeof input !== "string";
      const text = isPost ? input.text : input;
      const post = isPost ? input : null;
      if (post && post.element) {
        const platformNsfw = this.checkPlatformNsfwMarkers(post.element);
        if (platformNsfw) {
          return {
            isAdult: true,
            confidence: 1,
            matchedPatterns: [platformNsfw],
            reason: "platform_nsfw_flag",
            explanation: `Blocked by content safety: Post is flagged as NSFW (${platformNsfw}).`
          };
        }
      }
      const adultDomain = this.checkAdultDomains(text, post);
      if (adultDomain) {
        return {
          isAdult: true,
          confidence: 0.98,
          matchedPatterns: [adultDomain],
          reason: "adult_domain",
          explanation: `Blocked by content safety: Contains link or reference to adult platform (${adultDomain}).`
        };
      }
      if (this.isBenignContext(text)) {
        return {
          isAdult: false,
          confidence: 0.05,
          matchedPatterns: [],
          reason: "explicit_lexicon",
          explanation: "Preserved: Recognized as educational, medical, cosmetic, or constructive context."
        };
      }
      for (const regex of BOT_SOLICITATION_REGEXES) {
        if (regex.test(text)) {
          return {
            isAdult: true,
            confidence: 0.95,
            matchedPatterns: [regex.source],
            reason: "bot_solicitation",
            explanation: "Blocked by content safety: Identified adult solicitation or porn bot signature."
          };
        }
      }
      const matchedTerms = [];
      for (const term of EXPLICIT_ADULT_TERMS) {
        if (term.pattern.test(text)) {
          matchedTerms.push(term.tag);
        }
      }
      if (matchedTerms.length > 0) {
        return {
          isAdult: true,
          confidence: 0.95,
          matchedPatterns: matchedTerms,
          reason: "explicit_lexicon",
          explanation: `Blocked by content safety: Identified explicit adult content (${matchedTerms.join(", ")}).`
        };
      }
      const normalized = ObfuscationNormalizer.normalize(text);
      if (normalized !== text.toLowerCase()) {
        for (const term of EXPLICIT_ADULT_TERMS) {
          if (term.pattern.test(normalized)) {
            return {
              isAdult: true,
              confidence: 0.92,
              matchedPatterns: [term.tag],
              reason: "obfuscated_adult",
              explanation: `Blocked by content safety: Identified obfuscated adult terms (${term.tag}).`
            };
          }
        }
      }
      if (post && post.hashtags && post.hashtags.length > 0) {
        const adultHashtag = this.checkAdultHashtags(post.hashtags);
        if (adultHashtag) {
          return {
            isAdult: true,
            confidence: 0.95,
            matchedPatterns: [adultHashtag],
            reason: "explicit_lexicon",
            explanation: `Blocked by content safety: Explicit adult hashtag (#${adultHashtag}).`
          };
        }
      }
      return {
        isAdult: false,
        confidence: 0,
        matchedPatterns: [],
        reason: "explicit_lexicon",
        explanation: "Content satisfies intrinsic content safety standards."
      };
    }
    /**
     * Inspects element attributes, classes, and badge text for platform NSFW markers.
     */
    checkPlatformNsfwMarkers(element) {
      if (!element) return null;
      if (typeof element.hasAttribute === "function" && element.hasAttribute("nsfw")) {
        return "attribute:nsfw";
      }
      if (typeof element.getAttribute === "function") {
        const nsfwAttr = element.getAttribute("nsfw");
        if (nsfwAttr === "true") return "attribute:nsfw";
        const dataNsfw = element.getAttribute("data-nsfw") || element.getAttribute("data-is-nsfw");
        if (dataNsfw === "true") return "attribute:data-nsfw";
      }
      const className = element.className || "";
      if (typeof className === "string") {
        if (/\b(?:nsfw|is-nsfw|post-nsfw)\b/i.test(className)) {
          return "class:nsfw";
        }
      }
      if (typeof element.querySelectorAll === "function") {
        const badges = element.querySelectorAll("span, div, a");
        for (let i = 0; i < badges.length; i++) {
          const badgeText = badges[i].textContent?.trim().toLowerCase();
          if (badgeText === "nsfw" || badgeText === "18+" || badgeText === "adult content") {
            return `badge:${badgeText}`;
          }
        }
      }
      return null;
    }
    /**
     * Checks if content contains known adult domains.
     */
    checkAdultDomains(text, post) {
      const textLower = text.toLowerCase();
      for (const domain of ADULT_DOMAINS) {
        if (textLower.includes(domain)) {
          return domain;
        }
      }
      if (post) {
        if (post.url) {
          const urlLower = post.url.toLowerCase();
          for (const domain of ADULT_DOMAINS) {
            if (urlLower.includes(domain)) {
              return domain;
            }
          }
        }
        if (post.element && typeof post.element.querySelectorAll === "function") {
          const anchors = post.element.querySelectorAll("a[href]");
          for (let i = 0; i < anchors.length; i++) {
            const href = (anchors[i].getAttribute?.("href") || "").toLowerCase();
            for (const domain of ADULT_DOMAINS) {
              if (href.includes(domain)) {
                return domain;
              }
            }
          }
        }
      }
      return null;
    }
    /**
     * Inspects hashtags for adult tags.
     */
    checkAdultHashtags(hashtags) {
      const adultTags = /* @__PURE__ */ new Set([
        "nsfw",
        "porn",
        "porno",
        "xxx",
        "hentai",
        "onlyfans",
        "fansly",
        "nudes",
        "nude",
        "adultcontent",
        "erotic",
        "sex",
        "boobs",
        "camgirl",
        "milf",
        "leaks",
        "hotgirl",
        "18plus"
      ]);
      for (const tag of hashtags) {
        const clean = tag.replace(/^#/, "").toLowerCase();
        if (adultTags.has(clean)) {
          return clean;
        }
      }
      return null;
    }
    /**
     * Checks if text matches benign contexts (Scunthorpe prevention).
     */
    isBenignContext(text) {
      for (const pattern of BENIGN_CONTEXT_PATTERNS) {
        if (pattern.test(text)) {
          return true;
        }
      }
      return false;
    }
  };

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

  // src/engine/policy.ts
  var PolicyEngine = class {
    evidenceStore;
    abuseDetector = new AbuseDetector();
    adultDetector = new AdultContentDetector();
    taxonomyMap = /* @__PURE__ */ new Map();
    childToAncestorsMap = /* @__PURE__ */ new Map();
    constructor(evidenceStore) {
      this.evidenceStore = evidenceStore || new EvidenceStore();
      this.buildTaxonomyMaps();
    }
    buildTaxonomyMaps() {
      const topics = topics_taxonomy_default;
      for (const topic of topics) {
        this.taxonomyMap.set(topic.id, topic);
      }
      for (const topic of topics) {
        const ancestors = /* @__PURE__ */ new Set();
        let currentParent = topic.parent;
        while (currentParent) {
          ancestors.add(currentParent);
          const parentTopic = this.taxonomyMap.get(currentParent);
          currentParent = parentTopic?.parent;
        }
        this.childToAncestorsMap.set(topic.id, ancestors);
      }
    }
    /**
     * Deterministic Policy Evaluation Order:
     * 1. Global or per-site pause -> ALLOW
     * 2. User Reveal-once -> ALLOW
     * 3. Explicit keyword exclusion -> HIDE
     * 4. Explicit creator block -> HIDE
     * 5. Misinformation check (Contradicted claim with evidence) -> HIDE
     * 6. Creator allowlist bypass -> ALLOW
     * 7. Topic matching rules (ANY vs ALL mode, hierarchical match, balanced vs strict)
     */
    evaluate(input, settings) {
      const { post, hostname, detectedTopics, revealedItemIds } = input;
      const now = Date.now();
      const contentHash = this.computeSimpleHash(post.text + (post.author?.handle || ""));
      const baseRecord = {
        itemId: post.id,
        itemUrl: post.url,
        contentHash,
        platform: hostname,
        timestamp: now,
        matchedTopics: detectedTopics,
        revealedByUser: revealedItemIds?.has(post.id) || false
      };
      if (!settings.enabled) {
        return {
          ...baseRecord,
          action: "ALLOW",
          winningRule: "rule/global_disabled",
          explanation: "Filtering paused globally."
        };
      }
      if (settings.pausedUntil && settings.pausedUntil > now) {
        return {
          ...baseRecord,
          action: "ALLOW",
          winningRule: "rule/temporary_pause",
          explanation: `Filtering temporarily paused until ${new Date(settings.pausedUntil).toLocaleTimeString()}.`
        };
      }
      if (settings.pausedSites && settings.pausedSites[hostname]) {
        return {
          ...baseRecord,
          action: "ALLOW",
          winningRule: "rule/site_paused",
          explanation: `Filtering paused for ${hostname}.`
        };
      }
      if (revealedItemIds?.has(post.id)) {
        return {
          ...baseRecord,
          action: "ALLOW",
          winningRule: "rule/user_reveal_once",
          explanation: "Revealed by user request for this specific item."
        };
      }
      const textToMatch = (post.text + " " + (post.hashtags || []).join(" ")).normalize("NFKC");
      for (const rule of settings.keywordRules || []) {
        if (rule.type === "exclude") {
          if (this.matchesKeyword(textToMatch, rule.phrase, rule.matchMode, rule.caseSensitive)) {
            return {
              ...baseRecord,
              action: "HIDE",
              winningRule: `rule/keyword_exclude:${rule.phrase}`,
              explanation: `Hidden by excluded keyword rule: "${rule.phrase}".`
            };
          }
        }
      }
      const authorHandle = post.author?.handle?.toLowerCase().replace(/^@/, "");
      const authorName = post.author?.name?.toLowerCase();
      for (const cRule of settings.creatorRules || []) {
        if (cRule.action === "block") {
          const target = cRule.handleOrName.toLowerCase().replace(/^@/, "");
          if (authorHandle && authorHandle === target || authorName && authorName.includes(target)) {
            return {
              ...baseRecord,
              action: "HIDE",
              winningRule: `rule/creator_block:${cRule.handleOrName}`,
              explanation: `Hidden by creator block rule: "${cRule.handleOrName}".`
            };
          }
        }
      }
      let vResult;
      if (settings.misinformationEnabled || settings.indiaPresetEnabled) {
        vResult = this.evidenceStore.verifyContent(post.text, {
          indiaPresetOnly: !settings.misinformationEnabled && settings.indiaPresetEnabled
        });
        if (vResult.status === "Contradicted" && vResult.confidence >= (settings.minConfidenceThreshold || 0.75)) {
          return {
            ...baseRecord,
            action: "HIDE",
            winningRule: "rule/misinformation_contradicted",
            explanation: vResult.explanation,
            claimAssessment: {
              claimText: vResult.claimText,
              status: vResult.status,
              evidence: vResult.evidence
            }
          };
        }
      }
      if (settings.abuseFilterEnabled !== false) {
        const abuseAssessment = this.abuseDetector.detectAbuse(textToMatch, {
          strictness: settings.abuseStrictness || "balanced",
          obfuscationDefense: settings.obfuscationDefense !== false,
          customWords: settings.customAbuseWords,
          exemptWords: settings.exemptAbuseWords
        });
        if (abuseAssessment.isAbusive) {
          return {
            ...baseRecord,
            action: "HIDE",
            winningRule: `rule/abuse_filter:${abuseAssessment.matchedTerms.join(",")}`,
            explanation: abuseAssessment.explanation
          };
        }
      }
      const adultAssessment = this.adultDetector.detectAdultContent(post);
      if (adultAssessment.isAdult) {
        return {
          ...baseRecord,
          action: "HIDE",
          winningRule: `rule/safety_adult_content:${adultAssessment.reason}`,
          explanation: adultAssessment.explanation
        };
      }
      for (const cRule of settings.creatorRules || []) {
        if (cRule.action === "allow") {
          const target = cRule.handleOrName.toLowerCase().replace(/^@/, "");
          if (authorHandle && authorHandle === target || authorName && authorName.includes(target)) {
            return {
              ...baseRecord,
              action: "ALLOW",
              winningRule: `rule/creator_allowed:${cRule.handleOrName}`,
              explanation: `Allowed creator override for "${cRule.handleOrName}" (bypasses topic filters).`
            };
          }
        }
      }
      const includeRules = (settings.keywordRules || []).filter((r) => r.type === "include");
      if (includeRules.length > 0) {
        const anyIncludeHit = includeRules.some(
          (rule) => this.matchesKeyword(textToMatch, rule.phrase, rule.matchMode, rule.caseSensitive)
        );
        if (!anyIncludeHit) {
          return {
            ...baseRecord,
            action: "HIDE",
            winningRule: "rule/keyword_include_required",
            explanation: "Hidden: Does not contain required included keywords."
          };
        }
      }
      const selected = settings.selectedTopics || [];
      if (selected.length === 0) {
        return {
          ...baseRecord,
          action: "ALLOW",
          winningRule: "rule/topic_no_restriction",
          explanation: "Allowed: No topic filters active."
        };
      }
      const effectiveTopics = new Set(detectedTopics);
      for (const tId of detectedTopics) {
        const ancestors = this.childToAncestorsMap.get(tId);
        if (ancestors) {
          for (const anc of ancestors) {
            effectiveTopics.add(anc);
          }
        }
      }
      if (settings.topicMatchMode === "ALL") {
        const matchesAll = selected.every((selTopic) => effectiveTopics.has(selTopic));
        if (matchesAll) {
          return {
            ...baseRecord,
            action: "ALLOW",
            winningRule: "rule/topic_match_all",
            explanation: `Matches all selected topics: ${selected.join(", ")}.`
          };
        } else {
          const missing = selected.filter((t) => !effectiveTopics.has(t));
          return {
            ...baseRecord,
            action: "HIDE",
            winningRule: "rule/topic_missing_all",
            explanation: `Hidden: Does not match all required topics (missing: ${missing.join(", ")}).`
          };
        }
      } else {
        const matched = selected.filter((selTopic) => effectiveTopics.has(selTopic));
        if (matched.length > 0) {
          return {
            ...baseRecord,
            action: "ALLOW",
            winningRule: "rule/topic_match_any",
            explanation: `Matches selected topic(s): ${matched.join(", ")}.`
          };
        }
        if (detectedTopics.length === 0 && settings.strictness === "balanced") {
          return {
            ...baseRecord,
            action: "ALLOW",
            winningRule: "rule/balanced_uncertain_visible",
            explanation: "Allowed under balanced filtering: Topic not yet established."
          };
        }
        return {
          ...baseRecord,
          action: "HIDE",
          winningRule: "rule/topic_nonmatch",
          explanation: "Hidden: Content does not match your selected topics."
        };
      }
    }
    matchesKeyword(text, phrase, mode, caseSensitive = false) {
      const haystack = caseSensitive ? text : text.toLowerCase();
      const needle = caseSensitive ? phrase : phrase.toLowerCase();
      if (mode === "phrase") {
        return haystack.includes(needle);
      }
      if (mode === "whole_word") {
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(^|\\W)${escaped}(\\W|$)`, caseSensitive ? "" : "i");
        return regex.test(haystack);
      }
      if (mode === "regex") {
        try {
          if (needle.length > 50 || /(.*){2,}/.test(needle)) {
            return haystack.includes(needle);
          }
          const regex = new RegExp(needle, caseSensitive ? "" : "i");
          return regex.test(haystack);
        } catch {
          return haystack.includes(needle);
        }
      }
      return false;
    }
    computeSimpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash).toString(16);
    }
  };

  // src/content/video-skipper.ts
  var VideoSkipper = class {
    consecutiveSkips = 0;
    maxConsecutiveSkips;
    skipDelayMs;
    isAdvancing = false;
    emptyStateOverlay = null;
    onLimitReached;
    constructor(options = {}) {
      this.maxConsecutiveSkips = options.maxConsecutiveSkips ?? 8;
      this.skipDelayMs = options.skipDelayMs ?? 180;
      this.onLimitReached = options.onLimitReached;
    }
    resetStreak() {
      this.consecutiveSkips = 0;
      this.removeEmptyState();
    }
    getConsecutiveSkips() {
      return this.consecutiveSkips;
    }
    /**
     * Smoothly skips a blocked video in the vertical carousel
     */
    async handleBlockedVideo(element, adapter, reason) {
      if (this.isAdvancing) return false;
      if (this.consecutiveSkips >= this.maxConsecutiveSkips) {
        this.showEmptyState(element, reason);
        if (this.onLimitReached) this.onLimitReached();
        return false;
      }
      this.isAdvancing = true;
      this.consecutiveSkips++;
      try {
        adapter.pauseMedia?.(element);
        await new Promise((r) => setTimeout(r, this.skipDelayMs));
        let advanced = false;
        if (adapter.advanceShort) {
          advanced = await adapter.advanceShort(element);
        }
        return advanced;
      } finally {
        this.isAdvancing = false;
      }
    }
    /**
     * Renders a clean in-feed overlay when consecutive skip limit is reached
     */
    showEmptyState(container, reason) {
      this.removeEmptyState();
      const doc = container.ownerDocument || (typeof document !== "undefined" ? document : null);
      if (!doc) return;
      const overlay = doc.createElement("div");
      overlay.className = "laya-empty-feed-card";
      overlay.setAttribute("role", "status");
      overlay.innerHTML = `
      <div class="laya-empty-inner">
        <div class="laya-empty-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
        </div>
        <h3 class="laya-empty-title">No matching content is currently available</h3>
        <p class="laya-empty-desc">Reached consecutive filter limit (${this.consecutiveSkips} items blocked). Last reason: ${reason}</p>
        <div class="laya-empty-actions">
          <button type="button" class="laya-btn laya-btn-reveal" id="laya-btn-reveal-current">Reveal this item</button>
          <button type="button" class="laya-btn laya-btn-pause" id="laya-btn-pause-site">Pause 1 hour</button>
          <button type="button" class="laya-btn laya-btn-settings" id="laya-btn-change-filters">Change filters</button>
        </div>
      </div>
    `;
      overlay.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.95);
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 24px;
      text-align: center;
      font-family: system-ui, -apple-system, sans-serif;
    `;
      container.style.position = "relative";
      container.appendChild(overlay);
      this.emptyStateOverlay = overlay;
      overlay.querySelector("#laya-btn-reveal-current")?.addEventListener("click", () => {
        this.resetStreak();
        overlay.remove();
      });
      overlay.querySelector("#laya-btn-pause-site")?.addEventListener("click", () => {
        if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: "PAUSE_FILTERING", durationMs: 36e5 });
        }
        this.resetStreak();
        overlay.remove();
      });
      overlay.querySelector("#laya-btn-change-filters")?.addEventListener("click", () => {
        if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        }
      });
    }
    removeEmptyState() {
      if (this.emptyStateOverlay) {
        this.emptyStateOverlay.remove();
        this.emptyStateOverlay = null;
      }
    }
  };

  // src/content/feed-controller.ts
  var FeedController = class {
    adapter;
    settings;
    policyEngine;
    videoSkipper;
    items = /* @__PURE__ */ new Map();
    elementToId = /* @__PURE__ */ new WeakMap();
    mutationObserver = null;
    intersectionObserver = null;
    revealedItemIds = /* @__PURE__ */ new Set();
    isProcessing = false;
    queue = [];
    constructor(adapter, settings, policyEngine) {
      this.adapter = adapter;
      this.settings = settings;
      this.policyEngine = policyEngine || new PolicyEngine();
      this.videoSkipper = new VideoSkipper({
        maxConsecutiveSkips: settings.maxConsecutiveSkips || 8
      });
    }
    start() {
      this.initIntersectionObserver();
      this.initMutationObserver();
      this.scanFeed(document.body);
    }
    stop() {
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
        this.intersectionObserver = null;
      }
      this.restoreAllPosts();
      this.items.clear();
    }
    updateSettings(newSettings) {
      this.settings = newSettings;
      this.reEvaluateAll();
    }
    revealItem(id) {
      this.revealedItemIds.add(id);
      const item = this.items.get(id);
      if (item) {
        this.adapter.restorePost(item.element);
        item.state = "Allowed";
      }
    }
    restoreAllPosts() {
      for (const item of this.items.values()) {
        this.adapter.restorePost(item.element);
        item.state = "Allowed";
      }
    }
    initIntersectionObserver() {
      if (typeof IntersectionObserver === "undefined") return;
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const id = this.elementToId.get(entry.target);
              if (id) {
                const item = this.items.get(id);
                if (item && item.state === "Discovered") {
                  this.enqueueItem(id);
                }
              }
            }
          }
        },
        { rootMargin: "300px" }
        // Near-visible prefetch lookahead
      );
    }
    initMutationObserver() {
      if (typeof MutationObserver === "undefined") return;
      this.mutationObserver = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const mut of mutations) {
          if (mut.type === "childList" && mut.addedNodes.length > 0) {
            for (let i = 0; i < mut.addedNodes.length; i++) {
              const node = mut.addedNodes[i];
              if (node instanceof HTMLElement && !node.classList.contains("laya-hidden-post")) {
                shouldScan = true;
                break;
              }
            }
          }
        }
        if (shouldScan) {
          this.scanFeed(document.body);
        }
      });
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    scanFeed(root) {
      const containers = this.adapter.findPostContainers(root);
      for (const el of containers) {
        if (this.elementToId.has(el)) continue;
        const post = this.adapter.extractContent(el);
        if (!post) continue;
        const item = {
          id: post.id,
          element: el,
          state: "Discovered",
          post,
          contentHash: post.id + post.text.length
        };
        this.items.set(post.id, item);
        this.elementToId.set(el, post.id);
        if (this.intersectionObserver) {
          this.intersectionObserver.observe(el);
        } else {
          this.enqueueItem(post.id);
        }
      }
    }
    enqueueItem(id) {
      const item = this.items.get(id);
      if (!item || item.state !== "Discovered") return;
      item.state = "Queued";
      this.queue.push(id);
      this.processQueue();
    }
    async processQueue() {
      if (this.isProcessing || this.queue.length === 0) return;
      this.isProcessing = true;
      while (this.queue.length > 0) {
        const id = this.queue.shift();
        if (!id) continue;
        const item = this.items.get(id);
        if (!item) continue;
        item.state = "Checking";
        await this.evaluateItem(item);
      }
      this.isProcessing = false;
    }
    async evaluateItem(item) {
      const detectedTopics = this.detectBasicTopics(item.post.text);
      const decision = this.policyEngine.evaluate(
        {
          post: item.post,
          hostname: window.location.hostname,
          detectedTopics,
          revealedItemIds: this.revealedItemIds
        },
        this.settings
      );
      item.decision = decision;
      const feedType = this.adapter.getFeedType(new URL(window.location.href));
      if (decision.action === "HIDE") {
        item.state = "Hidden";
        if (feedType === "shorts") {
          await this.videoSkipper.handleBlockedVideo(item.element, this.adapter, decision.explanation);
        } else {
          this.adapter.hidePost(item.element, decision.explanation);
        }
        this.sendDecisionToBackground(decision, item.post);
      } else {
        item.state = "Allowed";
        this.adapter.restorePost(item.element);
        if (feedType === "shorts") {
          this.videoSkipper.resetStreak();
        }
      }
    }
    reEvaluateAll() {
      for (const item of this.items.values()) {
        this.evaluateItem(item);
      }
    }
    detectBasicTopics(text) {
      const lower = text.toLowerCase();
      const topics = [];
      const topicKeywords = {
        education: ["learn", "tutorial", "course", "student", "school", "study", "education", "lecture"],
        mathematics: ["calculus", "algebra", "equation", "math", "derivative", "integral", "matrix"],
        science: ["physics", "chemistry", "biology", "astronomy", "quantum", "experiment", "nasa"],
        technology: ["software", "hardware", "tech", "computer", "device", "gadget", "silicon"],
        programming: ["javascript", "python", "typescript", "react", "code", "coding", "github", "developer"],
        business: ["finance", "market", "stock", "investing", "economy", "startup", "revenue"],
        news: ["breaking", "report", "press", "journalist", "investigation", "parliament", "senate"],
        entertainment: ["movie", "trailer", "song", "comedy", "funny", "music", "gameplay", "gaming"],
        sports: ["cricket", "football", "fifa", "nba", "tennis", "match", "tournament", "championship"],
        art: ["painting", "drawing", "illustration", "sketch", "sculpture", "design", "gallery"],
        travel: ["travel", "flight", "hotel", "destination", "island", "vacation", "mountains"]
      };
      for (const [topicId, words] of Object.entries(topicKeywords)) {
        if (words.some((w) => lower.includes(w))) {
          topics.push(topicId);
        }
      }
      return topics;
    }
    sendDecisionToBackground(decision, post) {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage({
            type: "RECORD_DECISION",
            payload: {
              ...decision,
              snippet: post.text.slice(0, 140),
              authorName: post.author?.name,
              authorHandle: post.author?.handle
            }
          });
        } catch {
        }
      }
    }
  };

  // src/content/abuse-guard.ts
  var AbuseGuard = class {
    detector;
    adultDetector;
    settings;
    observer = null;
    processedElements = /* @__PURE__ */ new WeakSet();
    blockedCount = 0;
    scanDebounceTimer = null;
    pendingNodes = [];
    constructor(settings) {
      this.settings = settings;
      this.detector = new AbuseDetector();
      this.adultDetector = new AdultContentDetector();
      this.applySettingsToDetector();
    }
    applySettingsToDetector() {
      if (this.settings.customAbuseWords?.length) {
        this.detector.addBlockedTerms(this.settings.customAbuseWords);
      }
      if (this.settings.exemptAbuseWords?.length) {
        this.detector.addExemptTerms(this.settings.exemptAbuseWords);
      }
    }
    updateSettings(newSettings) {
      this.settings = newSettings;
      this.applySettingsToDetector();
      if (!this.settings.abuseFilterEnabled) {
        this.restoreAll();
      } else {
        this.scanDocument();
      }
    }
    start() {
      if (!this.settings.abuseFilterEnabled) return;
      this.injectStyles();
      this.scanDocument();
      this.initObserver();
    }
    stop() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.restoreAll();
    }
    injectStyles() {
      const doc = typeof document !== "undefined" ? document : null;
      if (!doc || doc.getElementById("laya-abuse-guard-styles")) return;
      const style = doc.createElement("style");
      style.id = "laya-abuse-guard-styles";
      style.textContent = `
      .laya-abuse-container {
        position: relative !important;
      }
      .laya-abuse-blurred {
        filter: blur(6px) !important;
        opacity: 0.45 !important;
        user-select: none !important;
        pointer-events: none !important;
        transition: filter 0.2s ease, opacity 0.2s ease !important;
      }
      .laya-abuse-revealed {
        filter: none !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        user-select: auto !important;
      }
      .laya-abuse-badge {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 4px 10px !important;
        margin: 4px 0 !important;
        background: #181a20 !important;
        color: #f87171 !important;
        border: 1px solid rgba(239, 68, 68, 0.35) !important;
        border-radius: 6px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        user-select: none !important;
        z-index: 10 !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4) !important;
      }
      .laya-abuse-badge:hover {
        background: #232730 !important;
        border-color: #ef4444 !important;
      }
    `;
      doc.head?.appendChild(style);
    }
    initObserver() {
      if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
      this.observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const m of mutations) {
          if (m.type === "childList" && m.addedNodes.length > 0) {
            for (let i = 0; i < m.addedNodes.length; i++) {
              const node = m.addedNodes[i];
              if (node.nodeType === 1) {
                this.pendingNodes.push(node);
                shouldScan = true;
              }
            }
          }
        }
        if (shouldScan) {
          this.scheduleScan();
        }
      });
      this.observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    }
    scheduleScan() {
      if (this.scanDebounceTimer !== null) return;
      const runner = () => {
        this.scanDebounceTimer = null;
        const batch = this.pendingNodes.splice(0, 50);
        for (const root of batch) {
          this.scanElementTree(root);
        }
        if (this.pendingNodes.length > 0) {
          this.scheduleScan();
        }
      };
      if (typeof requestIdleCallback !== "undefined") {
        this.scanDebounceTimer = requestIdleCallback(runner, { timeout: 250 });
      } else {
        this.scanDebounceTimer = setTimeout(runner, 50);
      }
    }
    scanDocument() {
      if (typeof document === "undefined") return;
      this.scanElementTree(document.body || document.documentElement);
    }
    /**
     * Scans an element and its descendants for comments and text blocks
     */
    scanElementTree(root) {
      if (!root || this.processedElements.has(root)) return;
      const candidateSelectors = [
        // Known platform comment containers
        "#content-text",
        // YouTube comment
        "ytd-comment-view-model",
        "shreddit-comment",
        // Reddit modern comment
        '[data-testid="comment"]',
        '[data-testid="tweetText"]',
        // Twitter/X post & reply text
        "ul._a9ym",
        // Instagram comment
        "span._a9zs",
        // Instagram comment text
        '[data-e2e="comment-level-1"]',
        // TikTok comment
        // Universal comment & forum elements on any website
        ".comment",
        ".comments",
        ".comment-body",
        ".comment-content",
        ".comment-text",
        ".reply",
        ".forum-post",
        ".message-content",
        "blockquote",
        "p",
        "li",
        "span"
      ];
      try {
        const candidates = Array.from(root.querySelectorAll(candidateSelectors.join(", ")));
        for (let i = candidates.length - 1; i >= 0; i--) {
          this.inspectElement(candidates[i]);
        }
        this.inspectElement(root);
      } catch {
      }
    }
    /**
     * Evaluates a single DOM element for abusive language
     */
    inspectElement(el) {
      if (this.processedElements.has(el)) return false;
      const tag = el.tagName.toLowerCase();
      if (["script", "style", "textarea", "input", "code", "pre", "noscript"].includes(tag)) {
        this.processedElements.add(el);
        return false;
      }
      if (el.classList.contains("laya-abuse-badge") || el.classList.contains("laya-abuse-blurred")) {
        return false;
      }
      if (el.closest('.laya-abuse-blurred, [data-laya-abuse-detected="true"]')) {
        this.processedElements.add(el);
        return false;
      }
      if (el.querySelector('.laya-abuse-blurred, [data-laya-abuse-detected="true"]')) {
        this.processedElements.add(el);
        return false;
      }
      const text = el.textContent?.trim();
      if (!text || text.length < 2 || text.length > 5e3) {
        return false;
      }
      if (el.children.length > 0 && Array.from(el.children).some((c) => ["p", "span", "div", "blockquote"].includes(c.tagName.toLowerCase()))) {
        return false;
      }
      const assessment = this.detector.detectAbuse(text, {
        strictness: this.settings.abuseStrictness || "balanced",
        obfuscationDefense: this.settings.obfuscationDefense !== false,
        customWords: this.settings.customAbuseWords,
        exemptWords: this.settings.exemptAbuseWords
      });
      if (assessment.isAbusive) {
        this.blockAbusiveElement(el, assessment.matchedTerms, "Abusive comment");
        this.processedElements.add(el);
        return true;
      }
      const adultCheck = this.adultDetector.detectAdultContent(text);
      if (adultCheck.isAdult) {
        this.blockAbusiveElement(el, adultCheck.matchedPatterns, "Adult content");
        this.processedElements.add(el);
        return true;
      }
      this.processedElements.add(el);
      return false;
    }
    /**
     * Applies the configured blocking action (blur, hide, or redact) to an abusive or explicit element
     */
    blockAbusiveElement(el, matchedTerms, categoryLabel = "Abusive content") {
      this.blockedCount++;
      el.setAttribute("data-laya-abuse-detected", "true");
      el.setAttribute("data-laya-abuse-terms", matchedTerms.join(", "));
      const action = this.settings.abuseAction || "blur";
      if (action === "hide") {
        el._layaPrevDisplay = el.style.display;
        el.style.display = "none";
        return;
      }
      if (action === "redact") {
        this.redactTextContent(el, matchedTerms);
        return;
      }
      el.classList.add("laya-abuse-blurred");
      el.parentElement?.classList.add("laya-abuse-container");
      const badge = el.ownerDocument.createElement("div");
      badge.className = "laya-abuse-badge";
      badge.setAttribute("role", "button");
      badge.setAttribute("tabindex", "0");
      badge.setAttribute("title", `Blocked: ${matchedTerms.join(", ")}. Click to toggle view.`);
      badge.innerHTML = `\u{1F6E1}\uFE0F ${categoryLabel} hidden by Laya (${matchedTerms[0] || "blocked"}) \u2022 Click to view`;
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        const isBlurred = el.classList.contains("laya-abuse-blurred");
        if (isBlurred) {
          el.classList.remove("laya-abuse-blurred");
          el.classList.add("laya-abuse-revealed");
          badge.innerHTML = `\u{1F6E1}\uFE0F ${categoryLabel} revealed \u2022 Click to re-hide`;
        } else {
          el.classList.add("laya-abuse-blurred");
          el.classList.remove("laya-abuse-revealed");
          badge.innerHTML = `\u{1F6E1}\uFE0F ${categoryLabel} hidden by Laya \u2022 Click to view`;
        }
      });
      el.insertAdjacentElement("beforebegin", badge);
      this.notifyBackgroundBlocked(matchedTerms);
    }
    redactTextContent(el, _matchedTerms) {
      const walker = el.ownerDocument.createTreeWalker(
        el,
        4
        /* NodeFilter.SHOW_TEXT */
      );
      let node;
      while (node = walker.nextNode()) {
        const val = node.nodeValue;
        if (val) {
          const assessment = this.detector.detectAbuse(val);
          if (assessment.isAbusive) {
            node.nodeValue = "[Blocked by Laya Abuse Guard]";
          }
        }
      }
    }
    notifyBackgroundBlocked(matchedTerms) {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage({
            type: "ABUSE_BLOCKED",
            count: 1,
            url: typeof window !== "undefined" ? window.location.href : "",
            terms: matchedTerms
          });
        } catch {
        }
      }
    }
    restoreAll() {
      if (typeof document === "undefined") return;
      const blurred = document.querySelectorAll(".laya-abuse-blurred, .laya-abuse-revealed");
      blurred.forEach((el) => {
        el.classList.remove("laya-abuse-blurred", "laya-abuse-revealed");
      });
      const badges = document.querySelectorAll(".laya-abuse-badge");
      badges.forEach((b) => b.remove());
      const hidden = document.querySelectorAll('[data-laya-abuse-detected="true"]');
      hidden.forEach((el) => {
        const h = el;
        if (h._layaPrevDisplay !== void 0) {
          h.style.display = h._layaPrevDisplay;
        }
        h.removeAttribute("data-laya-abuse-detected");
      });
      this.processedElements = /* @__PURE__ */ new WeakSet();
    }
    getBlockedCount() {
      return this.blockedCount;
    }
  };

  // src/content/content-script.ts
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
  function initContentScript() {
    const registry = new AdapterRegistry();
    const currentUrl = new URL(window.location.href);
    const { adapter, isGeneric } = registry.getAdapterForUrl(currentUrl);
    let feedController = null;
    let abuseGuard = null;
    function applySettings(settings) {
      if (!abuseGuard) {
        abuseGuard = new AbuseGuard(settings);
        abuseGuard.start();
      } else {
        abuseGuard.updateSettings(settings);
      }
      if (adapter) {
        if (!feedController) {
          feedController = new FeedController(adapter, settings);
          feedController.start();
        } else {
          feedController.updateSettings(settings);
        }
      }
    }
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["layaSettings"], (result) => {
        const settings = result.layaSettings || DEFAULT_SETTINGS;
        applySettings(settings);
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.layaSettings) {
          applySettings(changes.layaSettings.newValue);
        }
      });
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === "REVEAL_ITEM" && message.itemId) {
          feedController?.revealItem(message.itemId);
          sendResponse({ success: true });
        } else if (message.type === "GET_PAGE_STATUS") {
          sendResponse({
            adapterName: adapter ? adapter.name : "AbuseGuard (Whole Web)",
            isGeneric,
            url: currentUrl.href,
            abuseBlockedCount: abuseGuard ? abuseGuard.getBlockedCount() : 0
          });
        }
      });
    } else {
      applySettings(DEFAULT_SETTINGS);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initContentScript);
  } else {
    initContentScript();
  }
})();
//# sourceMappingURL=content-script.js.map
