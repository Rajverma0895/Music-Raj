// --- App Namespace ---
window.App = window.App || {};

// --- Constants ---
const PLAYLIST_STORAGE_KEY = 'musicPlayerPlaylist';
const MULTIPLE_PLAYLISTS_STORAGE_KEY = 'musicPlayerMultiplePlaylists';
const SHUFFLE_STATE_KEY = 'musicPlayerShuffleState';
const REPEAT_MODE_KEY = 'musicPlayerRepeatMode';
const EQ_SETTINGS_KEY = 'musicPlayerEqSettings';
const VOLUME_SETTINGS_KEY = 'musicPlayerVolumeSettings';
const RECENTLY_PLAYED_KEY = 'musicPlayerRecentlyPlayed';
const MOST_PLAYED_KEY = 'musicPlayerMostPlayed';
const MAX_RECENTLY_PLAYED = 25;

const EQ_FREQUENCIES = [60, 310, 1000, 6000, 12000];
const EQ_PRESETS = {
    'custom': { preamp: 0, bands: [0, 0, 0, 0, 0] },
    'rock':   { preamp: 1, bands: [4, 3, -2, 3, 5] },
    'jazz':   { preamp: 0, bands: [3, 2, -1, 2, 3] },
    'pop':    { preamp: 1, bands: [1, 2, 0, 1, 2] },
    'classical': { preamp: 0, bands: [-1, 0, 0, 1, 2] },
    'flat':   { preamp: 0, bands: [0, 0, 0, 0, 0] }
};

// --- DOM Element Selections ---
const playerContainer = document.querySelector('.player-container'); // Added for file drop
const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const playlistElement = document.getElementById('playlist');
const albumArtDisplay = document.getElementById('albumArtDisplay');
const searchInput = document.getElementById('searchInput');
const currentTrackTitleElement = document.getElementById('currentTrackTitle');
const currentTrackArtistElement = document.getElementById('currentTrackArtist');
const currentTrackAlbumElement = document.getElementById('currentTrackAlbum');
const currentPlaylistTitleHeader = document.getElementById('currentPlaylistTitleHeader');

const playlistSelector = document.getElementById('playlistSelector');
const newPlaylistNameInput = document.getElementById('newPlaylistNameInput');
const createPlaylistBtn = document.getElementById('createPlaylistBtn');
const deletePlaylistBtn = document.getElementById('deletePlaylistBtn');
const loadSelectedPlaylistBtn = document.getElementById('loadSelectedPlaylistBtn');

const preampSlider = document.getElementById('eqPreamp');
const preampValueDisplay = document.getElementById('eqPreampValue');
const eqBandSliders = [];
const eqBandValueDisplays = [];
EQ_FREQUENCIES.forEach((freq, i) => {
    eqBandSliders.push(document.getElementById(`eqBand${i}`));
    eqBandValueDisplays.push(document.getElementById(`eqBand${i}Value`));
});
const eqPresetsSelect = document.getElementById('eqPresets');
const eqOnOffBtn = document.getElementById('eqOnOff');
const muteToggleBtn = document.getElementById('muteToggleBtn');

const genreFilterSelect = document.getElementById('genreFilter');
const yearFilterSelect = document.getElementById('yearFilter');
const clearAdvancedFiltersBtn = document.getElementById('clearAdvancedFiltersBtn');

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
const playQueueListContainer = document.getElementById('playQueueListContainer');
const clearQueueBtn = document.getElementById('clearQueueBtn');
const lyricsContentContainer = document.getElementById('lyricsContentContainer');
const lyricsPlaceholder = document.getElementById('lyricsPlaceholder');

// --- Player State ---
let playlist = [];
let originalPlaylist = [];
let playlists = {};
let activePlaylistName = 'Default';
let currentTrackIndex = -1;
let currentPlayingTrackPath = null;
let currentSearchTerm = '';
let activeGenreFilter = '';
let activeYearFilter = '';
let isShuffled = false;
let repeatMode = 'none';
let currentEqPresetName = 'flat';
let currentObjectURL = null;
let volumeBeforeMute = 1.0;
let recentlyPlayedList = [];
let mostPlayedCounts = {};
let playQueue = [];

let audioCtx;
let analyser;
let source;
let preampGainNode;
let eqBands = [];
let isEqEnabled = true;

let bufferLength;
let dataArray;
let visualizerAnimationId = null;

// Drag and Drop State
let draggedItem = null;
let draggedItemOriginalIndex = -1; // Index in originalPlaylist
let draggedItemPath = null;
let dragInsertionIndicator = null; // DOM element for visual indicator


// --- Event Listener Setup ---
function setupEventListeners() {
    fileInput.addEventListener('change', handleFileSelect);

    audioPlayer.addEventListener('play', () => {
        updatePlayPauseIcon(); startVisualizer();
        albumArtPlaceholder.classList.add('hidden');
        updateMediaSessionPlaybackState();
        if (currentTrackIndex !== -1 && playlist[currentTrackIndex]) {
            logTrackPlay(playlist[currentTrackIndex]);
        }
    });
    audioPlayer.addEventListener('pause', () => {
        updatePlayPauseIcon(); stopVisualizer();
        albumArtPlaceholder.classList.remove('hidden');
        updateMediaSessionPlaybackState();
    });
    audioPlayer.addEventListener('ended', handleTrackEnd);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('loadedmetadata', updateDuration);

    playPauseBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', playPreviousTrack);
    nextBtn.addEventListener('click', playNextTrack);
    shuffleBtn.addEventListener('click', toggleShuffle);
    repeatBtn.addEventListener('click', cycleRepeatMode);

    progressContainer.addEventListener('click', setProgress);
    volumeSlider.addEventListener('input', setVolume);

    createPlaylistBtn.addEventListener('click', createPlaylist);
    deletePlaylistBtn.addEventListener('click', deletePlaylist);
    loadSelectedPlaylistBtn.addEventListener('click', loadSelectedPlaylist);
    playlistSelector.addEventListener('change', loadSelectedPlaylist);

    searchInput.addEventListener('input', handleSearchInput);
    window.addEventListener('keydown', handleKeyboardShortcuts);

    if (muteToggleBtn) muteToggleBtn.addEventListener('click', toggleMute);

    if (preampSlider) {
        preampSlider.addEventListener('input', event => {
            if (!audioCtx || !preampGainNode) return;
            const dbValue = parseFloat(event.target.value);
            preampValueDisplay.textContent = `${dbValue.toFixed(0)} dB`;
            preampGainNode.gain.value = Math.pow(10, dbValue / 20);
            if (!isEqEnabled) { isEqEnabled = true; updateEqOnOffButtonUI(); }
            currentEqPresetName = 'custom';
            if(eqPresetsSelect) eqPresetsSelect.value = 'custom';
            saveEqSettingsToLocalStorage();
        });
    }

    eqBandSliders.forEach((slider, i) => {
        if (slider) {
            slider.addEventListener('input', event => {
                if (!audioCtx || !eqBands[i]) return;
                const dbValue = parseFloat(event.target.value);
                eqBandValueDisplays[i].textContent = `${dbValue.toFixed(0)} dB`;
                eqBands[i].gain.value = dbValue;
                if (!isEqEnabled) { isEqEnabled = true; updateEqOnOffButtonUI(); }
                currentEqPresetName = 'custom';
                if(eqPresetsSelect) eqPresetsSelect.value = 'custom';
                saveEqSettingsToLocalStorage();
            });
        }
    });

    if (eqPresetsSelect) {
        eqPresetsSelect.addEventListener('change', event => {
            if (!isEqEnabled) { isEqEnabled = true; updateEqOnOffButtonUI(); }
            applyEqPreset(event.target.value);
        });
    }

    if (eqOnOffBtn) eqOnOffBtn.addEventListener('click', toggleEqOnOff);

    if (genreFilterSelect) genreFilterSelect.addEventListener('change', handleGenreFilterChange);
    if (yearFilterSelect) yearFilterSelect.addEventListener('change', handleYearFilterChange);
    if (clearAdvancedFiltersBtn) clearAdvancedFiltersBtn.addEventListener('click', clearAdvancedFilters);
    if (clearQueueBtn) {
        clearQueueBtn.addEventListener('click', () => {
            clearQueue();
        });
    }

    if (playlistElement) {
        playlistElement.addEventListener('dragover', handleDragOverPlaylist);
        playlistElement.addEventListener('dragleave', handleDragLeavePlaylist);
        playlistElement.addEventListener('drop', handleDropOnPlaylist);
    }

    // File Drag & Drop Listeners on playerContainer
    if(playerContainer) {
        playerContainer.addEventListener('dragenter', handleFileDragEnter);
        playerContainer.addEventListener('dragover', handleFileDragOver);
        playerContainer.addEventListener('dragleave', handleFileDragLeave);
        playerContainer.addEventListener('drop', handleFileDrop);
    }


    window.addEventListener('resize', () => {});
}

// --- Playlist Management Functions ---
function updatePlaylistSelector() {
    playlistSelector.innerHTML = '';
    if (Object.keys(playlists).length === 0) { playlists['Default'] = []; activePlaylistName = 'Default'; }
    for (const name in playlists) {
        const option = document.createElement('option');
        option.value = name; option.textContent = name;
        if (name === activePlaylistName) option.selected = true;
        playlistSelector.appendChild(option);
    }
    if (currentPlaylistTitleHeader) currentPlaylistTitleHeader.textContent = `${activePlaylistName} - Tracks`;
}

function createPlaylist() {
    const newName = newPlaylistNameInput.value.trim();
    if (!newName) { alert("Playlist name cannot be empty."); return; }
    if (playlists[newName]) { alert(`Playlist "${newName}" already exists.`); return; }
    playlists[newName] = []; activePlaylistName = newName;
    newPlaylistNameInput.value = '';

    activeGenreFilter = ''; activeYearFilter = '';

    updatePlaylistSelector();
    resetPlayerUI();
    populateFilterDropdowns();
    playlistElement.innerHTML = '<p class="p-4 text-gray-500 text-center text-sm">New playlist created. Add files!</p>';
    savePlaylistsToLocalStorage();
}

function deletePlaylist() {
    const selectedName = playlistSelector.value;
    if (!selectedName || Object.keys(playlists).length <= 1) { alert("Cannot delete the last or non-selected playlist."); return; }
    if (confirm(`Are you sure you want to delete the playlist "${selectedName}"?`)) {
        delete playlists[selectedName];
        if (activePlaylistName === selectedName) {
            activePlaylistName = Object.keys(playlists)[0] || 'Default';
            if (!playlists[activePlaylistName] && activePlaylistName === 'Default') playlists['Default'] = [];
        }
        updatePlaylistSelector();
        if (activePlaylistName === Object.keys(playlists)[0] || activePlaylistName === 'Default') loadSelectedPlaylist(true);
        savePlaylistsToLocalStorage();
    }
}

function loadSelectedPlaylist(isAfterDelete = false) {
    const selectedName = playlistSelector.value;
    if (!selectedName || !playlists[selectedName]) {
        activePlaylistName = Object.keys(playlists)[0] || 'Default';
        if (!playlists[activePlaylistName] && activePlaylistName === 'Default') playlists['Default'] = [];
        updatePlaylistSelector(); activePlaylistName = playlistSelector.value;
    } else { activePlaylistName = selectedName; }

    originalPlaylist = playlists[activePlaylistName] || [];
    playlist = isShuffled ? shuffleArray([...originalPlaylist]) : [...originalPlaylist];
    currentTrackIndex = -1;
    currentPlayingTrackPath = null;

    activeGenreFilter = ''; activeYearFilter = '';
    if(genreFilterSelect) genreFilterSelect.value = '';
    if(yearFilterSelect) yearFilterSelect.value = '';

    resetPlayerUI();
    populateFilterDropdowns();
    renderPlaylist();
    updatePlaylistSelector();
    localStorage.setItem('musicPlayerLastActivePlaylist', activePlaylistName);
}

// --- Advanced Filter Functions ---
function populateFilterDropdowns() {
    if (!originalPlaylist || !App.filterLogic || !genreFilterSelect || !yearFilterSelect ) return;

    const genres = App.filterLogic.getUniqueGenres(originalPlaylist);
    const years = App.filterLogic.getUniqueYears(originalPlaylist);

    genreFilterSelect.innerHTML = '<option value="">All Genres</option>';
    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre; option.textContent = genre;
        genreFilterSelect.appendChild(option);
    });
    genreFilterSelect.value = activeGenreFilter;

    yearFilterSelect.innerHTML = '<option value="">All Years</option>';
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year; option.textContent = year;
        yearFilterSelect.appendChild(option);
    });
    yearFilterSelect.value = activeYearFilter;
}

function handleGenreFilterChange(event) {
    activeGenreFilter = event.target.value;
    renderPlaylist();
}

function handleYearFilterChange(event) {
    activeYearFilter = event.target.value;
    renderPlaylist();
}

function clearAdvancedFilters() {
    activeGenreFilter = ''; activeYearFilter = '';
    if (genreFilterSelect) genreFilterSelect.value = '';
    if (yearFilterSelect) yearFilterSelect.value = '';
    renderPlaylist();
}


// --- Local Storage Functions ---
function savePlaylistsToLocalStorage() {
    const storablePlaylists = {};
    for (const listName in playlists) {
        storablePlaylists[listName] = playlists[listName].map(trackData => {
            const { file, ...storableTrackData } = trackData;
            if (storableTrackData.metadata) {
                const { albumArtUrl, ...metadataToStore } = storableTrackData.metadata;
                storableTrackData.metadata = {
                    ...metadataToStore,
                    lyrics: storableTrackData.metadata.lyrics || null
                };
            }
            return storableTrackData;
        });
    }
    localStorage.setItem(MULTIPLE_PLAYLISTS_STORAGE_KEY, JSON.stringify(storablePlaylists));
}

function loadPlaylistsFromLocalStorage() {
    const storedMultiplePlaylists = localStorage.getItem(MULTIPLE_PLAYLISTS_STORAGE_KEY);
    if (storedMultiplePlaylists) {
        try {
            const parsedPlaylists = JSON.parse(storedMultiplePlaylists);
            for (const listName in parsedPlaylists) {
                playlists[listName] = parsedPlaylists[listName].map(track => {
                    if (track.metadata) {
                        track.metadata.albumArtUrl = null;
                        track.metadata.genre = track.metadata.genre || 'Unknown Genre';
                        track.metadata.year = track.metadata.year || 'Unknown Year';
                        track.metadata.lyrics = track.metadata.lyrics || null;
                    } else {
                        track.metadata = {
                            title: parseTrackName(track.name).title,
                            artist: parseTrackName(track.name).artist,
                            album: 'Unknown Album',
                            genre: 'Unknown Genre',
                            year: 'Unknown Year',
                            lyrics: null,
                            albumArtUrl: null
                        };
                    }
                    return track;
                });
            }
            activePlaylistName = localStorage.getItem('musicPlayerLastActivePlaylist') || 'Default';
            if (!playlists[activePlaylistName]) activePlaylistName = Object.keys(playlists)[0] || 'Default';
        } catch (e) {
            console.error("Error parsing multiple playlists from local storage:", e);
            playlists = {};
        }
    }

    if (!playlists[activePlaylistName] || Object.keys(playlists).length === 0) {
        const oldStoredPlaylist = localStorage.getItem(PLAYLIST_STORAGE_KEY);
        if (oldStoredPlaylist && !storedMultiplePlaylists) {
            try {
                const loadedTracks = JSON.parse(oldStoredPlaylist);
                if (loadedTracks?.length) {
                    playlists['Default'] = loadedTracks.map(track => {
                        const { file, metadata, ...rest } = track;
                        const { albumArtUrl, ...storableMetadata } = metadata || {};
                        return {
                            ...rest, name: track.name, path: track.path || track.name,
                            metadata: Object.keys(storableMetadata).length ? {
                                ...storableMetadata,
                                genre: storableMetadata.genre || 'Unknown Genre',
                                year: storableMetadata.year || 'Unknown Year',
                                lyrics: storableMetadata.lyrics || null,
                                albumArtUrl: null
                            } : {
                                title: parseTrackName(track.name).title,
                                artist: parseTrackName(track.name).artist,
                                album: 'Unknown Album',
                                genre: 'Unknown Genre',
                                year: 'Unknown Year',
                                lyrics: null,
                                albumArtUrl: null
                            },
                            file: null
                        };
                    });
                }
            } catch (e) { console.error("Error migrating old playlist:", e); }
        }
        activePlaylistName = 'Default';
    }

    if (!playlists[activePlaylistName] || Object.keys(playlists).length === 0) {
        playlists['Default'] = []; activePlaylistName = 'Default';
    }
}


function saveEqSettingsToLocalStorage() {
    if (!preampSlider || eqBandSliders.some(s => !s)) return;
    const settingsToSave = {
        currentPresetName: currentEqPresetName, isEnabled: isEqEnabled,
        preamp: preampSlider.value, bands: eqBandSliders.map(s => s.value)
    };
    localStorage.setItem(EQ_SETTINGS_KEY, JSON.stringify(settingsToSave));
}

function loadEqSettings() {
    currentEqPresetName = 'flat'; isEqEnabled = true;
    let initialPreampDb = 0; let initialBandDbs = EQ_FREQUENCIES.map(() => 0);
    const storedEqSettingsJson = localStorage.getItem(EQ_SETTINGS_KEY);
    if (storedEqSettingsJson) {
        try {
            const storedEqSettings = JSON.parse(storedEqSettingsJson);
            currentEqPresetName = storedEqSettings.currentPresetName || 'flat';
            isEqEnabled = typeof storedEqSettings.isEnabled === 'boolean' ? storedEqSettings.isEnabled : true;
            initialPreampDb = parseFloat(storedEqSettings.preamp) || 0;
            if (storedEqSettings.bands?.length === EQ_FREQUENCIES.length) {
                initialBandDbs = storedEqSettings.bands.map(val => parseFloat(val) || 0);
            }
        } catch (e) { console.error("Error parsing EQ settings:", e); }
    }
    if (preampSlider) preampSlider.value = initialPreampDb;
    initialBandDbs.forEach((db, i) => { if (eqBandSliders[i]) eqBandSliders[i].value = db; });
    if (eqPresetsSelect) eqPresetsSelect.value = currentEqPresetName;
}

function saveVolumeSettings() {
    if (!audioPlayer) return;
    const volumeSettings = { level: audioPlayer.volume, volumeBeforeMute: volumeBeforeMute };
    localStorage.setItem(VOLUME_SETTINGS_KEY, JSON.stringify(volumeSettings));
}

function loadVolumeSettings() {
    let initialVolume = 1.0;
    const storedVolumeSettingsJson = localStorage.getItem(VOLUME_SETTINGS_KEY);
    if (storedVolumeSettingsJson) {
        try {
            const s = JSON.parse(storedVolumeSettingsJson);
            initialVolume = typeof s.level === 'number' ? s.level : 1.0;
            volumeBeforeMute = typeof s.volumeBeforeMute === 'number' ? s.volumeBeforeMute : 1.0;
        } catch(e) { console.error("Error parsing volume settings:", e); }
    }
    audioPlayer.volume = initialVolume;
    if (volumeSlider) volumeSlider.value = initialVolume;
}

// --- Play History Functions ---
function loadPlayHistory() {
    const storedRecentlyPlayed = localStorage.getItem(RECENTLY_PLAYED_KEY);
    if (storedRecentlyPlayed) {
        try { recentlyPlayedList = JSON.parse(storedRecentlyPlayed); }
        catch (e) { console.error("Error parsing recently played list:", e); recentlyPlayedList = []; }
    } else {
        recentlyPlayedList = [];
    }
    const storedMostPlayed = localStorage.getItem(MOST_PLAYED_KEY);
    if (storedMostPlayed) {
        try { mostPlayedCounts = JSON.parse(storedMostPlayed); }
        catch (e) { console.error("Error parsing most played counts:", e); mostPlayedCounts = {};}
    } else {
        mostPlayedCounts = {};
    }
}

function savePlayHistory() {
    localStorage.setItem(RECENTLY_PLAYED_KEY, JSON.stringify(recentlyPlayedList));
    localStorage.setItem(MOST_PLAYED_KEY, JSON.stringify(mostPlayedCounts));
}

function logTrackPlay(trackData) {
    if (!trackData || !trackData.path) {
        console.warn("Attempted to log play for track with no path:", trackData);
        return;
    }
    const trackId = trackData.path;

    recentlyPlayedList = recentlyPlayedList.filter(id => id !== trackId);
    recentlyPlayedList.unshift(trackId);
    if (recentlyPlayedList.length > MAX_RECENTLY_PLAYED) {
        recentlyPlayedList.length = MAX_RECENTLY_PLAYED;
    }

    mostPlayedCounts[trackId] = (mostPlayedCounts[trackId] || 0) + 1;

    savePlayHistory();
    displayRecentlyPlayed();
    displayMostPlayed();
}

// --- Play Queue Functions ---
function addToQueue(trackPath) {
    if (!trackPath) return;
    if (playQueue.includes(trackPath)) {
        return;
    }
    playQueue.push(trackPath);
    displayPlayQueue();
}

function removeFromQueue(trackPathToRemove) {
    playQueue = playQueue.filter(path => path !== trackPathToRemove);
    displayPlayQueue();
}

function clearQueue() {
    playQueue = [];
    displayPlayQueue();
}

function getNextFromQueue() {
    if (playQueue.length === 0) {
        return null;
    }
    const nextTrackPath = playQueue.shift();
    displayPlayQueue();
    return nextTrackPath;
}

// --- Play Queue UI Functions ---
function displayPlayQueue() {
    const container = playQueueListContainer;
    if (!container) return;
    container.innerHTML = '';

    if (playQueue.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-2">Queue is empty.</p>';
        return;
    }

    playQueue.forEach((trackPath, index) => {
        const trackInfo = findTrackDataByPath(trackPath);
        if (trackInfo) {
            const listItem = document.createElement('div');
            listItem.className = 'flex justify-between items-center p-1.5 hover:bg-indigo-100 dark:hover:bg-gray-700 rounded group';

            const trackDetailsSpan = document.createElement('span');
            const title = trackInfo.metadata?.title || trackInfo.name;
            const artist = trackInfo.metadata?.artist || 'Unknown Artist';
            trackDetailsSpan.textContent = `${index + 1}. ${title} - ${artist}`;
            trackDetailsSpan.className = 'truncate text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300';
            trackDetailsSpan.title = `${title} - ${artist} (${trackInfo.path})`;
            listItem.appendChild(trackDetailsSpan);

            const removeFromQueueBtn = document.createElement('button');
            removeFromQueueBtn.innerHTML = '<i class="fas fa-times-circle"></i>';
            removeFromQueueBtn.title = 'Remove from Queue';
            removeFromQueueBtn.className = 'remove-from-queue-btn text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 text-xs ml-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity';
            removeFromQueueBtn.onclick = (event) => {
                event.stopPropagation();
                removeFromQueue(trackPath);
            };
            listItem.appendChild(removeFromQueueBtn);
            container.appendChild(listItem);
        } else {
            const listItem = document.createElement('div');
            listItem.className = 'p-1.5 text-gray-400 dark:text-gray-500';
            listItem.textContent = `${index + 1}. Track info not found for: ${trackPath}`;
            container.appendChild(listItem);
        }
    });
}

// --- Recently Played UI Functions ---
function findTrackDataByPath(trackPath) {
    for (const playlistName in playlists) {
        const trackList = playlists[playlistName];
        if (Array.isArray(trackList)) {
            const foundTrack = trackList.find(track => track.path === trackPath);
            if (foundTrack) {
                return {
                    name: foundTrack.name,
                    path: foundTrack.path,
                    metadata: foundTrack.metadata ? { ...foundTrack.metadata } : null,
                };
            }
        }
    }
    return null;
}

function playTrackFromHistory(trackPath) {
    let foundInPlaylist = null;
    for (const playlistName in playlists) {
        const trackList = playlists[playlistName];
        if (Array.isArray(trackList)) {
            const TmpTrackIndex = trackList.findIndex(track => track.path === trackPath);
            if (TmpTrackIndex !== -1) {
                foundInPlaylist = playlistName;
                break;
            }
        }
    }

    if (foundInPlaylist) {
        if (activePlaylistName !== foundInPlaylist) {
            activePlaylistName = foundInPlaylist;
            if(playlistSelector) playlistSelector.value = activePlaylistName;
            loadSelectedPlaylist();
        }
        const actualTrackIndex = playlist.findIndex(track => track.path === trackPath);
        if (actualTrackIndex !== -1) {
            playTrack(actualTrackIndex);
        } else {
            alert('Track found in playlist records, but requires re-selection or might be missing. Please ensure the source files are accessible.');
            const trackInfoForAlert = findTrackDataByPath(trackPath);
            if (trackInfoForAlert) {
                 currentTrackTitleElement.textContent = (trackInfoForAlert.metadata?.title || trackInfoForAlert.name) + " (Needs re-selection)";
                 currentTrackArtistElement.textContent = trackInfoForAlert.metadata?.artist || "Unknown Artist";
                 currentTrackAlbumElement.textContent = trackInfoForAlert.metadata?.album || "Unknown Album";
            }
        }
    } else {
        alert('Could not find this track in any saved playlist. It might have been moved or deleted.');
    }
}

function displayRecentlyPlayed() {
    const container = document.getElementById('recentlyPlayedListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!recentlyPlayedList || recentlyPlayedList.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-2">No tracks played recently.</p>';
        return;
    }

    let itemsAdded = 0;
    recentlyPlayedList.forEach(trackPath => {
        const trackInfo = findTrackDataByPath(trackPath);
        if (trackInfo) {
            const listItem = document.createElement('div');
            listItem.className = 'flex justify-between items-center p-1.5 hover:bg-indigo-100 dark:hover:bg-gray-700 rounded group';

            const textSpan = document.createElement('span');
            const title = trackInfo.metadata?.title || trackInfo.name;
            const artist = trackInfo.metadata?.artist || 'Unknown Artist';
            textSpan.textContent = `${title} - ${artist}`;
            textSpan.className = 'truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 cursor-pointer';
            textSpan.title = `${title} - ${artist} (${trackInfo.path})`;
            textSpan.onclick = () => playTrackFromHistory(trackPath);
            listItem.appendChild(textSpan);

            const addToQueueBtn = document.createElement('button');
            addToQueueBtn.innerHTML = '<i class="fas fa-plus-circle"></i>';
            addToQueueBtn.title = 'Add to Queue';
            addToQueueBtn.className = 'add-to-queue-btn text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs ml-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity';
            addToQueueBtn.onclick = (event) => {
                event.stopPropagation();
                addToQueue(trackInfo.path);
            };
            listItem.appendChild(addToQueueBtn);

            container.appendChild(listItem);
            itemsAdded++;
        }
    });

    if (itemsAdded === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-2">Recently played tracks not found in current playlists.</p>';
    }
}

// --- Most Played UI Functions ---
function displayMostPlayed() {
    const container = document.getElementById('mostPlayedListContainer');
    if (!container) return;
    container.innerHTML = '';

    const MAX_MOST_PLAYED_DISPLAY = 15;

    if (Object.keys(mostPlayedCounts).length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-2">Play some tracks to see your most played!</p>';
        return;
    }

    const sortedMostPlayed = Object.entries(mostPlayedCounts).sort(([,aCount], [,bCount]) => bCount - aCount);
    const topMostPlayed = sortedMostPlayed.slice(0, MAX_MOST_PLAYED_DISPLAY);

    let itemsAdded = 0;
    topMostPlayed.forEach(([trackPath, count]) => {
        const trackInfo = findTrackDataByPath(trackPath);
        if (trackInfo) {
            const listItem = document.createElement('div');
            listItem.className = 'flex justify-between items-center p-1.5 hover:bg-indigo-100 dark:hover:bg-gray-700 rounded group';

            const textSpan = document.createElement('span');
            const title = trackInfo.metadata?.title || trackInfo.name;
            const artist = trackInfo.metadata?.artist || 'Unknown Artist';
            textSpan.textContent = `${title} - ${artist} (Played: ${count} times)`;
            textSpan.className = 'truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 cursor-pointer';
            textSpan.title = `${title} - ${artist} (Played: ${count} times) - ${trackInfo.path}`;
            textSpan.onclick = () => playTrackFromHistory(trackPath);
            listItem.appendChild(textSpan);

            const addToQueueBtn = document.createElement('button');
            addToQueueBtn.innerHTML = '<i class="fas fa-plus-circle"></i>';
            addToQueueBtn.title = 'Add to Queue';
            addToQueueBtn.className = 'add-to-queue-btn text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs ml-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity';
            addToQueueBtn.onclick = (event) => {
                event.stopPropagation();
                addToQueue(trackInfo.path);
            };
            listItem.appendChild(addToQueueBtn);

            container.appendChild(listItem);
            itemsAdded++;
        }
    });

    if (itemsAdded === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-2">Most played tracks not found in current playlists.</p>';
    }
}


// --- EQ and UI Update Functions ---
function updateEqOnOffButtonUI() {
    if (!eqOnOffBtn) return;
    if (isEqEnabled) {
        eqOnOffBtn.innerHTML = '<i class="fas fa-power-off"></i> ON';
        eqOnOffBtn.classList.add('bg-indigo-500', 'hover:bg-indigo-600');
        eqOnOffBtn.classList.remove('bg-gray-500', 'hover:bg-gray-600');
        eqOnOffBtn.title = "Turn EQ Off";
    } else {
        eqOnOffBtn.innerHTML = '<i class="fas fa-power-off"></i> OFF';
        eqOnOffBtn.classList.add('bg-gray-500', 'hover:bg-gray-600');
        eqOnOffBtn.classList.remove('bg-indigo-500', 'hover:bg-indigo-600');
        eqOnOffBtn.title = "Turn EQ On";
    }
}

function toggleEqOnOff() {
    isEqEnabled = !isEqEnabled;
    if (isEqEnabled) applyEqPreset(currentEqPresetName);
    else {
        if (preampGainNode) preampGainNode.gain.value = 1.0;
        eqBands.forEach(filter => { if (filter) filter.gain.value = 0; });
        updateAllEqUIDisplays();
    }
    updateEqOnOffButtonUI(); saveEqSettingsToLocalStorage();
}

function applyEqPreset(presetName) {
    const preset = EQ_PRESETS[presetName];
    if (!preset) { applyEqPreset('flat'); return; }
    if (!audioCtx || !preampGainNode || eqBands.length !== EQ_FREQUENCIES.length) return;
    preampGainNode.gain.value = Math.pow(10, preset.preamp / 20);
    preset.bands.forEach((bandDb, i) => { if (eqBands[i]) eqBands[i].gain.value = bandDb; });
    currentEqPresetName = presetName;
    if (eqPresetsSelect.value !== presetName) eqPresetsSelect.value = presetName;
    updateAllEqUIDisplays(); saveEqSettingsToLocalStorage();
}

function updateAllEqUIDisplays() {
    if (preampGainNode && preampSlider && preampValueDisplay) {
        const currentGainFactor = preampGainNode.gain.value;
        const dbValue = currentGainFactor === 0 ? -Infinity : 20 * Math.log10(currentGainFactor);
        const sliderMin = parseFloat(preampSlider.min); const sliderMax = parseFloat(preampSlider.max);
        const clampedDbValue = Math.max(sliderMin, Math.min(sliderMax, dbValue));
        preampSlider.value = clampedDbValue.toFixed(0);
        preampValueDisplay.textContent = `${clampedDbValue.toFixed(0)} dB`;
    }
    eqBands.forEach((filterNode, i) => {
        if (eqBandSliders[i] && eqBandValueDisplays[i]) {
            const dbValue = filterNode.gain.value;
            eqBandSliders[i].value = dbValue.toFixed(0);
            eqBandValueDisplays[i].textContent = `${dbValue.toFixed(0)} dB`;
        }
    });
}

// --- Utility Functions ---
function shuffleArray(array) {
    let newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function isAudioFile(filename) {
    if (!filename) return false;
    const supportedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
    return supportedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

function parseTrackName(filename) {
    if (!filename) return { artist: 'Unknown Artist', title: 'Unknown Title' };
    const nameWithoutExtension = filename.substring(0, filename.lastIndexOf('.')) || filename;
    const parts = nameWithoutExtension.split(' - ');
    if (parts.length === 2) {
        const artist = parts[0].trim(); const title = parts[1].trim();
        if (artist && title) return { artist, title };
    }
    return { artist: 'Unknown Artist', title: nameWithoutExtension.trim() };
}

function getTrackMetadata(fileObject) {
    return new Promise((resolve) => {
        if (!fileObject) {
            resolve({
                ...parseTrackName(''),
                album: 'Unknown Album',
                genre: 'Unknown Genre',
                year: 'Unknown Year',
                lyrics: null,
                albumArtUrl: null
            });
            return;
        }
        window.jsmediatags.read(fileObject, {
            onSuccess: (tag) => {
                const tags = tag.tags;
                let title = tags.title;
                let artist = tags.artist;
                const album = tags.album || 'Unknown Album';
                const genre = tags.genre || 'Unknown Genre';
                const yearTag = tags.year || tags.TYER?.data || tags.TDRC?.data;
                const year = yearTag ? String(yearTag).substring(0, 4) : 'Unknown Year';
                let albumArtUrl = null;
                let lyricsString = null;

                const lyricsData = tags.lyrics || tags.LYR || tags.USLT;
                if (lyricsData) {
                    if (typeof lyricsData === 'string') {
                        lyricsString = lyricsData;
                    } else if (lyricsData.lyrics) {
                        lyricsString = lyricsData.lyrics;
                    } else if (lyricsData.text) {
                        lyricsString = lyricsData.text;
                    } else if (lyricsData.data && typeof lyricsData.data === 'string') {
                        lyricsString = lyricsData.data;
                    }
                }

                if (!title) {
                    const parsedName = parseTrackName(fileObject.name); title = parsedName.title;
                    if (!artist && parsedName.artist !== 'Unknown Artist') artist = parsedName.artist;
                }
                if (!artist) artist = 'Unknown Artist';
                if (tags.picture) {
                    try {
                        const image = tags.picture; let base64String = "";
                        for (let i = 0; i < image.data.length; i++) base64String += String.fromCharCode(image.data[i]);
                        albumArtUrl = `data:${image.format};base64,${window.btoa(base64String)}`;
                    } catch (e) { console.error("Error processing album art:", e); albumArtUrl = null; }
                }
                resolve({ title, artist, album, genre, year, lyrics: lyricsString, albumArtUrl });
            },
            onError: (error) => {
                const parsedName = parseTrackName(fileObject.name);
                resolve({
                    ...parsedName,
                    album: 'Unknown Album',
                    genre: 'Unknown Genre',
                    year: 'Unknown Year',
                    lyrics: null,
                    albumArtUrl: null
                });
            }
        });
    });
}

// --- Core Audio Setup & Playback ---
function setupAudioContext() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser(); analyser.fftSize = 256;
        if (!source) source = audioCtx.createMediaElementSource(audioPlayer);
        preampGainNode = audioCtx.createGain(); preampGainNode.gain.value = 1.0;
        eqBands = [];
        EQ_FREQUENCIES.forEach(freq => {
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'peaking'; filter.frequency.value = freq;
            filter.Q.value = 1; filter.gain.value = 0;
            eqBands.push(filter);
        });
        let currentNode = source;
        currentNode.connect(preampGainNode); currentNode = preampGainNode;
        eqBands.forEach(filter => { currentNode.connect(filter); currentNode = filter; });
        currentNode.connect(analyser); analyser.connect(audioCtx.destination);
        bufferLength = analyser.frequencyBinCount; dataArray = new Uint8Array(bufferLength);
    } catch (e) { console.error("Error setting up Audio Context:", e); alert("Web Audio API setup failed."); }
}

function startVisualizer() {
    if (!audioCtx || visualizerAnimationId) return;
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(e => console.warn("Ctx resume fail (visualizer):", e));
    drawVisualizer();
}

function stopVisualizer() {
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
        visualizerAnimationId = null;
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function drawVisualizer() {
    if (!analyser) return;
    visualizerAnimationId = requestAnimationFrame(drawVisualizer);
    analyser.getByteFrequencyData(dataArray);
    canvasCtx.fillStyle = 'rgba(0,0,0,0)';
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / bufferLength) * 2;
    let barHeight; let x = 0;
    const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#a78bfa'); gradient.addColorStop(0.5, '#818cf8'); gradient.addColorStop(1, '#60a5fa');
    for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] * (canvas.height / 255) * 0.8;
        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}

// --- File Handling & Playlist Rendering ---
function handleFileSelect(event) {
    const files = event.target.files;
    if (!files.length) return;
    processFilesForPlaylist(Array.from(files));
    fileInput.value = ""; // Reset file input
}

// --- Drag and Drop Handler Functions ---
let dragOverTarget = null; // Keep track of the element being dragged over for file drop styling

function handleFileDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();
    dragOverTarget = event.target; // Store the initial target
    if(playerContainer) playerContainer.classList.add('file-drag-over');
}

function handleFileDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
}

function handleFileDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    // Only remove class if leaving the container entirely, not just moving over child elements
    if (event.target === dragOverTarget || event.target === playerContainer) {
        if(playerContainer) playerContainer.classList.remove('file-drag-over');
    }
}

function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    if(playerContainer) playerContainer.classList.remove('file-drag-over');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processFilesForPlaylist(Array.from(files));
    }
}

function processFilesForPlaylist(filesArray) {
    activeGenreFilter = ''; activeYearFilter = '';
    if(genreFilterSelect) genreFilterSelect.value = '';
    if(yearFilterSelect) yearFilterSelect.value = '';

    const newAudioFilesData = [];
    const existingTracksCount = originalPlaylist.length;

    filesArray.forEach(file => {
        if (isAudioFile(file.name)) {
            newAudioFilesData.push({
                file: file,
                name: file.name,
                // For dropped files, webkitRelativePath is usually empty or just the filename.
                // Using just file.name as path for dropped files ensures some uniqueness if multiple files with same name dropped from different folders (though this case is not fully handled by path alone).
                path: file.name,
                originalIndex: -1,
                metadata: null
            });
        }
    });

    if (newAudioFilesData.length > 0) {
        newAudioFilesData.forEach((trackData) => {
            trackData.originalIndex = originalPlaylist.length;
            originalPlaylist.push(trackData);
        });

        // Update the main `playlists` object correctly for persistence
        // This should map to a storable version (without File objects)
        const storableTracksForActivePlaylist = originalPlaylist.map((track, index) => {
            const { file, ...storableData } = track; // Exclude File object for storage
            storableData.originalIndex = index; // Ensure originalIndex is updated
             if (storableData.metadata) { // Ensure lyrics are part of storable metadata
                storableData.metadata.lyrics = storableData.metadata.lyrics || null;
            }
            return storableData;
        });
        playlists[activePlaylistName] = storableTracksForActivePlaylist;
        savePlaylistsToLocalStorage(); // Save the updated playlists map

        if (isShuffled) {
            playlist = shuffleArray([...originalPlaylist]);
             if (currentPlayingTrackPath) { // Maintain current track if shuffle is on
                currentTrackIndex = playlist.findIndex(t => t.path === currentPlayingTrackPath);
            }
        } else {
            playlist = [...originalPlaylist];
        }

        renderPlaylist();
        populateFilterDropdowns();

        if (existingTracksCount === 0 && playlist.length > 0 && (currentTrackIndex === -1 || !audioPlayer.src)) {
            playTrack(0);
        } else if (playlist.length > 0 && (currentTrackIndex === -1 || !audioPlayer.src)) {
            // Optionally play the first of the newly added tracks if nothing was playing
            // This might require finding the index of the first new track.
            // For simplicity, we can just ensure something plays if the player was idle.
            // playTrack(existingTracksCount); // This would play the first of the new files
        }
    } else {
        alert("No valid audio files found in the dropped items.");
    }
}


// --- Drag and Drop Handler Functions for Playlist Reordering ---
let draggedItemPath = null;

function handleDragStart(event) {
    draggedItem = event.target.closest('.playlist-item');
    if (!draggedItem || !draggedItem.dataset.index) {
        event.preventDefault();
        return;
    }

    draggedItemOriginalIndex = parseInt(draggedItem.dataset.index, 10);

    if (isNaN(draggedItemOriginalIndex) || draggedItemOriginalIndex < 0 || draggedItemOriginalIndex >= originalPlaylist.length) {
        draggedItem = null;
        event.preventDefault();
        return;
    }

    draggedItemPath = originalPlaylist[draggedItemOriginalIndex].path;

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedItemPath);
    setTimeout(() => {
        if(draggedItem) draggedItem.classList.add('dragging');
    }, 0);
}

function handleDragEnd(event) {
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
    }
    if (dragInsertionIndicator) {
        dragInsertionIndicator.remove();
        dragInsertionIndicator = null;
    }
    draggedItem = null;
    draggedItemOriginalIndex = -1;
    draggedItemPath = null;
}

function handleDragOverItem(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const targetItem = event.target.closest('.playlist-item');
    if (dragInsertionIndicator) {
        dragInsertionIndicator.remove();
        dragInsertionIndicator = null;
    }

    if (targetItem && targetItem !== draggedItem) {
        const rect = targetItem.getBoundingClientRect();
        const isAfter = event.clientY > rect.top + rect.height / 2;

        dragInsertionIndicator = document.createElement('div');
        dragInsertionIndicator.className = 'drag-insertion-indicator';

        if (isAfter) {
            targetItem.parentNode.insertBefore(dragInsertionIndicator, targetItem.nextSibling);
        } else {
            targetItem.parentNode.insertBefore(dragInsertionIndicator, targetItem);
        }
    }
}

function handleDragEnterItem(event) {
    event.preventDefault();
}

function handleDragLeaveItem(event) {
    const item = event.target.closest('.playlist-item');
    // Check if the drag is leaving to an element that is not part of an item or the indicator itself.
    // This helps prevent flickering of the indicator when moving over text/buttons inside a list item.
    if (item && !item.contains(event.relatedTarget) && event.relatedTarget !== dragInsertionIndicator) {
        if (dragInsertionIndicator && dragInsertionIndicator.parentNode === item.parentNode) {
            // Only remove if relatedTarget is truly outside this item's general drop zone context
        }
    }
}

function handleDropOnItem(event) {
    event.preventDefault();
    if (!draggedItem || draggedItemOriginalIndex === -1 || !draggedItemPath) return;

    const targetItem = event.target.closest('.playlist-item');
    if (!targetItem || targetItem === draggedItem) {
      if (dragInsertionIndicator) { dragInsertionIndicator.remove(); dragInsertionIndicator = null; }
      return;
    }

    const targetItemOriginalPlaylistIndex = parseInt(targetItem.dataset.index, 10);

    if (isNaN(targetItemOriginalPlaylistIndex) || targetItemOriginalPlaylistIndex < 0 || targetItemOriginalPlaylistIndex >= originalPlaylist.length) {
        if (dragInsertionIndicator) { dragInsertionIndicator.remove(); dragInsertionIndicator = null; }
        return;
    }

    if (draggedItemOriginalIndex === targetItemOriginalPlaylistIndex) {
        if (dragInsertionIndicator) { dragInsertionIndicator.remove(); dragInsertionIndicator = null; }
        return;
    }

    const rect = targetItem.getBoundingClientRect();
    const dropBeforeTarget = event.clientY < rect.top + rect.height / 2;

    const trackToMove = originalPlaylist.splice(draggedItemOriginalIndex, 1)[0];
    if (!trackToMove) {
        if (dragInsertionIndicator) { dragInsertionIndicator.remove(); dragInsertionIndicator = null; }
        return;
    }

    let finalTargetIndex;
    if (dropBeforeTarget) {
        finalTargetIndex = (draggedItemOriginalIndex < targetItemOriginalPlaylistIndex) ? targetItemOriginalPlaylistIndex - 1 : targetItemOriginalPlaylistIndex;
    } else {
        finalTargetIndex = (draggedItemOriginalIndex < targetItemOriginalPlaylistIndex) ? targetItemOriginalPlaylistIndex : targetItemOriginalPlaylistIndex + 1;
    }

    originalPlaylist.splice(finalTargetIndex, 0, trackToMove);

    if (dragInsertionIndicator) { dragInsertionIndicator.remove(); dragInsertionIndicator = null; }
    finalizeTrackReorder();
}

function handleDragOverPlaylist(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (dragInsertionIndicator) {
        dragInsertionIndicator.remove();
        dragInsertionIndicator = null;
    }
    const directTarget = event.target;
    if ((directTarget === playlistElement || directTarget.id === 'playlist') && draggedItem) {
        const children = Array.from(playlistElement.children).filter(c => c.classList.contains('playlist-item') && c !== draggedItem);
        if (children.length > 0) {
            const lastChildRect = children[children.length -1].getBoundingClientRect();
            if (event.clientY > lastChildRect.bottom) {
                dragInsertionIndicator = document.createElement('div');
                dragInsertionIndicator.className = 'drag-insertion-indicator';
                playlistElement.appendChild(dragInsertionIndicator);
            }
        } else if (children.length === 0) {
             dragInsertionIndicator = document.createElement('div');
             dragInsertionIndicator.className = 'drag-insertion-indicator';
             playlistElement.appendChild(dragInsertionIndicator);
        }
    }
}

function handleDragLeavePlaylist(event) {
    if (event.target === playlistElement && !playlistElement.contains(event.relatedTarget) && dragInsertionIndicator) {
        dragInsertionIndicator.remove();
        dragInsertionIndicator = null;
    }
}

function handleDropOnPlaylist(event) {
    event.preventDefault();
    if (!draggedItem || draggedItemOriginalIndex === -1 || !draggedItemPath) return;

    const isDirectlyOnPlaylist = event.target === playlistElement || event.target.id === 'playlist';
    const isIndicatorPresentAtEndOfList = !!dragInsertionIndicator && dragInsertionIndicator.parentNode === playlistElement && !dragInsertionIndicator.previousSibling;

    if (isDirectlyOnPlaylist && isIndicatorPresentAtEndOfList) {
        const trackToMove = originalPlaylist.splice(draggedItemOriginalIndex, 1)[0];
        if (!trackToMove) {
             if (dragInsertionIndicator) { dragInsertionIndicator.remove(); dragInsertionIndicator = null; }
            return;
        }
        originalPlaylist.push(trackToMove);
        if (dragInsertionIndicator) { dragInsertionIndicator.remove(); dragInsertionIndicator = null; }
        finalizeTrackReorder();
    }
}


function finalizeTrackReorder() {
    originalPlaylist.forEach((track, index) => {
        // track.originalIndex = index; // This line was here, but originalIndex should reflect its position in the *stored* playlist, not the in-memory one if they differ.
                                       // Let's ensure originalIndex is set correctly when playlists are saved/loaded.
                                       // For now, `renderPlaylist` uses `findIndex` on `originalPlaylist` to get the true index for `dataset.index`
    });

    const newStorablePlaylist = originalPlaylist.map((track, index) => {
        const storableTrack = {
            name: track.file ? track.file.name : track.name,
            path: track.path,
            originalIndex: index,
            metadata: track.metadata ? { ...track.metadata } : undefined
        };
        if (storableTrack.metadata) delete storableTrack.metadata.albumArtUrl;

        // Update the in-memory originalPlaylist items to have the correct originalIndex
        // and ensure File objects are there if they exist on the track object being processed.
        originalPlaylist[index].originalIndex = index;
        if(track.file) originalPlaylist[index].file = track.file;


        const {file, ...forStorage} = originalPlaylist[index]; // Strip file for storage
        return forStorage;
    });

    playlists[activePlaylistName] = newStorablePlaylist; // This is now the storable version
    savePlaylistsToLocalStorage(); // This saves the current state of 'playlists'


    if (isShuffled) {
        isShuffled = false;
        updateShuffleButton();
        localStorage.setItem(SHUFFLE_STATE_KEY, JSON.stringify(isShuffled));
    }
    playlist = [...originalPlaylist];

    if (currentPlayingTrackPath) {
        currentTrackIndex = playlist.findIndex(track => track.path === currentPlayingTrackPath);
    } else {
        currentTrackIndex = -1;
    }

    renderPlaylist();

    if (draggedItem) draggedItem.classList.remove('dragging');
    if (dragInsertionIndicator) { dragInsertionIndicator.remove(); dragInsertionIndicator = null; }
    draggedItem = null;
    draggedItemOriginalIndex = -1;
    draggedItemPath = null;
}


// --- Main Playlist Rendering ---
function renderPlaylist() {
    playlistElement.innerHTML = '';
    const searchTerm = currentSearchTerm.toLowerCase();

    let listToRenderForDisplay = isShuffled ? playlist : originalPlaylist;

    let tracksToDisplay = [...listToRenderForDisplay];

    if (searchTerm) {
        tracksToDisplay = tracksToDisplay.filter(trackData => {
            const title = trackData.metadata?.title?.toLowerCase() || '';
            const artist = trackData.metadata?.artist?.toLowerCase() || '';
            const album = trackData.metadata?.album?.toLowerCase() || '';
            const filename = (trackData.file ? trackData.file.name : trackData.name)?.toLowerCase() || '';
            return title.includes(searchTerm) || artist.includes(searchTerm) || album.includes(searchTerm) || filename.includes(searchTerm);
        });
    }

    if (App.filterLogic && (activeGenreFilter || activeYearFilter)) {
        const advancedFilterCriteria = { genre: activeGenreFilter, year: activeYearFilter };
        tracksToDisplay = App.filterLogic.applyAdvancedFilters(tracksToDisplay, advancedFilterCriteria);
    }

    if (tracksToDisplay.length === 0) {
        let message = '<p class="p-4 text-gray-500 text-center text-sm">No tracks match your criteria.</p>';
        if (!searchTerm && !activeGenreFilter && !activeYearFilter && listToRenderForDisplay.length === 0) {
            message = '<p class="p-4 text-gray-500 text-center text-sm">Playlist empty. Add music.</p>';
        }
        playlistElement.innerHTML = message;
        disableControls(listToRenderForDisplay.length === 0);
        return;
    }
    disableControls(false);

    tracksToDisplay.forEach((trackDataFromDisplayList) => {
        const originalPlaylistIndex = originalPlaylist.findIndex(t => t.path === trackDataFromDisplayList.path);
        if (originalPlaylistIndex === -1) {
            // This can happen if originalPlaylist was modified but trackDataFromDisplayList is from an older 'playlist' state
            // For robustness, one might skip or log. For now, assume consistency after reorder/shuffle.
            // console.warn("Render: Could not find track in originalPlaylist:", trackDataFromDisplayList.path);
            // return;
        }

        const listItem = document.createElement('div');
        listItem.className = 'playlist-item p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center text-sm hover:bg-indigo-100 dark:hover:bg-gray-600 group';
        // Use originalPlaylistIndex if found, otherwise use the index from tracksToDisplay (less ideal for stable DnD but better than error)
        listItem.dataset.index = originalPlaylistIndex !== -1 ? originalPlaylistIndex : tracksToDisplay.indexOf(trackDataFromDisplayList);
        listItem.draggable = true;

        listItem.addEventListener('dragstart', handleDragStart);
        listItem.addEventListener('dragend', handleDragEnd);
        listItem.addEventListener('dragenter', handleDragEnterItem);
        listItem.addEventListener('dragleave', handleDragLeaveItem);
        listItem.addEventListener('dragover', handleDragOverItem);
        listItem.addEventListener('drop', handleDropOnItem);

        const trackNameSpan = document.createElement('span');
        let nameToDisplay = trackDataFromDisplayList.file ? trackDataFromDisplayList.file.name : trackDataFromDisplayList.name;
        if (trackDataFromDisplayList.metadata?.title) {
            nameToDisplay = trackDataFromDisplayList.metadata.title;
            if (trackDataFromDisplayList.metadata.artist && trackDataFromDisplayList.metadata.artist !== "Unknown Artist") nameToDisplay += ` - ${trackDataFromDisplayList.metadata.artist}`;
        }
        trackNameSpan.textContent = nameToDisplay;
        trackNameSpan.className = 'truncate mr-2 flex-grow text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 cursor-pointer';
        trackNameSpan.title = nameToDisplay;

        const indexInPlaybackPlaylist = playlist.findIndex(t => t.path === trackDataFromDisplayList.path);
        trackNameSpan.onclick = () => playTrack(indexInPlaybackPlaylist);
        listItem.appendChild(trackNameSpan);

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'flex-shrink-0 flex items-center';

        const addToQueueBtn = document.createElement('button');
        addToQueueBtn.innerHTML = '<i class="fas fa-plus-circle"></i>';
        addToQueueBtn.title = 'Add to Queue';
        addToQueueBtn.className = 'add-to-queue-btn text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs mx-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity';
        addToQueueBtn.onclick = (event) => {
            event.stopPropagation();
            addToQueue(trackDataFromDisplayList.path);
        };
        buttonsContainer.appendChild(addToQueueBtn);

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.className = 'remove-track-btn text-red-400 hover:text-red-600 flex-shrink-0 ml-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity';
        removeBtn.title = 'Remove from playlist';
        removeBtn.onclick = (event) => {
            event.stopPropagation();
            const indexToRemoveFromPlayback = playlist.findIndex(t => t.path === trackDataFromDisplayList.path);
            if (indexToRemoveFromPlayback !== -1) {
                 removeTrack(indexToRemoveFromPlayback);
            }
        };
        buttonsContainer.appendChild(removeBtn);
        listItem.appendChild(buttonsContainer);
        if (indexInPlaybackPlaylist === currentTrackIndex) listItem.classList.add('active', 'bg-indigo-200', 'dark:bg-indigo-700');
        playlistElement.appendChild(listItem);
    });
}


function handleSearchInput() {
    currentSearchTerm = searchInput.value.trim();
    renderPlaylist();
}

function removeTrack(indexToRemoveInCurrentPlaylist) {
    if (indexToRemoveInCurrentPlaylist < 0 || indexToRemoveInCurrentPlaylist >= playlist.length) return;

    const trackToRemove = playlist[indexToRemoveInCurrentPlaylist];
    const originalIndexInOriginalPlaylist = originalPlaylist.findIndex(t => t.path === trackToRemove.path);

    playlist.splice(indexToRemoveInCurrentPlaylist, 1);

    if (originalIndexInOriginalPlaylist > -1) {
        originalPlaylist.splice(originalIndexInOriginalPlaylist, 1);
    }

    // Re-index originalPlaylist after removal
    originalPlaylist.forEach((track, index) => track.originalIndex = index);

    const storableVersion = originalPlaylist.map((track) => { // No need for index argument here
        const {file, ...storable} = track;
        // originalIndex is already updated on track object itself
        if(storable.metadata) delete storable.metadata.albumArtUrl;
        return storable;
    });
    playlists[activePlaylistName] = storableVersion;

    const savablePlaylists = {...playlists};
    // Ensure all playlists in savablePlaylists are in storable format
    for (const pName in savablePlaylists) {
        savablePlaylists[pName] = savablePlaylists[pName].map(track => {
            const { file, ...storable } = track;
            if (storable.metadata) delete storable.metadata.albumArtUrl;
            return storable;
        });
    }
    localStorage.setItem(MULTIPLE_PLAYLISTS_STORAGE_KEY, JSON.stringify(savablePlaylists));


    if (trackToRemove.path === currentPlayingTrackPath) {
        audioPlayer.pause();
        audioPlayer.src = '';
        if (currentObjectURL) URL.revokeObjectURL(currentObjectURL);
        currentObjectURL = null;
        currentPlayingTrackPath = null;
        if (playlist.length === 0) {
            currentTrackIndex = -1;
            resetPlayerUI();
        } else {
            currentTrackIndex = Math.min(indexToRemoveInCurrentPlaylist, playlist.length - 1);
            if(currentTrackIndex !== -1) playTrack(currentTrackIndex); else resetPlayerUI();
        }
    } else if (indexToRemoveInCurrentPlaylist < currentTrackIndex) {
        currentTrackIndex--;
    }

    renderPlaylist();
    populateFilterDropdowns();
}

function resetPlayerUI() {
    currentTrackTitleElement.textContent = 'No track selected';
    currentTrackArtistElement.textContent = 'Select a directory to play';
    currentTrackAlbumElement.textContent = '-';
    currentTimeElement.textContent = '0:00'; totalDurationElement.textContent = '0:00';
    progress.style.width = '0%';
    albumArtDisplay.src = ''; albumArtDisplay.style.display = 'none';
    albumArtPlaceholder.classList.remove('hidden');
    updatePlayPauseIcon();
    disableControls(true);
    stopVisualizer();
    playlistElement.innerHTML = '<p class="p-4 text-gray-500 text-center text-sm">Add files to see the playlist.</p>';
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.metadata = null;
    }
    displayLyrics(null);
    currentPlayingTrackPath = null;
}

// --- Lyrics Display Function ---
function displayLyrics(trackData) {
    if (!lyricsContentContainer || !lyricsPlaceholder) return;

    if (trackData && trackData.metadata && trackData.metadata.lyrics && trackData.metadata.lyrics.trim() !== '') {
        lyricsContentContainer.textContent = trackData.metadata.lyrics;
        lyricsPlaceholder.style.display = 'none';
        lyricsContentContainer.scrollTop = 0;
    } else {
        lyricsContentContainer.textContent = '';
        lyricsPlaceholder.textContent = 'No lyrics available for this track.';
        lyricsPlaceholder.style.display = 'block';
    }
}

async function playTrack(index) {
    if (index < 0 || index >= playlist.length) {
        if (playlist.length > 0) index = 0;
        else { resetPlayerUI(); return; }
    }
    currentTrackIndex = index;
    const trackData = playlist[currentTrackIndex];
    if (!trackData) { // Safety check if playlist was modified unexpectedly
        resetPlayerUI(); return;
    }
    currentPlayingTrackPath = trackData.path;

    if (!trackData.metadata) {
        trackData.metadata = { lyrics: null };
    } else if (typeof trackData.metadata.lyrics === 'undefined') {
        trackData.metadata.lyrics = null;
    }

    if (trackData.metadata && trackData.metadata.title) {
        currentTrackTitleElement.textContent = trackData.metadata.title;
        currentTrackArtistElement.textContent = trackData.metadata.artist;
        currentTrackAlbumElement.textContent = trackData.metadata.album;
        if (trackData.metadata.albumArtUrl) {
            albumArtDisplay.src = trackData.metadata.albumArtUrl;
            albumArtDisplay.style.display = 'inline-block'; albumArtPlaceholder.classList.add('hidden');
        } else {
            albumArtDisplay.src = ''; albumArtDisplay.style.display = 'none'; albumArtPlaceholder.classList.remove('hidden');
        }
        updateMediaSessionMetadata(trackData.metadata);
    } else {
        const parsedName = parseTrackName(trackData.name);
        currentTrackTitleElement.textContent = parsedName.title;
        currentTrackArtistElement.textContent = parsedName.artist;
        currentTrackAlbumElement.textContent = "Unknown Album";
        albumArtDisplay.src = ''; albumArtDisplay.style.display = 'none'; albumArtPlaceholder.classList.remove('hidden');
        updateMediaSessionMetadata({
            title: parsedName.title, artist: parsedName.artist,
            album: "Unknown Album", genre: "Unknown Genre", year: "Unknown Year",
            lyrics: null,
            albumArtUrl: null
        });
    }

    // Update active class without full re-render (moved this call before fetching metadata)
    document.querySelectorAll('#playlist .playlist-item.active').forEach(item => item.classList.remove('active', 'bg-indigo-200', 'dark:bg-indigo-700'));
    const originalIndexOfPlayingTrack = originalPlaylist.findIndex(t => t.path === trackData.path);
    if (originalIndexOfPlayingTrack !== -1) { // Check if found
        const listItemToActivate = playlistElement.querySelector(`.playlist-item[data-index="${originalIndexOfPlayingTrack}"]`);
        if (listItemToActivate) listItemToActivate.classList.add('active', 'bg-indigo-200', 'dark:bg-indigo-700');
    }


    displayLyrics(trackData);

    if (!trackData.file) { // This check should ideally be done before trying to play
        const trackInfoForAlert = findTrackDataByPath(trackData.path) || trackData; // Use path to get from playlists if possible
        alert(`Track "${trackInfoForAlert.name}" (path: ${trackInfoForAlert.path || 'N/A'}) needs re-selection as its File object is missing.`);
        const baseTitle = trackInfoForAlert.metadata?.title || parseTrackName(trackInfoForAlert.name).title;
        currentTrackTitleElement.textContent = baseTitle + " (Needs re-selection)";
        currentTrackArtistElement.textContent = trackInfoForAlert.metadata?.artist || parseTrackName(trackInfoForAlert.name).artist;
        currentTrackAlbumElement.textContent = trackInfoForAlert.metadata?.album || "Unknown Album";
        displayLyrics(null);
        stopVisualizer(); albumArtPlaceholder.classList.remove('hidden'); albumArtDisplay.style.display = 'none';
        updatePlayPauseIcon(); return;
    }

    if (!audioCtx) setupAudioContext();
    if (audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch (e) { console.warn("Ctx resume fail:", e); } }

    if (!trackData.metadata || !trackData.metadata.albumArtUrl || !trackData.metadata.genre || trackData.metadata.genre === 'Unknown Genre' || !trackData.metadata.year || trackData.metadata.year === 'Unknown Year' || typeof trackData.metadata.lyrics === 'undefined') {
        try {
            const fetchedMetadata = await getTrackMetadata(trackData.file);
            // Merge fetched metadata with existing, prioritizing fetched, but keeping lyrics if only that was missing
            const oldLyrics = trackData.metadata?.lyrics;
            trackData.metadata = {
                ...trackData.metadata, // Keep existing fields like path, originalIndex etc.
                title: fetchedMetadata.title || trackData.metadata?.title || parseTrackName(trackData.name).title,
                artist: fetchedMetadata.artist || trackData.metadata?.artist || parseTrackName(trackData.name).artist,
                album: fetchedMetadata.album || trackData.metadata?.album || "Unknown Album",
                genre: fetchedMetadata.genre || trackData.metadata?.genre || "Unknown Genre",
                year: fetchedMetadata.year || trackData.metadata?.year || "Unknown Year",
                lyrics: fetchedMetadata.lyrics || oldLyrics || null,
                albumArtUrl: fetchedMetadata.albumArtUrl // This could be null from fetch
            };

            // Update UI again with potentially richer metadata
            currentTrackTitleElement.textContent = trackData.metadata.title;
            currentTrackArtistElement.textContent = trackData.metadata.artist;
            currentTrackAlbumElement.textContent = trackData.metadata.album;
            if (trackData.metadata.albumArtUrl) {
                albumArtDisplay.src = trackData.metadata.albumArtUrl;
                albumArtDisplay.style.display = 'inline-block'; albumArtPlaceholder.classList.add('hidden');
            } else {
                albumArtDisplay.src = ''; albumArtDisplay.style.display = 'none'; albumArtPlaceholder.classList.remove('hidden');
            }
            updateMediaSessionMetadata(trackData.metadata);
            displayLyrics(trackData);
        } catch (e) {
            console.error("Metadata fetch error in playTrack:", e);
            if (!trackData.metadata) {
                 const parsedFallback = parseTrackName(trackData.name);
                 trackData.metadata = {title: parsedFallback.title, artist: parsedFallback.artist, album: "Unknown Album", genre: "Unknown Genre", year: "Unknown Year", lyrics: null, albumArtUrl: null };
            } else { // Ensure defaults if some parts failed
                trackData.metadata.genre = trackData.metadata.genre || "Unknown Genre";
                trackData.metadata.year = trackData.metadata.year || "Unknown Year";
                trackData.metadata.lyrics = trackData.metadata.lyrics || null;
                trackData.metadata.albumArtUrl = trackData.metadata.albumArtUrl || null;
            }
            updateMediaSessionMetadata(trackData.metadata);
            displayLyrics(trackData);
        }
    } else {
        displayLyrics(trackData);
    }

    const file = trackData.file;
    if (currentObjectURL) URL.revokeObjectURL(currentObjectURL);
    currentObjectURL = URL.createObjectURL(file);
    audioPlayer.src = currentObjectURL;
    audioPlayer.load();
    try {
        await audioPlayer.play();
    } catch (error) {
        console.error("Error playing track:", error);
        const titleToDisplay = trackData.metadata?.title || parseTrackName(file.name).title;
        const artistToDisplay = trackData.metadata?.artist || parseTrackName(file.name).artist;
        currentTrackTitleElement.textContent = `Error: ${titleToDisplay}`;
        currentTrackArtistElement.textContent = artistToDisplay;
        albumArtDisplay.src = ''; albumArtDisplay.style.display = 'none'; albumArtPlaceholder.classList.remove('hidden');
        displayLyrics(null);
        stopVisualizer();
        if (currentObjectURL) { URL.revokeObjectURL(currentObjectURL); currentObjectURL = null; }
    }
}

// --- Playback Control Functions ---
function togglePlayPause() {
    if (!audioCtx) setupAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(err => console.warn("Ctx resume fail:", err));
    if (!audioPlayer.src && playlist.length > 0) playTrack(0);
    else if (audioPlayer.paused) audioPlayer.play().catch(e => console.error("Play err:", e));
    else audioPlayer.pause();
}

function handleTrackEnd() {
    const nextTrackPathFromQueue = getNextFromQueue();

    if (nextTrackPathFromQueue) {
        console.log("Playing next from queue:", nextTrackPathFromQueue);
        playTrackFromHistory(nextTrackPathFromQueue);
        return;
    }

    if (repeatMode === 'one') {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
    } else {
        playNextTrack();
    }
}

function playNextTrack() {
    if (playlist.length === 0) return;
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= playlist.length) {
        if (repeatMode === 'all') nextIndex = 0;
        else { resetPlayerUI(); return; }
    }
    playTrack(nextIndex);
}

function playPreviousTrack() {
    if (playlist.length === 0) return;
    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) {
        if (repeatMode === 'all') prevIndex = playlist.length - 1;
        else { audioPlayer.currentTime = 0; return; }
    }
    playTrack(prevIndex);
}


// --- UI Update & State Management Functions ---
function toggleShuffle() {
    let playingTrackData = null;
    if (currentTrackIndex > -1 && currentTrackIndex < playlist.length) playingTrackData = playlist[currentTrackIndex];

    isShuffled = !isShuffled;

    if (isShuffled) {
        playlist = shuffleArray([...originalPlaylist]);
    } else {
        playlist = [...originalPlaylist];
    }

    if (playingTrackData) {
        currentTrackIndex = playlist.findIndex(track => track.path === playingTrackData.path);
    } else {
        currentTrackIndex = -1;
    }

    renderPlaylist();
    updateShuffleButton();
    localStorage.setItem(SHUFFLE_STATE_KEY, JSON.stringify(isShuffled));
}

function updateShuffleButton() {
    shuffleBtn.classList.toggle('active', isShuffled);
    shuffleBtn.title = `Shuffle (${isShuffled ? 'On' : 'Off'})`;
}

function cycleRepeatMode() {
    const modes = ['none', 'one', 'all'];
    let currentModeIndex = modes.indexOf(repeatMode);
    currentModeIndex = (currentModeIndex + 1) % modes.length;
    repeatMode = modes[currentModeIndex];
    updateRepeatButtonUI();
    localStorage.setItem(REPEAT_MODE_KEY, repeatMode);
}

function updateRepeatButtonUI() {
    const icon = repeatBtn.querySelector('i');
    repeatBtn.classList.remove('active'); icon.classList.remove('fa-repeat', 'fa-1');
    if (repeatMode === 'one') {
        repeatBtn.title = 'Repeat (One)'; repeatBtn.classList.add('active'); icon.classList.add('fa-1');
    } else if (repeatMode === 'all') {
        repeatBtn.title = 'Repeat (All)'; repeatBtn.classList.add('active'); icon.classList.add('fa-repeat');
    } else {
        repeatBtn.title = 'Repeat (Off)'; icon.classList.add('fa-repeat');
    }
}

function updateProgress() {
    if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
        progress.style.width = `${(audioPlayer.currentTime / audioPlayer.duration) * 100}%`;
        currentTimeElement.textContent = formatTime(audioPlayer.currentTime);
    } else {
        currentTimeElement.textContent = formatTime(audioPlayer.currentTime || 0);
        progress.style.width = '0%';
    }
}

function updateDuration() {
    totalDurationElement.textContent = (audioPlayer.duration && isFinite(audioPlayer.duration)) ? formatTime(audioPlayer.duration) : '--:--';
}

function setProgress(e) {
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    if (audioPlayer.duration && isFinite(audioPlayer.duration) && width > 0) {
        audioPlayer.currentTime = (clickX / width) * audioPlayer.duration;
    }
}

function setVolume() {
    audioPlayer.volume = volumeSlider.value;
    updateMuteButtonUI();
    saveVolumeSettings();
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function updatePlayPauseIcon() {
    const icon = playPauseBtn.querySelector('i');
    if (audioPlayer.paused) {
        icon.classList.replace('fa-pause', 'fa-play'); playPauseBtn.title = 'Play';
    } else {
        icon.classList.replace('fa-play', 'fa-pause'); playPauseBtn.title = 'Pause';
    }
}

function disableControls(disable) {
    [playPauseBtn, prevBtn, nextBtn, shuffleBtn, repeatBtn].forEach(btn => {
        btn.disabled = disable; btn.classList.toggle('opacity-50', disable); btn.classList.toggle('cursor-not-allowed', disable);
    });
    volumeSlider.disabled = disable; volumeSlider.classList.toggle('opacity-50', disable); volumeSlider.classList.toggle('cursor-not-allowed', disable);
    progressContainer.style.cursor = disable ? 'default' : 'pointer';
}


// --- Initial Setup ---
function initializePlayer() {
    loadPlaylistsFromLocalStorage();
    loadPlayHistory();
    displayRecentlyPlayed();
    displayMostPlayed();
    displayPlayQueue();
    displayLyrics(null);
    const storedShuffleState = localStorage.getItem(SHUFFLE_STATE_KEY);
    if (storedShuffleState !== null) {
        try {
            isShuffled = JSON.parse(storedShuffleState);
        } catch (e) {
            console.error("Error parsing shuffle state from localStorage:", e);
            isShuffled = false;
        }
    } else {
        isShuffled = false;
    }

    const storedRepeatMode = localStorage.getItem(REPEAT_MODE_KEY);
    if (storedRepeatMode) repeatMode = storedRepeatMode;

    loadVolumeSettings();

    if ('mediaSession' in navigator) {
        setupMediaSessionActionHandlers();
    }

    setupEventListeners();
    updatePlaylistSelector();
    if (!audioCtx) setupAudioContext();
    loadSelectedPlaylist();
    loadEqSettings();

    if (isEqEnabled) {
        if (currentEqPresetName !== 'custom' && EQ_PRESETS[currentEqPresetName]) {
            applyEqPreset(currentEqPresetName);
        } else {
            if(preampGainNode && preampSlider) preampGainNode.gain.value = Math.pow(10, (parseFloat(preampSlider.value) || 0) / 20);
            eqBands.forEach((filter, i) => {
                if (filter && eqBandSliders[i]) filter.gain.value = parseFloat(eqBandSliders[i].value) || 0;
            });
            if(eqPresetsSelect) eqPresetsSelect.value = 'custom';
            currentEqPresetName = 'custom';
            updateAllEqUIDisplays();
        }
    } else {
        if (preampGainNode) preampGainNode.gain.value = 1.0;
        eqBands.forEach(filter => { if(filter) filter.gain.value = 0; });
        updateAllEqUIDisplays();
    }

    updateAllEqUIDisplays();
    updateShuffleButton();
    updateRepeatButtonUI();
    updateEqOnOffButtonUI();
    updateMuteButtonUI();
    if(eqPresetsSelect) eqPresetsSelect.value = currentEqPresetName;
}

// --- Media Session API Integration ---
function updateMediaSessionMetadata(metadata) {
    if ('mediaSession' in navigator && metadata) {
        navigator.mediaSession.metadata = new window.MediaMetadata({
            title: metadata.title || 'Unknown Title',
            artist: metadata.artist || 'Unknown Artist',
            album: metadata.album || 'Unknown Album',
            genre: metadata.genre || 'Unknown Genre',
            artwork: metadata.albumArtUrl ? [{ src: metadata.albumArtUrl, sizes: '512x512', type: 'image/png' }] : []
        });
    }
}

function updateMediaSessionPlaybackState() {
    if ('mediaSession' in navigator) {
        if (!audioPlayer || audioPlayer.paused) {
            navigator.mediaSession.playbackState = 'paused';
        } else {
            navigator.mediaSession.playbackState = 'playing';
        }
    }
}

function setupMediaSessionActionHandlers() {
    if (!('mediaSession' in navigator)) {
        return;
    }
    try {
        navigator.mediaSession.setActionHandler('play', () => { togglePlayPause(); });
        navigator.mediaSession.setActionHandler('pause', () => { togglePlayPause(); });
        navigator.mediaSession.setActionHandler('previoustrack', () => { playPreviousTrack(); });
        navigator.mediaSession.setActionHandler('nexttrack', () => { playNextTrack(); });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - (details.seekOffset || 10));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + (details.seekOffset || 10));
        });
    } catch (error) {
        console.error('Error setting up media session action handlers:', error);
    }
}

// --- Keyboard Shortcut Handler ---
function handleKeyboardShortcuts(event) {
    const targetNodeName = event.target.nodeName;
    if (targetNodeName === 'INPUT' || targetNodeName === 'TEXTAREA' || targetNodeName === 'SELECT') {
        if (event.key === 'Escape' && event.target === searchInput) {
            searchInput.blur();
        }
        return;
    }

    switch (event.key.toLowerCase()) {
        case ' ':
            event.preventDefault(); togglePlayPause(); break;
        case 'arrowright':
            event.preventDefault();
            if (audioPlayer.duration) audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 5);
            break;
        case 'arrowleft':
            event.preventDefault();
            if (audioPlayer.duration) audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 5);
            break;
        case 'arrowup':
            event.preventDefault();
            if (volumeSlider) {
                let newVolume = Math.min(1, audioPlayer.volume + 0.1);
                audioPlayer.volume = newVolume;
                volumeSlider.value = newVolume;
                updateMuteButtonUI();
                saveVolumeSettings();
            }
            break;
        case 'arrowdown':
            event.preventDefault();
            if (volumeSlider) {
                let newVolume = Math.max(0, audioPlayer.volume - 0.1);
                audioPlayer.volume = newVolume;
                volumeSlider.value = newVolume;
                updateMuteButtonUI();
                saveVolumeSettings();
            }
            break;
        case 'n':
            playNextTrack(); break;
        case 'p':
            playPreviousTrack(); break;
        case 'm':
            event.preventDefault();
            toggleMute();
            break;
    }
}

// --- UI Update Functions (specific to controls) ---
function updateMuteButtonUI() {
    if (!muteToggleBtn) return;
    if (audioPlayer.volume === 0) {
        muteToggleBtn.classList.remove('fa-volume-up', 'fa-volume-down');
        muteToggleBtn.classList.add('fa-volume-mute');
        muteToggleBtn.title = 'Unmute (M)';
    } else if (audioPlayer.volume <= 0.5 && audioPlayer.volume > 0) {
        muteToggleBtn.classList.remove('fa-volume-up', 'fa-volume-mute');
        muteToggleBtn.classList.add('fa-volume-down');
        muteToggleBtn.title = 'Mute (M)';
    } else {
        muteToggleBtn.classList.remove('fa-volume-mute', 'fa-volume-down');
        muteToggleBtn.classList.add('fa-volume-up');
        muteToggleBtn.title = 'Mute (M)';
    }
}

function toggleMute() {
    if (audioPlayer.volume > 0) {
        volumeBeforeMute = audioPlayer.volume;
        audioPlayer.volume = 0;
    } else {
        audioPlayer.volume = volumeBeforeMute > 0 ? volumeBeforeMute : 1.0;
    }
    if (volumeSlider) volumeSlider.value = audioPlayer.volume;
    updateMuteButtonUI();
    saveVolumeSettings();
}


initializePlayer();

[end of script.js]
