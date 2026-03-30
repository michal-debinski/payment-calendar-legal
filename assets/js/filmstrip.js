(function () {
  function onReady() {
    var prefersReduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var grids = document.querySelectorAll(".screens-grid");

    grids.forEach(function (grid) {
      if (grid.dataset.filmstripInit === "true") {
        return;
      }
      var items = Array.prototype.slice.call(grid.children);
      if (items.length < 3) {
        return;
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

      function computeLoopShift() {
        if (copies["1"][0] && copies["2"][0]) {
          loopShift = getItemCenter(copies["2"][0]) - getItemCenter(copies["1"][0]);
        }
      }

      function getItemCenter(item) {
        return item.offsetLeft + item.offsetWidth / 2;
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
        if (isJumping) {
          return;
        }
        if (!allItems.length) {
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

      window.requestAnimationFrame(function () {
        computeLoopShift();
        var firstOriginal = items[0];
        if (firstOriginal) {
          grid.scrollLeft = getItemCenter(firstOriginal) - grid.clientWidth / 2;
        }
        updateFocus();
      });

      if (!prefersReduced) {
        var isPaused = false;
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
        var timer = window.setInterval(autoAdvance, interval);

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
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();
