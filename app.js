const OWNER = "YOCRRZ224";
const REPO = "picss";
const BRANCH = "main";

const API_URL =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/photos?ref=${BRANCH}`;

const gallery = document.querySelector("#gallery");
const photoCount = document.querySelector("#photo-count");
const errorState = document.querySelector("#error-state");
const errorMessage = document.querySelector("#error-message");
const retryButton = document.querySelector("#retry-button");

const viewer = document.querySelector("#photo-viewer");
const viewerImage = document.querySelector("#viewer-image");
const viewerTitle = document.querySelector("#viewer-title");
const viewerDate = document.querySelector("#viewer-date");

function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

function showError(message) {
    gallery.hidden = true;
    errorState.hidden = false;
    photoCount.textContent = "Unavailable";
    errorMessage.textContent = message;
}

async function fetchPhotos() {
    gallery.hidden = false;
    errorState.hidden = true;
    gallery.replaceChildren();

    const loading = document.createElement("p");
    loading.className = "status-message";
    loading.textContent = "Loading photographs...";
    gallery.append(loading);

    photoCount.textContent = "Loading collection...";

    try {
        const response = await fetch(API_URL, {
            headers: {
                Accept: "application/vnd.github+json"
            }
        });

        if (!response.ok) {
            throw new Error(
                `GitHub API returned HTTP ${response.status}`
            );
        }

        const files = await response.json();

        if (!Array.isArray(files)) {
            throw new Error("Unexpected response from GitHub.");
        }

        const jsonFiles = files.filter(file =>
            file.type === "file" &&
            file.name.toLowerCase().endsWith(".json")
        );

        const results = await Promise.allSettled(
            jsonFiles.map(async file => {
                const metadataResponse = await fetch(file.download_url);

                if (!metadataResponse.ok) {
                    throw new Error(`Could not load ${file.name}`);
                }

                return metadataResponse.json();
            })
        );

        const photos = results
            .filter(result => result.status === "fulfilled")
            .map(result => result.value)
            .filter(photo =>
                photo &&
                typeof photo.id === "string" &&
                typeof photo.title === "string" &&
                typeof photo.image === "string" &&
                photo.image.startsWith("https://")
            )
            .sort((a, b) =>
                new Date(b.created_at || 0) -
                new Date(a.created_at || 0)
            );

        gallery.replaceChildren();

        if (photos.length === 0) {
            const empty = document.createElement("p");
            empty.className = "status-message";
            empty.textContent = "No photographs have been published yet.";
            gallery.append(empty);
        } else {
            photos.forEach(photo => {
                gallery.append(createPhotoCard(photo));
            });
        }

        photoCount.textContent =
            `${photos.length} ${photos.length === 1 ? "photograph" : "photographs"}`;

    } catch (error) {
        console.error("Gallery loading error:", error);
        showError(error.message || "Something went wrong.");
    }
}

function createPhotoCard(photo) {
    const card = document.createElement("button");
    card.className = "photo-card";
    card.type = "button";
    card.setAttribute("aria-label", `View ${photo.title}`);

    const image = document.createElement("img");
    image.src = photo.image;
    image.alt = photo.title;
    image.loading = "lazy";
    image.decoding = "async";

    image.addEventListener("error", () => {
        image.alt = `${photo.title} — image unavailable`;
        image.style.opacity = "0.35";
    });

    const title = document.createElement("span");
    title.className = "photo-title";
    title.textContent = photo.title;

    const date = document.createElement("span");
    date.className = "photo-date";
    date.textContent = formatDate(photo.created_at);

    card.append(image, title, date);

    card.addEventListener("click", () => {
        openViewer(photo);
    });

    return card;
}

function openViewer(photo) {
    viewerImage.src = photo.image;
    viewerImage.alt = photo.title;
    viewerTitle.textContent = photo.title;
    viewerDate.textContent = formatDate(photo.created_at);

    viewer.showModal();
}

document.querySelector("#viewer-close").addEventListener("click", () => {
    viewer.close();
});

viewer.addEventListener("click", event => {
    if (event.target === viewer) {
        viewer.close();
    }
});

viewer.addEventListener("close", () => {
    viewerImage.removeAttribute("src");
});

retryButton.addEventListener("click", fetchPhotos);

fetchPhotos();
