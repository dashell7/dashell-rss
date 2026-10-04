import { translateSettingsText } from "./chinese-localization";

function isUserContent(element: Element): boolean {
  return Boolean(
    element.closest(
      "[data-settings-localization-skip], .rss-dashboard-tags-container .setting-item-name, .rss-dashboard-tag-multi-select-trigger-label, .rss-dashboard-tag-multi-select-menu-option-label, .rss-dashboard-highlight-word-name-click, .rss-dashboard-saved-templates .setting-item-name, [contenteditable='true']",
    ),
  );
}

function localizeElement(element: Element): void {
  if (isUserContent(element)) return;

  for (const attribute of ["placeholder", "aria-label", "aria-description"]) {
    const value = element.getAttribute(attribute);
    if (value) {
      const translated = translateSettingsText(value);
      if (translated !== value) element.setAttribute(attribute, translated);
    }
  }

  if (["INPUT", "TEXTAREA", "CODE", "PRE"].includes(element.tagName)) return;

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 3) {
      const value = child.textContent ?? "";
      const translated = translateSettingsText(value);
      if (translated !== value) child.textContent = translated;
    } else if (child.nodeType === 1) {
      localizeElement(child as Element);
    }
  }
}

/** Localizes visible settings copy while leaving values and user data untouched. */
export function localizeSettingsElement(root: HTMLElement): () => void {
  localizeElement(root);

  const MutationObserverConstructor =
    root.ownerDocument.defaultView?.MutationObserver;
  if (!MutationObserverConstructor) return () => undefined;

  const observer = new MutationObserverConstructor((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.target.nodeType === 1) {
        localizeElement(record.target as Element);
        continue;
      }

      if (record.type === "characterData" && record.target.parentElement) {
        localizeElement(record.target.parentElement);
        continue;
      }

      for (const addedNode of Array.from(record.addedNodes)) {
        if (addedNode.nodeType === 1) {
          localizeElement(addedNode as Element);
        } else if (addedNode.nodeType === 3 && addedNode.parentElement) {
          localizeElement(addedNode.parentElement);
        }
      }
    }
  });

  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "aria-label", "aria-description"],
  });

  return () => observer.disconnect();
}
