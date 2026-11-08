const OWNER = "YOCRRZ224";
const REPO = "picss";
const BRANCH = "main";
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/photos?ref=${BRANCH}`;

const gallery = document.querySelector("#gallery");
const photoCount = document.querySelector("#photo-count");
const errorState = document.querySelector("#error-state");
const errorMessage = document.querySelector("#error-message");
const retryButton = document.querySelector("#retry-button");
const emptyState = document.querySelector("#empty-state");
const clearSearchButton = document.querySelector("#clear-search");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const viewer = document.querySelector("#photo-viewer");
const viewerImage = document.querySelector("#viewer-image");
const viewerTitle = document.querySelector("#viewer-title");
const viewerDate = document.querySelector("#viewer-date");
const viewerPosition = document.querySelector("#viewer-position");
const viewerClose = document.querySelector("#viewer-close");
const viewerPrev = document.querySelector("#viewer-prev");
const viewerNext = document.querySelector("#viewer-next");

let allPhotos = [];
let visiblePhotos = [];
let activePhotoIndex = -1;

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function showError(message) {
    gallery.hidden = true;
    emptyState.hidden = true;
    errorState.hidden = false;
    photoCount.textContent = "Unavailable";
    errorMessage.textContent = message;
}

function showLoading() {
    gallery.hidden = false;
    emptyState.hidden = true;
    errorState.hidden = true;
    gallery.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "loading-state";
    const spinner = document.createElement("span");
    spinner.className = "loader";
    const label = document.createElement("span");
    label.textContent = "collecting furina noods";
    loading.append(spinner, label);
    gallery.append(loading);
    photoCount.textContent = "Loading collection…";
}

async function fetchPhotos() {
    showLoading();
    try {
        const response = await fetch(API_URL, { headers: { Accept: "application/vnd.github+json" } });
        if (!response.ok) throw new Error(`GitHub API returned HTTP ${response.status}`);
        const files = await response.json();
        if (!Array.isArray(files)) throw new Error("Unexpected response from GitHub.");

        const jsonFiles = files.filter(file => file.type === "file" && typeof file.name === "string" && file.name.toLowerCase().endsWith(".json") && typeof file.download_url === "string");
        const results = await Promise.allSettled(jsonFiles.map(async file => {
            const metadataResponse = await fetch(file.download_url);
            if (!metadataResponse.ok) throw new Error(`Could not load ${file.name}`);
            return metadataResponse.json();
        }));

        allPhotos = results.filter(result => result.status === "fulfilled").map(result => result.value).filter(photo =>
            photo && typeof photo.id === "string" && typeof photo.title === "string" && typeof photo.image === "string" && /^https:\/\//i.test(photo.image)
        );
        applyFilters();
    } catch (error) {
        console.error("PICSS collection error:", error);
        showError(error.message || "Something went wrong.");
    }
}

function applyFilters() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    visiblePhotos = allPhotos.filter(photo => photo.title.toLocaleLowerCase().includes(query));
    visiblePhotos.sort((a, b) => {
        const first = new Date(a.created_at || 0).getTime() || 0;
        const second = new Date(b.created_at || 0).getTime() || 0;
        return sortSelect.value === "oldest" ? first - second : second - first;
    });
    renderGallery();
}

function renderGallery() {
    gallery.replaceChildren();
    gallery.hidden = false;
    errorState.hidden = true;
    const total = visiblePhotos.length;
    photoCount.textContent = total === 1 ? "1 photograph" : `${total} photographs`;
    if (total === 0) {
        gallery.hidden = true;
        emptyState.hidden = false;
        return;
    }
    emptyState.hidden = true;
    const fragment = document.createDocumentFragment();
    visiblePhotos.forEach((photo, index) => fragment.append(createPhotoCard(photo, index)));
    gallery.append(fragment);
}

function createPhotoCard(photo, index) {
    const card = document.createElement("button");
    card.className = "photo-card";
    card.type = "button";
    card.style.setProperty("--delay", `${Math.min(index * 45, 540)}ms`);
    card.setAttribute("aria-label", `View ${photo.title}`);
    const inner = document.createElement("span");
    inner.className = "photo-card-inner";
    const imageWrap = document.createElement("span");
    imageWrap.className = "photo-image-wrap";
    const image = document.createElement("img");
    image.src = photo.image;
    image.alt = photo.title;
    image.loading = index < 8 ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
        image.classList.add("image-failed");
        image.alt = `${photo.title} — image unavailable`;
    }, { once: true });
    const info = document.createElement("span");
    info.className = "photo-card-info";
    const title = document.createElement("span");
    title.className = "photo-title";
    title.textContent = photo.title;
    const date = document.createElement("span");
    date.className = "photo-date";
    date.textContent = formatDate(photo.created_at);
    imageWrap.append(image);
    info.append(title, date);
    inner.append(imageWrap, info);
    card.append(inner);
    card.addEventListener("click", () => openViewer(index));
    return card;
}

function openViewer(index) {
    if (!visiblePhotos.length) return;
    activePhotoIndex = index;
    updateViewer();
    if (!viewer.open) viewer.showModal();
}

function updateViewer() {
    const photo = visiblePhotos[activePhotoIndex];
    if (!photo) return;
    viewerImage.src = photo.image;
    viewerImage.alt = photo.title;
    viewerTitle.textContent = photo.title;
    viewerDate.textContent = formatDate(photo.created_at);
    viewerPosition.textContent = `${String(activePhotoIndex + 1).padStart(2, "0")} / ${String(visiblePhotos.length).padStart(2, "0")}`;
    const hasMultiple = visiblePhotos.length > 1;
    viewerPrev.disabled = !hasMultiple;
    viewerNext.disabled = !hasMultiple;
}

function moveViewer(direction) {
    if (visiblePhotos.length < 2) return;
    activePhotoIndex = (activePhotoIndex + direction + visiblePhotos.length) % visiblePhotos.length;
    updateViewer();
}

function closeViewer() { if (viewer.open) viewer.close(); }
searchInput.addEventListener("input", applyFilters);
sortSelect.addEventListener("change", applyFilters);
retryButton.addEventListener("click", fetchPhotos);
clearSearchButton.addEventListener("click", () => { searchInput.value = ""; applyFilters(); searchInput.focus(); });
viewerClose.addEventListener("click", closeViewer);
viewerPrev.addEventListener("click", () => moveViewer(-1));
viewerNext.addEventListener("click", () => moveViewer(1));
viewer.addEventListener("click", event => { if (event.target === viewer) closeViewer(); });
viewer.addEventListener("close", () => { viewerImage.removeAttribute("src"); activePhotoIndex = -1; });
document.addEventListener("keydown", event => {
    if (event.key === "/" && !viewer.open && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        event.preventDefault(); searchInput.focus();
    }
    if (!viewer.open) return;
    if (event.key === "ArrowLeft") moveViewer(-1);
    if (event.key === "ArrowRight") moveViewer(1);
});
fetchPhotos();

/* ── PICSS: Original resolution zoom ── */

const picssOriginalUpdateViewer = updateViewer;

function setViewerZoom(enabled) {
  viewer.classList.toggle("is-zoomed", enabled);
  viewerImage.setAttribute("aria-label",
    enabled
      ? "Original resolution photograph. Click to fit."
      : "Photograph. Click to view original resolution."
  );

  viewerImage.title = enabled
    ? "Click to fit image"
    : "Click to view original resolution";

  if (enabled) {
    requestAnimationFrame(() => {
      const wrap = viewerImage.parentElement;
      wrap.scrollLeft = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2);
      wrap.scrollTop = Math.max(0, (wrap.scrollHeight - wrap.clientHeight) / 2);
    });
  }
}

/* Reset zoom whenever the photograph changes */
updateViewer = function () {
  setViewerZoom(false);
  picssOriginalUpdateViewer();
};

/* Toggle between fit and original dimensions */
viewerImage.addEventListener("click", () => {
  if (!viewer.open || !viewerImage.complete || !viewerImage.naturalWidth) return;

  setViewerZoom(!viewer.classList.contains("is-zoomed"));
});

/* Reset zoom when the viewer closes */
viewer.addEventListener("close", () => {
  setViewerZoom(false);
});

