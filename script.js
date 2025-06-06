// --- Constants ---
const PLAYLIST_STORAGE_KEY = 'musicPlayerPlaylist';

// --- DOM Element Selections ---
const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const playlistElement = document.getElementById('playlist');
const currentTrackElement = document.getElementById('currentTrack');
const currentArtistElement = document.getElementById('currentArtist');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const progressContainer = document.querySelector('.progress-container');
const progress = document.getElementById('progress');
const currentTimeElement = document.getElementById('currentTime');
const totalDurationElement = document.getElementById('totalDuration');
const volumeSlider = document.getElementById('volumeSlider');
const canvas = document.getElementById('visualizerCanvas');
const canvasCtx = canvas.getContext('2d');
const albumArtPlaceholder = document.getElementById('albumArtPlaceholder');

// --- Player State ---
let playlist = []; // {file: File, originalIndex: number}
let originalPlaylist = [];
let currentTrackIndex = -1;
let isShuffled = false;
let repeatMode = 'none'; // 'none', 'one', 'all'
let currentObjectURL = null;

// --- Audio Context and Analyser for Visualizer ---
let audioCtx;
let analyser;
let source;
let bufferLength;
let dataArray;
let visualizerAnimationId = null;

// --- Event Listener Setup ---
function setupEventListeners() {
    // File Input
    fileInput.addEventListener('change', handleFileSelect);

    // Audio Element Events
    audioPlayer.addEventListener('play', () => {
        updatePlayPauseIcon();
        startVisualizer(); // Start visualizer on play
        albumArtPlaceholder.classList.add('hidden'); // Hide placeholder
    });
    audioPlayer.addEventListener('pause', () => {
        updatePlayPauseIcon();
        stopVisualizer(); // Stop visualizer on pause
        albumArtPlaceholder.classList.remove('hidden'); // Show placeholder
    });
    audioPlayer.addEventListener('ended', handleTrackEnd);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('loadedmetadata', updateDuration);

    // Player Controls
    playPauseBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', playPreviousTrack);
    nextBtn.addEventListener('click', playNextTrack);
    shuffleBtn.addEventListener('click', toggleShuffle);
    repeatBtn.addEventListener('click', cycleRepeatMode);

    // UI Interactions
    progressContainer.addEventListener('click', setProgress);
    volumeSlider.addEventListener('input', setVolume);

    // Resize canvas when window resizes (optional but good practice)
    window.addEventListener('resize', () => {
        // You might need to adjust canvas width/height attributes here
        // if its size isn't purely controlled by CSS, then redraw if needed.
        // For this CSS-based resizing, it should adapt automatically.
    });
}

// --- Utility Functions ---

/**
 * Parses a filename to extract artist and title.
 * @param {string} filename - The filename to parse.
 * @returns {object} An object with 'artist' and 'title' properties.
 */
function parseTrackName(filename) {
    if (!filename) return { artist: 'Unknown Artist', title: 'Unknown Title' };

    // Remove file extension (e.g., .mp3, .wav)
    const nameWithoutExtension = filename.substring(0, filename.lastIndexOf('.')) || filename;

    const parts = nameWithoutExtension.split(' - ');
    if (parts.length === 2) {
        const artist = parts[0].trim();
        const title = parts[1].trim();
        if (artist && title) {
            return { artist, title };
        }
    }

    // Fallback if " - " is not found or parts are empty
    return { artist: 'Unknown Artist', title: nameWithoutExtension.trim() };
}

/**
 * Initializes the Web Audio API components.
 * Needs to be called after a user interaction (e.g., play button click).
 */
function setupAudioContext() {
    if (audioCtx) return; // Already initialized

    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256; // Adjust detail level (power of 2)

        // Connect the audio element to the analyser
        if (!source) { // Create source only once
            source = audioCtx.createMediaElementSource(audioPlayer);
        }
        source.connect(analyser);
        analyser.connect(audioCtx.destination); // Connect analyser to output (speakers)

        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        console.log("Audio Context and Analyser set up.");

    } catch (e) {
        console.error("Error setting up Audio Context:", e);
        // Handle error - maybe disable visualizer
        alert("Sorry, your browser doesn't support the Web Audio API needed for the visualizer.");
    }
}

/**
 * Starts the visualizer animation loop.
 */
function startVisualizer() {
    if (!audioCtx || visualizerAnimationId) return; // Don't start if no context or already running
     // Ensure context is running (important for some browsers after inactivity)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    drawVisualizer(); // Start the loop
    console.log("Visualizer started.");
}

/**
 * Stops the visualizer animation loop.
 */
function stopVisualizer() {
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
        visualizerAnimationId = null;
        // Optionally clear the canvas when stopped
        canvasCtx.fillStyle = 'rgba(255, 255, 255, 0)'; // Transparent clear
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        console.log("Visualizer stopped.");
    }
}

/**
 * The main drawing function for the visualizer.
 */
function drawVisualizer() {
    if (!analyser) return; // Exit if analyser not ready

    visualizerAnimationId = requestAnimationFrame(drawVisualizer); // Loop

    analyser.getByteFrequencyData(dataArray); // Get frequency data

    // --- Drawing ---
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0)'; // Clear canvas (transparent)
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2; // Wider bars
    let barHeight;
    let x = 0;

    // Define the gradient for the bars
    const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#a78bfa'); // Purple top
    gradient.addColorStop(0.5, '#818cf8'); // Indigo middle
    gradient.addColorStop(1, '#60a5fa'); // Blue bottom


    for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] * (canvas.height / 255) * 0.8; // Scale height, reduce max height slightly

        canvasCtx.fillStyle = gradient; // Use gradient for fill
        canvasCtx.fillRect(
            x,
            canvas.height - barHeight, // Draw from bottom up
            barWidth,
            barHeight
        );

        x += barWidth + 1; // Add spacing between bars
    }
    // --- End Drawing ---
}


/**
 * Handles file selection, populates playlist, and optionally starts playback.
 */
function handleFileSelect(event) {
    const files = event.target.files;
    if (!files.length) return;

    originalPlaylist = Array.from(files).map((file, index) => ({ file, originalIndex: index }));
    playlist = [...originalPlaylist];
    currentTrackIndex = -1;
    isShuffled = false;
    updateShuffleButton();
    renderPlaylist();
    savePlaylistToLocalStorage(); // Save after new files are selected

    if (playlist.length > 0) {
        playTrack(0);
    } else {
        resetPlayerUI();
    }
}


/**
 * Saves the current playlist (from originalPlaylist) to local storage.
 * Stores an array of objects, each with 'name' and 'originalIndex'.
 */
function savePlaylistToLocalStorage() {
    if (originalPlaylist.length === 0) {
        localStorage.removeItem(PLAYLIST_STORAGE_KEY);
        return;
    }
    // Ensure all items have a file property before saving
    const storablePlaylist = originalPlaylist
        .filter(trackData => trackData.file) // Only save tracks that have a file object
        .map(trackData => ({
            name: trackData.file.name,
            originalIndex: trackData.originalIndex
        }));

    if (storablePlaylist.length > 0) {
        localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(storablePlaylist));
    } else {
        // If filtering results in an empty playlist (e.g. all loaded from storage previously and none re-selected)
        localStorage.removeItem(PLAYLIST_STORAGE_KEY);
    }
}

/**
 * Loads the playlist from local storage and populates the UI.
 * Tracks loaded this way will not have 'File' objects and will require re-selection for playback.
 */
function loadPlaylistFromLocalStorage() {
    const storedJson = localStorage.getItem(PLAYLIST_STORAGE_KEY);
    if (storedJson) {
        const loadedTracks = JSON.parse(storedJson);
        if (loadedTracks && loadedTracks.length > 0) {
            // Populate originalPlaylist and playlist with the metadata.
            // The 'file' property will be missing.
            originalPlaylist = loadedTracks.map(track => ({
                file: null, // No actual File object can be recreated
                name: track.name, // Store the name separately for renderPlaylist
                originalIndex: track.originalIndex
            }));
            playlist = [...originalPlaylist]; // Keep playlist in sync initially

            // Check if shuffle state was also stored (optional extension, for now, reset)
            // isShuffled = localStorage.getItem('musicPlayerShuffleState') === 'true';
            // updateShuffleButton(); // Update based on loaded state

            renderPlaylist();
            // Do not automatically play a track, as files are missing.
            // Update UI to reflect that tracks are loaded but might need re-selection.
            currentTrackElement.textContent = 'Playlist loaded';
            currentArtistElement.textContent = 'Previously saved playlist'; // Updated context
            if (playlist.length > 0) {
                // If there's a playlist, attempt to show info for the first track
                const firstTrackData = playlist[0];
                const firstTrackFilename = firstTrackData.name; // .name should exist from localStorage
                const parsedInfo = parseTrackName(firstTrackFilename);
                currentTrackElement.textContent = parsedInfo.title + " (Needs re-selection)";
                currentArtistElement.textContent = parsedInfo.artist;
                disableControls(false); // Enable controls as playlist is visually there
            }
        }
    }
}


/**
 * Renders the playlist in the UI, including remove buttons.
 * Handles tracks that might not have a .file property (loaded from localStorage).
 */
function renderPlaylist() {
    playlistElement.innerHTML = ''; // Clear existing playlist

    if (playlist.length === 0) {
        playlistElement.innerHTML = '<p class="p-4 text-gray-500 text-center text-sm">Add files to see the playlist.</p>';
        disableControls(true);
        return;
    }

    disableControls(false); // Enable controls

    playlist.forEach((trackData, index) => {
        const listItem = document.createElement('div');
        listItem.className = 'playlist-item p-3 border-b border-gray-200 flex justify-between items-center text-sm';
        listItem.dataset.index = index; // Store current playlist index

        const trackName = document.createElement('span');
        // Use trackData.name if file.name is not available (for tracks from localStorage)
        trackName.textContent = trackData.file ? trackData.file.name : trackData.name;
        trackName.className = 'truncate mr-2 flex-grow'; // Allow shrinking/growing
        listItem.appendChild(trackName);

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.className = 'remove-track-btn flex-shrink-0'; // Prevent button from shrinking
        removeBtn.title = 'Remove from playlist';
        removeBtn.onclick = (event) => {
            event.stopPropagation(); // Prevent triggering playTrack when clicking remove
            removeTrack(index);
        };
        listItem.appendChild(removeBtn);


        if (index === currentTrackIndex) {
            listItem.classList.add('active');
        }

        listItem.addEventListener('click', () => {
            playTrack(index);
        });

        playlistElement.appendChild(listItem);
    });
}

/**
 * Removes a track from the playlist by its current index.
 */
function removeTrack(indexToRemove) {
    if (indexToRemove < 0 || indexToRemove >= playlist.length) return;

    const removedTrackData = playlist[indexToRemove];
    playlist.splice(indexToRemove, 1); // Remove from current

    const originalIndexToRemove = originalPlaylist.findIndex(
        trackData => trackData.originalIndex === removedTrackData.originalIndex
    );
    if (originalIndexToRemove > -1) {
        originalPlaylist.splice(originalIndexToRemove, 1); // Remove from original
    }

    savePlaylistToLocalStorage(); // Save after a track is removed

    // Adjust currentTrackIndex if necessary
    if (indexToRemove === currentTrackIndex) {
        audioPlayer.pause(); // Stop playback
        stopVisualizer(); // Stop visualizer
        audioPlayer.src = '';
        if (currentObjectURL) {
            URL.revokeObjectURL(currentObjectURL);
            currentObjectURL = null;
        }

        if (playlist.length === 0) {
            currentTrackIndex = -1;
            resetPlayerUI();
        } else {
            // Play the next available track
            currentTrackIndex = indexToRemove % playlist.length;
            playTrack(currentTrackIndex);
        }
    } else if (indexToRemove < currentTrackIndex) {
        currentTrackIndex--; // Adjust index if removed track was before current
    }

    renderPlaylist(); // Update UI
}


/**
 * Resets the player UI when the playlist is empty.
 */
function resetPlayerUI() {
    currentTrackElement.textContent = 'No track selected';
    currentArtistElement.textContent = 'Select files to play';
    currentTimeElement.textContent = '0:00';
    totalDurationElement.textContent = '0:00';
    progress.style.width = '0%';
    updatePlayPauseIcon();
    disableControls(true);
    stopVisualizer(); // Ensure visualizer is stopped
    albumArtPlaceholder.classList.remove('hidden'); // Show placeholder
    playlistElement.innerHTML = '<p class="p-4 text-gray-500 text-center text-sm">Add files to see the playlist.</p>';
}


/**
 * Loads and plays a track by its index in the *current* playlist.
 */
function playTrack(index) {
     // Ensure Audio Context is ready (might need user interaction first)
    if (!audioCtx) {
        setupAudioContext();
    }
     // Attempt to resume context if suspended (autoplay policies)
     if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(err => console.warn("AudioContext resume failed:", err));
    }


    if (index < 0 || index >= playlist.length) {
         console.warn("Attempted to play invalid index:", index);
         if (playlist.length > 0) {
             currentTrackIndex = 0; index = 0;
         } else {
             resetPlayerUI(); return;
         }
    }

    currentTrackIndex = index;
    const trackData = playlist[currentTrackIndex];

    // Check if the file object exists (might be missing if loaded from localStorage)
    if (!trackData.file) {
        const alertMessage = `Track "${trackData.name}" needs to be re-selected. Please add files again to enable playback.`;
        alert(alertMessage);
        const parsedInfo = parseTrackName(trackData.name); // Use .name as fallback
        currentTrackElement.textContent = parsedInfo.title + " (Needs re-selection)";
        currentArtistElement.textContent = parsedInfo.artist;
        stopVisualizer();
        albumArtPlaceholder.classList.remove('hidden');
        updatePlayPauseIcon(); // Ensure play icon is shown
        return;
    }

    const file = trackData.file;

    if (currentObjectURL) { URL.revokeObjectURL(currentObjectURL); } // Clean up previous URL
    currentObjectURL = URL.createObjectURL(file);

    audioPlayer.src = currentObjectURL;
    audioPlayer.load();
    audioPlayer.play()
        .then(() => {
            const filename = trackData.file.name;
            const parsedInfo = parseTrackName(filename);
            currentTrackElement.textContent = parsedInfo.title;
            currentArtistElement.textContent = parsedInfo.artist;
            renderPlaylist();
            // Play/Pause icon updated by 'play' event listener
            // Visualizer started by 'play' event listener
        })
        .catch(error => {
            console.error("Error playing track:", error);
            const filename = trackData.file.name; // Get filename for error message
            const parsedInfo = parseTrackName(filename); // Attempt to parse for consistent display
            currentTrackElement.textContent = `Error loading ${parsedInfo.title}`;
            currentArtistElement.textContent = parsedInfo.artist;
            stopVisualizer(); // Stop visualizer on error
            albumArtPlaceholder.classList.remove('hidden'); // Show placeholder
            if (currentObjectURL) {
                 URL.revokeObjectURL(currentObjectURL);
                 currentObjectURL = null;
            }
        });
}

/**
 * Toggles play/pause state. Also handles initial AudioContext setup on first play.
 */
function togglePlayPause() {
     // --- Crucial for Web Audio API ---
    // Setup/Resume AudioContext on first user interaction (play click)
    if (!audioCtx) {
        setupAudioContext();
    } else if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(err => console.warn("AudioContext resume failed:", err));
    }
    // --- End AudioContext Handling ---

    if (!audioPlayer.src && playlist.length > 0) {
        playTrack(0);
    } else if (audioPlayer.paused) {
        audioPlayer.play().catch(error => console.error("Error resuming playback:", error));
    } else {
        audioPlayer.pause();
    }
}

/** Handles track end based on repeat mode. */
function handleTrackEnd() {
    if (repeatMode === 'one') {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
    } else {
        playNextTrack(); // Handles 'all' and 'none'
    }
}

/** Plays the next track, handling shuffle and repeat. */
function playNextTrack() {
    if (playlist.length === 0) return;
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= playlist.length) {
        if (repeatMode === 'all') {
            nextIndex = 0; // Wrap around
        } else {
            audioPlayer.pause(); // Stop at end if not repeating all
            stopVisualizer();
            currentTrackIndex = -1;
            audioPlayer.currentTime = 0;
            renderPlaylist(); // Update UI (remove highlight)
            updatePlayPauseIcon();
            albumArtPlaceholder.classList.remove('hidden');
            return;
        }
    }
    playTrack(nextIndex);
}

/** Plays the previous track, handling shuffle and repeat. */
function playPreviousTrack() {
    if (playlist.length === 0) return;
    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) {
         if (repeatMode === 'all') {
             prevIndex = playlist.length - 1; // Wrap to end
         } else {
             audioPlayer.currentTime = 0; // Restart current track if not repeating
             return;
         }
    }
    playTrack(prevIndex);
}

/** Toggles shuffle mode. */
function toggleShuffle() {
    isShuffled = !isShuffled;
    updateShuffleButton();
    const currentTrackData = (currentTrackIndex >= 0 && currentTrackIndex < playlist.length)
                           ? playlist[currentTrackIndex]
                           : null;

    if (isShuffled) {
        let shuffled = [...originalPlaylist];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        playlist = shuffled;
    } else {
        playlist = [...originalPlaylist]; // Restore original order
    }
     // Find new index of the currently playing track
     currentTrackIndex = playlist.findIndex(trackData => trackData.originalIndex === currentTrackData?.originalIndex);
     if (currentTrackIndex === -1 && playlist.length > 0) currentTrackIndex = 0; // Fallback

    renderPlaylist(); // Update playlist display
}

/** Cycles through repeat modes. */
function cycleRepeatMode() {
    const repeatIcon = repeatBtn.querySelector('i');
    if (repeatMode === 'none') {
        repeatMode = 'one';
        repeatBtn.title = 'Repeat (One)';
        repeatBtn.classList.add('active');
        repeatIcon.classList.remove('fa-repeat');
        repeatIcon.classList.add('fa-1'); // Append '-1' for FontAwesome 6 repeat-1 icon
    } else if (repeatMode === 'one') {
        repeatMode = 'all';
        repeatBtn.title = 'Repeat (All)';
        repeatBtn.classList.add('active'); // Keep active
        repeatIcon.classList.remove('fa-1');
        repeatIcon.classList.add('fa-repeat'); // Back to standard icon
    } else { // repeatMode === 'all'
        repeatMode = 'none';
        repeatBtn.title = 'Repeat (Off)';
        repeatBtn.classList.remove('active');
        repeatIcon.classList.remove('fa-1'); // Ensure '-1' is removed
        repeatIcon.classList.add('fa-repeat');
    }
     console.log("Repeat mode:", repeatMode);
}

/** Updates shuffle button visual state. */
function updateShuffleButton() {
     if (isShuffled) {
        shuffleBtn.classList.add('active'); shuffleBtn.title = 'Shuffle (On)';
    } else {
        shuffleBtn.classList.remove('active'); shuffleBtn.title = 'Shuffle (Off)';
    }
}

/** Updates progress bar and time display. */
function updateProgress() {
    if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
        const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progress.style.width = `${progressPercent}%`;
        currentTimeElement.textContent = formatTime(audioPlayer.currentTime);
    } else {
         currentTimeElement.textContent = formatTime(audioPlayer.currentTime || 0); // Show current time even if duration unknown
         progress.style.width = '0%';
    }
}

/** Updates total duration display. */
function updateDuration() {
     if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
        totalDurationElement.textContent = formatTime(audioPlayer.duration);
     } else {
         totalDurationElement.textContent = '--:--'; // Indicate unknown duration
     }
}

/** Sets playback position when progress bar is clicked. */
function setProgress(e) {
    // Use getBoundingClientRect for accuracy across browsers/scaling
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left; // Click position relative to container start
    const width = rect.width; // Actual rendered width

    if (audioPlayer.duration && isFinite(audioPlayer.duration) && width > 0) {
        const duration = audioPlayer.duration;
        audioPlayer.currentTime = (clickX / width) * duration;
    }
}

/** Sets audio volume. */
function setVolume() {
    audioPlayer.volume = volumeSlider.value;
}

/** Formats time in seconds to mm:ss. */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

/** Updates play/pause button icon. */
function updatePlayPauseIcon() {
    const icon = playPauseBtn.querySelector('i');
    if (audioPlayer.paused) {
        icon.classList.remove('fa-pause'); icon.classList.add('fa-play');
        playPauseBtn.title = 'Play';
    } else {
        icon.classList.remove('fa-play'); icon.classList.add('fa-pause');
        playPauseBtn.title = 'Pause';
    }
}

/** Disables or enables controls. */
function disableControls(disable) {
    const buttons = [playPauseBtn, prevBtn, nextBtn, shuffleBtn, repeatBtn];
    buttons.forEach(btn => { btn.disabled = disable;
         if (disable) btn.classList.add('opacity-50', 'cursor-not-allowed');
         else btn.classList.remove('opacity-50', 'cursor-not-allowed');
    });
    volumeSlider.disabled = disable;
    progressContainer.style.cursor = disable ? 'default' : 'pointer';
     if (disable) volumeSlider.classList.add('opacity-50', 'cursor-not-allowed');
     else volumeSlider.classList.remove('opacity-50', 'cursor-not-allowed');
}

// --- Initial Setup ---
setupEventListeners(); // Attach all event listeners
resetPlayerUI(); // Set initial UI state
audioPlayer.volume = volumeSlider.value; // Set initial volume
loadPlaylistFromLocalStorage(); // Load playlist from local storage on startup
