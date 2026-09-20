(function () {
  // Taśma zrzutów ekranu: klonuje kafelki po obu stronach, żeby przewijanie
  // było zapętlone, i skaluje ten kafelek, który jest najbliżej środka.
  //
  // Siatka ukryta atrybutem [hidden] ma clientWidth === 0, więc wszystkie
  // wyliczenia środka byłyby zerowe. Dlatego inicjalizujemy wyłącznie siatki
  // widoczne, a ukryte dopiero w chwili pokazania ich przez przełącznik.

  function initFilmstrip(grid) {
    if (grid.dataset.filmstripInit === "true") {
      return null;
    }
    var prefersReduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var items = Array.prototype.slice.call(grid.children);
    if (items.length < 3) {
      return null;
    }
    grid.dataset.filmstripInit = "true";
    grid.setAttribute("tabindex", "0");

    var originalsByIndex = {};
    items.forEach(function (item, index) {
      item.dataset.filmstripIndex = String(index);
      item.dataset.filmstripClone = "false";
      item.dataset.filmstripCopy = "1";
      originalsByIndex[String(index)] = item;
    });

    function cloneItem(item, copy) {
      var clone = item.cloneNode(true);
      clone.classList.add("is-clone");
      clone.dataset.filmstripClone = "true";
      clone.dataset.filmstripCopy = String(copy);
      clone.dataset.filmstripIndex = item.dataset.filmstripIndex;
      clone.setAttribute("aria-hidden", "true");
      return clone;
    }

    var beforeFragment = document.createDocumentFragment();
    items.forEach(function (item) {
      beforeFragment.appendChild(cloneItem(item, 0));
    });
    var afterFragment = document.createDocumentFragment();
    items.forEach(function (item) {
      afterFragment.appendChild(cloneItem(item, 2));
    });
    grid.insertBefore(beforeFragment, grid.firstChild);
    grid.appendChild(afterFragment);

    var allItems = Array.prototype.slice.call(grid.children);
    var copies = { "0": [], "1": [], "2": [] };
    allItems.forEach(function (item) {
      var copy = item.dataset.filmstripCopy;
      var index = parseInt(item.dataset.filmstripIndex || "0", 10);
      if (copies[copy]) {
        copies[copy][index] = item;
      }
    });

    var rafId = 0;
    var isJumping = false;
    var isAutoScrolling = false;
    var scrollEndTimer = 0;
    var pendingJump = false;
    var loopShift = 0;

    function getItemCenter(item) {
      return item.offsetLeft + item.offsetWidth / 2;
    }

    function computeLoopShift() {
      if (copies["1"][0] && copies["2"][0]) {
        loopShift = getItemCenter(copies["2"][0]) - getItemCenter(copies["1"][0]);
      }
    }

    function applyFocus(center) {
      var base = Math.max(grid.clientWidth * 0.35, 220);
      allItems.forEach(function (item) {
        var itemCenter = getItemCenter(item);
        var distance = Math.abs(center - itemCenter);
        var ratio = Math.min(distance / base, 1);
        var scale = 1.04 - ratio * 0.16;
        var opacity = 1 - ratio * 0.35;
        item.style.setProperty("--filmstrip-scale", scale.toFixed(3));
        item.style.setProperty("--filmstrip-opacity", opacity.toFixed(3));
      });
    }

    function getClosestItem() {
      var center = grid.scrollLeft + grid.clientWidth / 2;
      var closest = null;
      var closestIndex = -1;
      var minDistance = Infinity;
      allItems.forEach(function (item, index) {
        var distance = Math.abs(center - getItemCenter(item));
        if (distance < minDistance) {
          minDistance = distance;
          closest = item;
          closestIndex = index;
        }
      });
      return { center: center, closest: closest, closestIndex: closestIndex };
    }

    function jumpToOriginalIfClone(item) {
      if (!item || item.dataset.filmstripCopy === "1") {
        return false;
      }
      if (!loopShift) {
        computeLoopShift();
      }
      if (!loopShift) {
        return false;
      }
      isJumping = true;
      if (item.dataset.filmstripCopy === "2") {
        grid.scrollLeft -= loopShift;
      } else if (item.dataset.filmstripCopy === "0") {
        grid.scrollLeft += loopShift;
      }
      isJumping = false;
      return true;
    }

    function scrollToItem(item, behavior) {
      if (!item) {
        return;
      }
      var left = getItemCenter(item) - grid.clientWidth / 2;
      grid.scrollTo({ left: left, behavior: behavior || "smooth" });
    }

    function updateFocus() {
      if (isJumping || !allItems.length) {
        return;
      }
      if (!loopShift) {
        computeLoopShift();
      }
      var info = getClosestItem();
      applyFocus(info.center);
      if (info.closest && info.closest.dataset.filmstripCopy !== "1") {
        pendingJump = true;
      }
    }

    function scheduleUpdate() {
      if (rafId) {
        return;
      }
      rafId = window.requestAnimationFrame(function () {
        rafId = 0;
        updateFocus();
      });
    }

    function handleScrollEnd() {
      scrollEndTimer = 0;
      if (isAutoScrolling) {
        isAutoScrolling = false;
      }
      if (!pendingJump) {
        return;
      }
      var info = getClosestItem();
      if (jumpToOriginalIfClone(info.closest)) {
        var refreshed = getClosestItem();
        applyFocus(refreshed.center);
      }
      pendingJump = false;
    }

    grid.addEventListener(
      "scroll",
      function () {
        scheduleUpdate();
        if (scrollEndTimer) {
          window.clearTimeout(scrollEndTimer);
        }
        scrollEndTimer = window.setTimeout(handleScrollEnd, 140);
      },
      { passive: true }
    );
    window.addEventListener("resize", function () {
      computeLoopShift();
      scheduleUpdate();
    });

    // Wyśrodkowanie pierwszego oryginału. Wymaga niezerowej szerokości,
    // więc przełącznik woła to ponownie po pokazaniu siatki.
    function center() {
      computeLoopShift();
      var firstOriginal = items[0];
      if (firstOriginal) {
        grid.scrollLeft = getItemCenter(firstOriginal) - grid.clientWidth / 2;
      }
      updateFocus();
    }
    window.requestAnimationFrame(center);

    var isPaused = false;
    var timer = 0;

    if (!prefersReduced) {
      var interval = 3200;

      function autoAdvance() {
        if (isPaused || !allItems.length) {
          return;
        }
        updateFocus();
        var info = getClosestItem();
        if (!info.closest) {
          return;
        }
        var active = info.closest;
        if (active.dataset.filmstripCopy !== "1") {
          jumpToOriginalIfClone(active);
          active = originalsByIndex[active.dataset.filmstripIndex];
        }
        if (!active) {
          return;
        }
        var currentIndex = parseInt(active.dataset.filmstripIndex || "0", 10);
        var nextIndex = currentIndex + 1;
        var target = nextIndex < items.length ? copies["1"][nextIndex] : copies["2"][0];
        isAutoScrolling = true;
        scrollToItem(target, "smooth");
      }
      timer = window.setInterval(autoAdvance, interval);

      function pause() {
        isPaused = true;
      }
      function resume() {
        isPaused = false;
      }
      grid.addEventListener("mouseenter", pause);
      grid.addEventListener("mouseleave", resume);
      grid.addEventListener("focusin", pause);
      grid.addEventListener("focusout", resume);
      grid.addEventListener("touchstart", pause, { passive: true });
      grid.addEventListener("touchend", resume, { passive: true });

      grid.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
          return;
        }
        event.preventDefault();
        pause();
        updateFocus();
        var info = getClosestItem();
        var active = info.closest;
        if (active && active.dataset.filmstripCopy !== "1") {
          jumpToOriginalIfClone(active);
          active = originalsByIndex[active.dataset.filmstripIndex];
        }
        if (!active) {
          return;
        }
        var currentIndex = parseInt(active.dataset.filmstripIndex || "0", 10);
        var delta = event.key === "ArrowRight" ? 1 : -1;
        var nextIndex = currentIndex + delta;
        var target = null;
        if (delta === 1) {
          target = nextIndex < items.length ? copies["1"][nextIndex] : copies["2"][0];
        } else {
          target = nextIndex >= 0 ? copies["1"][nextIndex] : copies["0"][items.length - 1];
        }
        isAutoScrolling = true;
        scrollToItem(target, "smooth");
      });

      window.addEventListener("beforeunload", function () {
        window.clearInterval(timer);
      });
    }

    return {
      recenter: center,
      // taśma schowana pod nieaktywnym chipem nie ma po co przewijać się sama
      setActive: function (active) {
        isPaused = !active;
      }
    };
  }

  // Przełącznik iPhone / iPad. Brak przełącznika na stronie oznacza układ
  // sprzed migracji - wtedy po prostu nie ma czego podpinać.
  function initDeviceChips(strips) {
    var group = document.querySelector(".device-chips");
    if (!group) {
      return;
    }
    var chips = Array.prototype.slice.call(group.querySelectorAll(".chip"));

    function select(chip, moveFocus) {
      chips.forEach(function (other) {
        var isTarget = other === chip;
        var panel = document.getElementById(other.getAttribute("aria-controls"));
        other.setAttribute("aria-selected", isTarget ? "true" : "false");
        other.classList.toggle("is-active", isTarget);
        other.tabIndex = isTarget ? 0 : -1;
        if (!panel) {
          return;
        }
        panel.hidden = !isTarget;
        if (isTarget) {
          // pierwsze pokazanie: dopiero teraz siatka ma szerokość
          if (panel.dataset.filmstripInit !== "true") {
            strips[panel.id] = initFilmstrip(panel);
          } else if (strips[panel.id]) {
            strips[panel.id].recenter();
          }
        }
        if (strips[panel.id]) {
          strips[panel.id].setActive(isTarget);
        }
      });
      if (moveFocus) {
        chip.focus();
      }
    }

    group.addEventListener("click", function (event) {
      var chip = event.target.closest(".chip");
      if (chip) {
        select(chip, false);
      }
    });

    group.addEventListener("keydown", function (event) {
      var current = chips.indexOf(document.activeElement);
      if (current === -1) {
        return;
      }
      var next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = chips[(current + 1) % chips.length];
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = chips[(current - 1 + chips.length) % chips.length];
      } else if (event.key === "Home") {
        next = chips[0];
      } else if (event.key === "End") {
        next = chips[chips.length - 1];
      }
      if (next) {
        event.preventDefault();
        select(next, true);
      }
    });
  }

  function onReady() {
    var strips = {};
    document.querySelectorAll(".screens-grid").forEach(function (grid) {
      if (!grid.hasAttribute("hidden")) {
        strips[grid.id || "default"] = initFilmstrip(grid);
      }
    });
    initDeviceChips(strips);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();
